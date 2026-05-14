/**
 * scripts/sentiment.ts
 *
 * Reddit RSS -> Gemini classifier -> Supabase sentiment_posts + sentiment_scores.
 *
 * Usage:
 *   tsx scripts/sentiment.ts --help
 *   tsx scripts/sentiment.ts --dry-run
 *   tsx scripts/sentiment.ts --subreddits soccer,worldcup --max-per-sub 50
 *   tsx scripts/sentiment.ts --since-days 1
 *
 * Prereqs:
 *   1. `.env.local` filled (GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_*).
 *   2. lib/supabase/schema.sql re-applied so sentiment_posts + sentiment_scores exist.
 */

import { parseArgs } from "node:util";

import { config as loadEnv } from "dotenv";

import { fetchSubredditRss, type RedditPost } from "@/lib/reddit";
import { classifyPosts, type Classification } from "@/lib/sentiment";
import { getServiceSupabase } from "@/lib/supabase/server";
import { DEFAULT_SUBREDDITS } from "@/lib/teams";

loadEnv({ path: ".env.local" });

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type Args = {
  subreddits: string[];
  maxPerSub: number;
  sinceDays: number;
  limit: number | undefined;
  dryRun: boolean;
};

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: tsx scripts/sentiment.ts [--subreddits a,b,c] [--max-per-sub N] [--since-days N] [--limit N] [--dry-run]",
      "",
      "Options:",
      `  --subreddits <csv>    Comma-separated subreddits. Default: ${DEFAULT_SUBREDDITS.join(",")}`,
      "  --max-per-sub <N>     Max posts to fetch per subreddit (1-100). Default 100.",
      "  --since-days <N>      Drop posts older than N days. Default 7.",
      "  --limit <N>           Cap total posts across all subreddits (smoke test).",
      "  --dry-run             Fetch + classify but do NOT write to Supabase.",
      "  --help                Show this message and exit.",
      "",
    ].join("\n"),
  );
}

