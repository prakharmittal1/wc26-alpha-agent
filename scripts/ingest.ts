/**
 * scripts/ingest.ts
 *
 * Chunk a Kaggle CSV (international results or WC 2026 match probabilities),
 * embed each row with Gemini, and upsert into Supabase `playbook_docs`.
 *
 * Usage:
 *   tsx scripts/ingest.ts --file data/results.csv --source international_results
 *   tsx scripts/ingest.ts --file data/wc2026_probabilities.csv --source wc2026_probabilities
 *   tsx scripts/ingest.ts --file data/results.csv --source international_results --limit 200
 *
 * Prereqs:
 *   1. Copy .env.local.example to .env.local and fill GOOGLE_GENERATIVE_AI_API_KEY,
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *   2. Apply lib/supabase/schema.sql in your Supabase project.
 *   3. Drop the Kaggle CSVs into data/ (see scripts/README.md).
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve } from "node:path";

import { parse } from "csv-parse";
import { config as loadEnv } from "dotenv";

import { embedBatch } from "@/lib/embeddings";
import { getServiceSupabase } from "@/lib/supabase/server";

loadEnv({ path: ".env.local" });

type SourceName = "international_results" | "wc2026_probabilities";

type Chunk = {
  doc_key: string;
  content: string;
  metadata: Record<string, unknown> & { source: SourceName };
};

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: tsx scripts/ingest.ts --file <path> --source <name> [--limit N]",
      "",
      "Required:",
      "  --file <path>     Path to a Kaggle CSV (e.g. data/results.csv).",
      "  --source <name>   One of: international_results | wc2026_probabilities",
      "",
      "Optional:",
      "  --limit <N>       Process only the first N rows (smoke test).",
      "  --batch <N>       Upsert batch size into Supabase (default 200).",
      "  --help            Show this message and exit.",
      "",
    ].join("\n"),
  );
}

function parseCli(): {
  file: string;
  source: SourceName;
  limit: number | undefined;
  batch: number;
} {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        file: { type: "string" },
        source: { type: "string" },
        limit: { type: "string" },
        batch: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: false,
    });
  } catch (err) {
    printHelp();
    throw err;
  }

  if (parsed.values.help) {
    printHelp();
    process.exit(0);
  }

  const file = parsed.values.file;
  const source = parsed.values.source as SourceName | undefined;

  if (!file || !source) {
    printHelp();
    throw new Error("Missing required --file and/or --source.");
  }
  if (source !== "international_results" && source !== "wc2026_probabilities") {
    throw new Error(
      `Unknown --source "${source}". Expected: international_results | wc2026_probabilities`,
    );
  }
  const absolute = resolve(file);
  if (!existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }

  const limit = parsed.values.limit ? Number(parsed.values.limit) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    throw new Error(`Invalid --limit: ${parsed.values.limit}`);
  }
  const batch = parsed.values.batch ? Number(parsed.values.batch) : 200;
  if (!Number.isFinite(batch) || batch < 1) {
    throw new Error(`Invalid --batch: ${parsed.values.batch}`);
  }

  return { file: absolute, source, limit, batch };
}

// ---------------------------------------------------------------------------
// Per-source row formatters
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function pick(row: Row, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

/**
 * International Football Results dataset (martj42/international_football_results)
 * Expected columns: date, home_team, away_team, home_score, away_score,
 *                   tournament, city, country, neutral
 */
function formatInternationalResults(row: Row): Chunk | null {
  const date = pick(row, "date");
  const home = pick(row, "home_team", "home");
  const away = pick(row, "away_team", "away");
  const homeScore = pick(row, "home_score");
  const awayScore = pick(row, "away_score");
  const tournament = pick(row, "tournament") ?? "match";
  const city = pick(row, "city");
  const country = pick(row, "country");
  const neutral = pick(row, "neutral");

  if (!date || !home || !away) return null;

  const venue = city && country ? `${city}, ${country}` : (city ?? country ?? "unknown venue");
  const score = homeScore && awayScore ? `${homeScore}-${awayScore}` : "score unknown";
  const neutralFlag = neutral?.toLowerCase() === "true" ? " (neutral venue)" : "";

  const content =
    `On ${date} in ${tournament} at ${venue}: ${home} ${score} ${away}${neutralFlag}.`;

  const doc_key = sha256(`international_results|${date}|${home}|${away}|${tournament}`);

  return {
    doc_key,
    content,
    metadata: {
      source: "international_results",
      date,
      home,
      away,
      tournament,
      city: city ?? null,
      country: country ?? null,
      home_score: homeScore ? Number(homeScore) : null,
      away_score: awayScore ? Number(awayScore) : null,
      neutral: neutral?.toLowerCase() === "true",
    },
  };
}

