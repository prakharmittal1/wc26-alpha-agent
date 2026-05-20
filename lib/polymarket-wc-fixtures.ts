import "server-only";

import {
  FIFA_WC_SERIES_ID,
  type GammaEvent,
  type ParsedWcGame,
  gammaGetEvents,
  parseThreeWayFromEvent,
} from "@/lib/polymarket-gamma";

const PAGE_SIZE = 100;
const MAX_PAGES = 3;

/**
 * FIFA World Cup match list from Polymarket (same series as polymarket.com/sports/fifa-world-cup/games).
 * Uses Gamma `series_id=11433` (soccer-fifwc).
 */
export async function fetchPolymarketWcGames(): Promise<ParsedWcGame[]> {
  const all: GammaEvent[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await gammaGetEvents({
      series_id: FIFA_WC_SERIES_ID,
      active: "true",
      closed: "false",
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const games: ParsedWcGame[] = [];
  const seen = new Set<string>();

  for (const ev of all) {
    const parsed = parseThreeWayFromEvent(ev);
    if (!parsed) continue;
    const key = `${parsed.home}|${parsed.away}|${parsed.kickoff_iso.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kick = Date.parse(parsed.kickoff_iso);
    if (!Number.isFinite(kick) || kick <= Date.now() - 3_600_000) continue;

    games.push(parsed);
  }

  games.sort((a, b) => Date.parse(a.kickoff_iso) - Date.parse(b.kickoff_iso));
  return games;
}