function parseCli(): Args {
  const parsed = parseArgs({
    options: {
      subreddits: { type: "string" },
      "max-per-sub": { type: "string" },
      "since-days": { type: "string" },
      limit: { type: "string" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    printHelp();
    process.exit(0);
  }

  const subreddits = parsed.values.subreddits
    ? parsed.values.subreddits.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_SUBREDDITS];
  if (subreddits.length === 0) {
    throw new Error("At least one subreddit required.");
  }

  const maxPerSub = parsed.values["max-per-sub"]
    ? Number(parsed.values["max-per-sub"])
    : 100;
  if (!Number.isFinite(maxPerSub) || maxPerSub < 1 || maxPerSub > 100) {
    throw new Error(`Invalid --max-per-sub: ${parsed.values["max-per-sub"]} (must be 1..100)`);
  }

  const sinceDays = parsed.values["since-days"]
    ? Number(parsed.values["since-days"])
    : 7;
  if (!Number.isFinite(sinceDays) || sinceDays < 1) {
    throw new Error(`Invalid --since-days: ${parsed.values["since-days"]}`);
  }

  const limit = parsed.values.limit ? Number(parsed.values.limit) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    throw new Error(`Invalid --limit: ${parsed.values.limit}`);
  }

  return {
    subreddits,
    maxPerSub,
    sinceDays,
    limit,
    dryRun: Boolean(parsed.values["dry-run"]),
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function existingPostIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("sentiment_posts")
    .select("id")
    .in("id", ids);
  if (error) throw new Error(`Supabase lookup failed: ${error.message}`);
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}

async function upsertPosts(
  posts: RedditPost[],
  classifications: Classification[],
): Promise<string[]> {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const rows = classifications
    .filter((c) => byId.has(c.post_id))
    .map((c) => {
      const p = byId.get(c.post_id);
      if (!p) throw new Error("unreachable: post missing for classification");
      return {
        id: p.id,
        subreddit: p.subreddit,
        title: p.title,
        url: p.url || null,
        posted_at: p.posted_at.toISOString(),
        polarity: c.polarity,
        teams: c.teams,
        raw: { summary: p.summary },
      };
    });
  if (rows.length === 0) return [];

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("sentiment_posts")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  const affected = new Set<string>();
  for (const c of classifications) for (const t of c.teams) affected.add(t);
  return [...affected];
}

async function refreshScores(affectedTeams: string[]): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.rpc("refresh_sentiment_scores", {
    team_filter: affectedTeams.length > 0 ? affectedTeams : null,
    date_filter: null,
  });
  if (error) throw new Error(`refresh_sentiment_scores failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseCli();

  process.stdout.write(
    `\n[sentiment] subs=${args.subreddits.join(",")} max-per-sub=${args.maxPerSub} ` +
      `since-days=${args.sinceDays}${args.limit ? ` limit=${args.limit}` : ""}` +
      `${args.dryRun ? " (dry-run)" : ""}\n`,
  );

  // 1. Fetch.
  const cutoff = new Date(Date.now() - args.sinceDays * 24 * 60 * 60 * 1000);
  const allPosts: RedditPost[] = [];
  for (const sub of args.subreddits) {
    try {
      const posts = await fetchSubredditRss(sub, { limit: args.maxPerSub });
      const fresh = posts.filter((p) => p.posted_at >= cutoff);
      process.stdout.write(
        `[sentiment] r/${sub}: fetched=${posts.length} fresh=${fresh.length}\n`,
      );
      allPosts.push(...fresh);
      if (args.limit !== undefined && allPosts.length >= args.limit) break;
    } catch (err) {
      // One failed feed shouldn't kill the run.
      process.stderr.write(
        `[sentiment] WARN r/${sub}: ${(err as Error).message}\n`,
      );
    }
  }
  if (args.limit !== undefined) allPosts.splice(args.limit);

  if (allPosts.length === 0) {
    process.stdout.write(`[sentiment] no fresh posts; nothing to do.\n`);
    return;
  }

  // 2. Dedup against DB (skip in dry-run).
  let toClassify = allPosts;
  if (!args.dryRun) {
    const known = await existingPostIds(allPosts.map((p) => p.id));
    toClassify = allPosts.filter((p) => !known.has(p.id));
    process.stdout.write(
      `[sentiment] dedup: total=${allPosts.length} new=${toClassify.length} skipped=${allPosts.length - toClassify.length}\n`,
    );
  } else {
    process.stdout.write(`[sentiment] dry-run: skipping DB dedup.\n`);
  }

  if (toClassify.length === 0) {
    process.stdout.write(`[sentiment] nothing new to classify.\n`);
    return;
  }

  // 3. Classify.
  process.stdout.write(`[sentiment] classifying ${toClassify.length} posts via Gemini...\n`);
  const classifications = await classifyPosts(toClassify);
  const withTeams = classifications.filter((c) => c.teams.length > 0).length;
  process.stdout.write(
    `[sentiment] classified=${classifications.length} with_teams=${withTeams}\n`,
  );

  if (args.dryRun) {
    const sample = classifications.slice(0, 5);
    process.stdout.write(`[sentiment] dry-run sample:\n`);
    for (const c of sample) {
      process.stdout.write(`  ${c.post_id} -> ${c.polarity}  teams=[${c.teams.join(", ")}]\n`);
    }
    return;
  }

  // 4. Upsert + refresh.
  const affected = await upsertPosts(toClassify, classifications);
  process.stdout.write(
    `[sentiment] upserted; affected_teams=${affected.length}: ${affected.slice(0, 8).join(", ")}${affected.length > 8 ? ", ..." : ""}\n`,
  );

  await refreshScores(affected);
  process.stdout.write(`[sentiment] refreshed sentiment_scores. done.\n`);
}

main().catch((err) => {
  process.stderr.write(
    `[sentiment] FAILED: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});
