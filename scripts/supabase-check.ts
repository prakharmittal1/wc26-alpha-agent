/**
 * scripts/supabase-check.ts
 *
 * Sanity-check the Supabase project for the WC26 alpha agent.
 *
 * Verifies:
 *   - env vars are present
 *   - the service-role client can connect
 *   - the 3 tables exist (playbook_docs, sentiment_posts, sentiment_scores)
 *   - the 2 RPCs exist and accept their published signatures
 *     (match_playbook_docs, refresh_sentiment_scores)
 *
 * Exits 0 if everything is wired, 1 otherwise.
 *
 * Usage:
 *   npm run supabase:check
 */

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { getServiceSupabase } from "@/lib/supabase/server";
import { EMBEDDING_DIM } from "@/lib/embeddings";

type Check = { name: string; ok: boolean; detail: string };

function fmt(c: Check): string {
  const tag = c.ok ? "PASS" : "FAIL";
  return `  [${tag}] ${c.name.padEnd(32)} ${c.detail}`;
}

async function checkEnv(): Promise<Check[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  return [
    {
      name: "env: SUPABASE_URL",
      ok: !!url,
      detail: url ? maskUrl(url) : "missing",
    },
    {
      name: "env: SUPABASE_SERVICE_ROLE_KEY",
      ok: !!key,
      detail: key ? `set (${key.length} chars)` : "missing",
    },
    {
      name: "env: GOOGLE_GENERATIVE_AI_API_KEY",
      ok: !!gemini,
      detail: gemini ? `set (${gemini.length} chars)` : "missing (needed by RAG)",
    },
  ];
}

function maskUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return parsed.origin + " (host ok)";
  } catch {
    return "invalid URL";
  }
}

async function checkTable(
  table: "playbook_docs" | "sentiment_posts" | "sentiment_scores",
): Promise<Check> {
  try {
    const supabase = getServiceSupabase();
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      return {
        name: `table: ${table}`,
        ok: false,
        detail: error.message,
      };
    }
    return {
      name: `table: ${table}`,
      ok: true,
      detail: `${count ?? 0} rows`,
    };
  } catch (err) {
    return {
      name: `table: ${table}`,
      ok: false,
      detail: (err as Error).message,
    };
  }
}

async function checkMatchRpc(): Promise<Check> {
  try {
    const supabase = getServiceSupabase();
    // Zero vector is a valid input; we just want to confirm the function
    // exists with the expected signature. It'll return 0 rows when the
    // table is empty, which is fine.
    const zero = new Array(EMBEDDING_DIM).fill(0);
    const { error } = await supabase.rpc("match_playbook_docs", {
      query_embedding: zero,
      match_count: 1,
      filter: {},
    });
    if (error) {
      return {
        name: "rpc: match_playbook_docs",
        ok: false,
        detail: error.message,
      };
    }
    return {
      name: "rpc: match_playbook_docs",
      ok: true,
      detail: "signature ok",
    };
  } catch (err) {
    return {
      name: "rpc: match_playbook_docs",
      ok: false,
      detail: (err as Error).message,
    };
  }
}

async function checkRefreshRpc(): Promise<Check> {
  try {
    const supabase = getServiceSupabase();
    // Call with both filters null is allowed and is a no-op when the raw
    // table is empty. Sentinel date_filter narrowly limits the operation
    // so we don't actually rewrite anything if data does exist.
    const { error } = await supabase.rpc("refresh_sentiment_scores", {
      team_filter: ["__no_such_team__"],
      date_filter: "1970-01-01",
    });
    if (error) {
      return {
        name: "rpc: refresh_sentiment_scores",
        ok: false,
        detail: error.message,
      };
    }
    return {
      name: "rpc: refresh_sentiment_scores",
      ok: true,
      detail: "signature ok",
    };
  } catch (err) {
    return {
      name: "rpc: refresh_sentiment_scores",
      ok: false,
      detail: (err as Error).message,
    };
  }
}

async function main(): Promise<void> {
  process.stdout.write("\n[supabase:check] starting...\n\n");

  const env = await checkEnv();
  for (const c of env) process.stdout.write(fmt(c) + "\n");

  // If env is broken, don't bother probing tables - we'd just throw.
  const envOk = env.every(
    (c) => c.ok || c.name === "env: GOOGLE_GENERATIVE_AI_API_KEY",
  );
  if (!envOk) {
    process.stdout.write(
      "\n[supabase:check] env missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n",
    );
    process.exit(1);
  }

  process.stdout.write("\n");

  const tableChecks = await Promise.all([
    checkTable("playbook_docs"),
    checkTable("sentiment_posts"),
    checkTable("sentiment_scores"),
  ]);
  for (const c of tableChecks) process.stdout.write(fmt(c) + "\n");

  process.stdout.write("\n");

  const rpcChecks = await Promise.all([checkMatchRpc(), checkRefreshRpc()]);
  for (const c of rpcChecks) process.stdout.write(fmt(c) + "\n");

  const all = [...env, ...tableChecks, ...rpcChecks];
  const failed = all.filter((c) => !c.ok);

  process.stdout.write("\n");
  if (failed.length === 0) {
    process.stdout.write(
      "[supabase:check] OK - schema is wired. You can run `npm run ingest` and `npm run sentiment`.\n",
    );
    return;
  }

  process.stdout.write(
    `[supabase:check] ${failed.length} check(s) failed:\n`,
  );
  for (const c of failed) {
    process.stdout.write(`    - ${c.name}: ${c.detail}\n`);
  }
  process.stdout.write(
    "\nFix: open the Supabase SQL editor and run lib/supabase/schema.sql top-to-bottom.\n",
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(
    `[supabase:check] FAILED: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
