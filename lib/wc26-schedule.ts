import venuesData from "@/data/wc26-match-venues.json";
import type { Wc2026Team } from "@/lib/teams";
import { canonicalizeTeam } from "@/lib/teams";

export type Wc26ScheduledVenue = {
  home: Wc2026Team;
  away: Wc2026Team;
  date: string;
  location: string;
  city: string;
  group?: string;
};

function matchKey(home: string, away: string, date: string): string {
  return `${home}|${away}|${date}`;
}

const INDEX: Map<string, Wc26ScheduledVenue> = (() => {
  const map = new Map<string, Wc26ScheduledVenue>();
  for (const row of venuesData.matches) {
    const home = canonicalizeTeam(row.home);
    const away = canonicalizeTeam(row.away);
    if (!home || !away) continue;
    map.set(matchKey(home, away, row.date), {
      home,
      away,
      date: row.date,
      location: row.location,
      city: row.city,
      ...(row.group ? { group: row.group } : {}),
    });
  }
  return map;
})();

export function kickoffDateUtc(iso: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Official WC 2026 stadium/city (fixturedownload.com / FIFA schedule).
 * Keyed by home, away, and UTC kickoff date (matches Polymarket event slugs).
 */
export function lookupWc26ScheduledVenue(
  home: Wc2026Team,
  away: Wc2026Team,
  kickoff_iso: string,
): Wc26ScheduledVenue | null {
  const date = kickoffDateUtc(kickoff_iso);
  if (!date) return null;
  return INDEX.get(matchKey(home, away, date)) ?? null;
}
