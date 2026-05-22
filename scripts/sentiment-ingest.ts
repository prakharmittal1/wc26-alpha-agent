/**
 * Pre-fetch news headlines for dashboard fixtures (warms file cache).
 *
 *   npm run sentiment:ingest
 *
 * Requires GNEWS_API_KEY and/or NEWS_API_KEY in .env.local — see README.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local") });

import { loadDashboardFixtures } from "@/lib/live-fixtures";
import { gatherMatchSentiment, isSentimentConfigured } from "@/lib/sentiment/gather";

async function main() {
  if (!isSentimentConfigured()) {
    console.error(
      "No news APIs configured. Add GNEWS_API_KEY and/or NEWS_API_KEY to .env.local (see README).",
    );
    process.exit(1);
  }

  const { fixtures } = await loadDashboardFixtures();
  console.log(`Warming news cache for ${fixtures.length} fixtures…`);

  let ok = 0;
  let empty = 0;

  for (const f of fixtures) {
    const snap = await gatherMatchSentiment(f.home, f.away, f.kickoff_iso, {
      useCache: false,
    });
    if (!snap) continue;
    if (snap.post_count > 0) {
      ok += 1;
      console.log(`  ✓ ${f.home} vs ${f.away}: ${snap.post_count} headlines`);
    } else {
      empty += 1;
      console.log(`  · ${f.home} vs ${f.away}: none`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`Done. ${ok} with headlines, ${empty} empty. Cache: data/processed/sentiment-cache/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
