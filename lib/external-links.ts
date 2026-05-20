/** Official FIFA World Cup 2026 scores & fixtures (schedule source of truth). */
export const FIFA_WC_2026_FIXTURES_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL";

export const POLYMARKET_WC_GAMES_URL =
  "https://polymarket.com/sports/fifa-world-cup/games";

export const POLYMARKET_WC_PROPS_URL =
  "https://polymarket.com/sports/fifa-world-cup/props";

/** This match on Polymarket, or the WC games hub if slug is missing. */
export function polymarketMatchUrl(eventSlug: string | null | undefined): string {
  const slug = eventSlug?.trim();
  if (slug) {
    return `https://polymarket.com/event/${encodeURIComponent(slug)}`;
  }
  return POLYMARKET_WC_GAMES_URL;
}