/**
 * WC 2026 Match Probability dataset.
 *
 * The exact column set varies across Kaggle uploads, so we keep this tolerant:
 *   - Pull common identifier-ish columns into metadata (date, teams, group).
 *   - Serialize every remaining column as "key: value" so the embedding has
 *     the full row context.
 * The doc_key hashes the full sorted (key=value) string so re-ingest replaces
 * cleanly even if rows have no obvious primary key.
 */
function formatWc2026Probabilities(row: Row): Chunk | null {
  const date = pick(row, "date", "match_date");
  const home = pick(row, "home_team", "team_1", "team1", "home");
  const away = pick(row, "away_team", "team_2", "team2", "away");
  const group = pick(row, "group", "group_name");

  const entries = Object.entries(row).filter(([, v]) => v !== "" && v !== undefined);
  if (entries.length === 0) return null;

  const body = entries.map(([k, v]) => `${k}: ${v}`).join("; ");
  const header = home && away ? `WC2026 probabilities for ${home} vs ${away}: ` : "WC2026 row: ";
  const content = header + body;

  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
  const doc_key = sha256(
    "wc2026_probabilities|" + sorted.map(([k, v]) => `${k}=${v}`).join("|"),
  );

  return {
    doc_key,
    content,
    metadata: {
      source: "wc2026_probabilities",
      date: date ?? null,
      home: home ?? null,
      away: away ?? null,
      group: group ?? null,
      raw: row,
    },
  };
}

function buildChunk(source: SourceName, row: Row): Chunk | null {
  switch (source) {
    case "international_results":
      return formatInternationalResults(row);
    case "wc2026_probabilities":
      return formatWc2026Probabilities(row);
  }
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

async function upsertChunks(chunks: Chunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const embeddings = await embedBatch(chunks.map((c) => c.content));
  if (embeddings.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch: ${embeddings.length} vs ${chunks.length} chunks`,
    );
  }

  const rows = chunks.map((c, i) => ({
    doc_key: c.doc_key,
    content: c.content,
    // supabase-js serializes number[] correctly to the Postgres `vector` type.
    embedding: embeddings[i] as unknown as string,
    metadata: c.metadata,
  }));

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("playbook_docs")
    .upsert(rows, { onConflict: "doc_key", ignoreDuplicates: false });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { file, source, limit, batch } = parseCli();

  process.stdout.write(`\n[ingest] source=${source} file=${file}` +
    (limit ? ` limit=${limit}` : "") + ` batch=${batch}\n`);

  const parser = createReadStream(file).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }),
  );

  const pending: Chunk[] = [];
  let read = 0;
  let kept = 0;
  let written = 0;
  let skippedNoChunk = 0;

  for await (const record of parser as AsyncIterable<Row>) {
    read += 1;
    if (limit !== undefined && read > limit) break;

    const chunk = buildChunk(source, record);
    if (!chunk) {
      skippedNoChunk += 1;
      continue;
    }
    pending.push(chunk);
    kept += 1;

    if (pending.length >= batch) {
      await upsertChunks(pending.splice(0, pending.length));
      written = kept;
      process.stdout.write(`[ingest] rows read=${read} embedded+upserted=${written}\n`);
    }

    if (read % 500 === 0) {
      process.stdout.write(`[ingest] progress: read=${read} kept=${kept}\n`);
    }
  }

  if (pending.length > 0) {
    await upsertChunks(pending);
    written = kept;
  }

  process.stdout.write(
    `\n[ingest] done. read=${read} kept=${kept} written=${written} skipped_no_chunk=${skippedNoChunk}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[ingest] FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});
