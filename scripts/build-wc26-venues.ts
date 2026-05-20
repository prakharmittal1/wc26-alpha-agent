/**
 * Build data/wc26-match-venues.json from fixturedownload.com FIFA WC 2026 feed.
 *
 *   npm run wc26:venues
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { cityFromScheduleLocation } from "@/lib/wc26-schedule-locations";
import { canonicalizeTeam } from "@/lib/teams";

const FEED_URL = "https://fixturedownload.com/feed/json/fifa-world-cup-2026";

type FeedMatch = {
  DateUtc: string;
  Location: string;
  HomeTeam: string;
  AwayTeam: string;
  Group?: string;
  MatchNumber?: number;
};

type VenueRow = {
  home: string;
  away: string;
  date: string;
  location: string;
  city: string;
  group?: string;
  match_number?: number;
};

function dateFromUtc(dateUtc: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(dateUtc.trim());
  return m?.[1] ?? null;
}

async function main() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const raw = (await res.json()) as FeedMatch[];

  const matches: VenueRow[] = [];

  for (const row of raw) {
    const home = canonicalizeTeam(row.HomeTeam);
    const away = canonicalizeTeam(row.AwayTeam);
    const date = dateFromUtc(row.DateUtc);
    const city = cityFromScheduleLocation(row.Location);
    if (!home || !away || !date || !city) continue;

    matches.push({
      home,
      away,
      date,
      location: row.Location,
      city,
      ...(row.Group ? { group: row.Group } : {}),
      ...(row.MatchNumber != null ? { match_number: row.MatchNumber } : {}),
    });
  }

  const out = {
    built_at: new Date().toISOString().slice(0, 10),
    source: FEED_URL,
    match_count: matches.length,
    matches,
  };

  const path = join(process.cwd(), "data", "wc26-match-venues.json");
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${matches.length} venue rows → ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
