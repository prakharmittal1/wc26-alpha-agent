/**
 * Build static knowledge files from Kaggle CSV (no API keys).
 *
 *   npm run data:build
 *   npm run data:build -- --file data/results.csv
 */

import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { parse } from "csv-parse";
import { config as loadEnv } from "dotenv";

import { createHash } from "node:crypto";

import { UPCOMING_FIXTURES } from "@/lib/fixtures";
import type { PlaybookChunk } from "@/lib/rag-types";
import { canonicalizeTeam, WC2026_TEAMS, type Wc2026Team } from "@/lib/teams";

const DEFAULT_ELO = 1500;

loadEnv({ path: ".env.local" });

const K_FACTOR = 20;
const DEFAULT_FILE = "data/results.csv";
const OUT_DIR = join(process.cwd(), "data", "processed");

type Row = Record<string, string>;

const SEED_RATINGS: Record<string, number> = {
  Argentina: 2085,
  France: 2070,
  Brazil: 2065,
  England: 2055,
  Spain: 2045,
  Germany: 2010,
  "United States": 1970,
  Mexico: 1965,
  Japan: 1955,
  "South Korea": 1940,
};

function pick(row: Row, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function updateElo(
  ratings: Map<string, number>,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  neutral: boolean,
): void {
  const rHome = ratings.get(home) ?? DEFAULT_ELO;
  const rAway = ratings.get(away) ?? DEFAULT_ELO;
  const adjHome = neutral ? rHome : rHome + 65;
  const eHome = expectedScore(adjHome, rAway);
  let sHome: number;
  if (homeScore > awayScore) sHome = 1;
  else if (homeScore < awayScore) sHome = 0;
  else sHome = 0.5;
  ratings.set(home, rHome + K_FACTOR * (sHome - eHome));
  ratings.set(away, rAway + K_FACTOR * ((1 - sHome) - (1 - eHome)));
}

function h2hKey(home: Wc2026Team, away: Wc2026Team): string {
  return `${home}|${away}`;
}

async function readCsv(path: string): Promise<Row[]> {
  const rows: Row[] = [];
  const parser = createReadStream(path).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );
  for await (const row of parser) {
    rows.push(row as Row);
  }
  return rows;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(
      "Usage: npm run data:build [-- --file data/results.csv]\n",
    );
    return;
  }

  const file = values.file ?? DEFAULT_FILE;
  mkdirSync(OUT_DIR, { recursive: true });

  const ratings = new Map<string, number>();
  for (const t of WC2026_TEAMS) {
    ratings.set(t, SEED_RATINGS[t] ?? DEFAULT_ELO);
  }

  const h2h = new Map<string, { home_wins: number; away_wins: number; draws: number; total: number }>();
  const ragCandidates: PlaybookChunk[] = [];

  if (existsSync(file)) {
    process.stderr.write(`[data:build] Reading ${file}…\n`);
    const rows = await readCsv(file);
    let used = 0;
    for (const row of rows) {
      const date = pick(row, "date");
      const homeRaw = pick(row, "home_team", "home");
      const awayRaw = pick(row, "away_team", "away");
      const hs = pick(row, "home_score");
      const as = pick(row, "away_score");
      const tournament = pick(row, "tournament") ?? "match";
      const city = pick(row, "city");
      const country = pick(row, "country");
      const neutral = pick(row, "neutral")?.toLowerCase() === "true";
      if (!homeRaw || !awayRaw || hs === undefined || as === undefined) continue;
      const home = canonicalizeTeam(homeRaw);
      const away = canonicalizeTeam(awayRaw);
      if (!home || !away) continue;
      const homeScore = Number(hs);
      const awayScore = Number(as);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

      if (date) {
        const venue =
          city && country ? `${city}, ${country}` : (city ?? country ?? "unknown venue");
        const neutralFlag = neutral ? " (neutral)" : "";
        const content = `On ${date} in ${tournament} at ${venue}: ${home} ${homeScore}-${awayScore} ${away}${neutralFlag}.`;
        const id = createHash("sha256")
          .update(`rag|${date}|${home}|${away}|${tournament}`)
          .digest("hex")
          .slice(0, 16);
        ragCandidates.push({
          id,
          content,
          date,
          home,
          away,
          tournament,
          home_score: homeScore,
          away_score: awayScore,
          neutral,
        });
      }

      updateElo(ratings, home, away, homeScore, awayScore, neutral);
      const key = h2hKey(home, away);
      const rec = h2h.get(key) ?? { home_wins: 0, away_wins: 0, draws: 0, total: 0 };
      if (homeScore > awayScore) rec.home_wins += 1;
      else if (homeScore < awayScore) rec.away_wins += 1;
      else rec.draws += 1;
      rec.total += 1;
      h2h.set(key, rec);
      used += 1;
    }
    process.stderr.write(`[data:build] Processed ${used} international results.\n`);
  } else {
    process.stderr.write(
      `[data:build] No CSV at ${file} — writing seed Elo only. Download Kaggle results for full rebuild.\n`,
    );
    for (const [team, r] of Object.entries(SEED_RATINGS)) {
      ratings.set(team, r);
    }
  }

  const built_at = new Date().toISOString();
  const eloOut = {
    built_at,
    source: existsSync(file) ? `csv:${file}` : "seed-ratings",
    ratings: Object.fromEntries(
      [...ratings.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  writeFileSync(join(OUT_DIR, "elo-ratings.json"), JSON.stringify(eloOut, null, 2));

  const h2hOut = {
    built_at,
    pairs: Object.fromEntries(h2h.entries()),
  };
  writeFileSync(join(OUT_DIR, "h2h-index.json"), JSON.stringify(h2hOut, null, 2));

  const wcChunks = ragCandidates.filter((c) =>
    /world cup|fifa world/i.test(c.tournament),
  );
  const recent = [...ragCandidates].sort((a, b) => b.date.localeCompare(a.date));
  const recentCap = recent.slice(0, 5000);
  const mergedRag = new Map<string, PlaybookChunk>();
  for (const c of [...wcChunks, ...recentCap]) mergedRag.set(c.id, c);
  const ragChunks = [...mergedRag.values()].slice(0, 6000);
  const ragOut = {
    built_at,
    source: existsSync(file) ? `csv:${file}` : "empty",
    chunk_count: ragChunks.length,
    chunks: ragChunks,
  };
  writeFileSync(join(OUT_DIR, "playbook-chunks.json"), JSON.stringify(ragOut));

  const bundled = {
    fixtures: UPCOMING_FIXTURES.map((f) => ({
      id: f.id,
      home: f.home,
      away: f.away,
      kickoff_iso: f.kickoff_iso,
      competition: f.competition,
      ...(f.venue ? { venue: f.venue } : {}),
    })),
  };
  writeFileSync(
    join(process.cwd(), "data", "bundled-fixtures.json"),
    JSON.stringify(bundled, null, 2),
  );

  process.stderr.write(
    `[data:build] Wrote ${OUT_DIR}/elo-ratings.json (${Object.keys(eloOut.ratings).length} teams), playbook-chunks.json (${ragChunks.length} chunks)\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
