import type { Wc2026Team } from "@/lib/teams";

/** Short names for news search APIs. */
const SEARCH_ALIASES: Partial<Record<Wc2026Team, string[]>> = {
  "United States": ["USA", "USMNT", "America"],
  Netherlands: ["Holland", "Oranje"],
  "South Korea": ["Korea", "KOR"],
  "Ivory Coast": ["CIV", "Côte d'Ivoire"],
};

export function searchTermsForTeam(team: Wc2026Team): string[] {
  const aliases = SEARCH_ALIASES[team] ?? [];
  return [team, ...aliases];
}

export function newsSearchQuery(home: Wc2026Team, away: Wc2026Team): string {
  const h = searchTermsForTeam(home)[0]!;
  const a = searchTermsForTeam(away)[0]!;
  return `${h} ${a} World Cup 2026`;
}
