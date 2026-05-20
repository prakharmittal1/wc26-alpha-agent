/**
 * Fixtures shared by the dashboard and match breakdown UI.
 *
 * Prefer `GET /api/matches` (or `lib/live-fixtures#getCachedDashboardFixtures`)
 * for rows backed by football-data.org + Gamma Polymarket.
 *
 * Bundled JSON / hard-coded stubs when `FOOTBALL_DATA_ORG_TOKEN` is unset.
 */

import { tileCityForFixture } from "@/lib/match-context";
import { lookupWc26ScheduledVenue } from "@/lib/wc26-schedule";
import type { Wc2026Team } from "@/lib/teams";

export type FixturePriceSource = "polymarket" | "none";

export type MarketThreeWay = {
  home: number;
  draw: number;
  away: number;
};

export type Fixture = {
  id: string;
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition: string;
  /** Polymarket home-win implied probability (0–1). */
  market_home_win: number;
  market_draw?: number | null;
  market_away_win?: number | null;
  market_three_way?: MarketThreeWay | null;
  /** Gamma-enriched shard vs illustrative/neutral filler. */
  market_price_source?: FixturePriceSource;
  polymarket_event_slug?: string | null;
  /** @deprecated Use polymarket_event_slug */
  polymarket_market_slug?: string | null;
  is_world_cup?: boolean;
  venue?: string | null;
};

/** Hydration provenance surfaced by `/` + `GET /api/matches`. */
export type FixtureFeedSource =
  | "polymarket"
  | "polymarket+football-data-org"
  | "football-data-org+polymarket"
  | "football-data-org"
  | "bundled+polymarket"
  | "bundled"
  | "fallback"
  | "fixtures-stubs";

export type FixtureFeedMeta = {
  source: FixtureFeedSource;
  detail?: string;
};

export const UPCOMING_FIXTURES: Fixture[] = [
  {
    id: "fx-001",
    home: "Mexico",
    away: "United States",
    kickoff_iso: "2026-05-23T01:00:00Z",
    competition: "International friendly",
    venue: "Estadio Azteca, Mexico City",
    market_home_win: 0.46,
    market_price_source: "none",
  },
  {
    id: "fx-002",
    home: "Brazil",
    away: "Argentina",
    kickoff_iso: "2026-05-29T22:30:00Z",
    competition: "Superclásico friendly",
    market_home_win: 0.52,
    market_price_source: "none",
  },
  {
    id: "fx-003",
    home: "Germany",
    away: "France",
    kickoff_iso: "2026-06-04T19:00:00Z",
    competition: "Euro tune-up",
    market_home_win: 0.41,
    market_price_source: "none",
  },
  {
    id: "fx-004",
    home: "Japan",
    away: "South Korea",
    kickoff_iso: "2026-06-07T10:00:00Z",
    competition: "AFC friendly",
    market_home_win: 0.55,
    market_price_source: "none",
  },
  {
    id: "fx-005",
    home: "Morocco",
    away: "Nigeria",
    kickoff_iso: "2026-06-10T20:00:00Z",
    competition: "CAF tune-up",
    market_home_win: 0.48,
    market_price_source: "none",
  },
  {
    id: "fx-006",
    home: "Netherlands",
    away: "Belgium",
    kickoff_iso: "2026-06-12T18:45:00Z",
    competition: "International friendly",
    market_home_win: 0.50,
    market_price_source: "none",
  },
];

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Short kickoff for match list tiles (e.g. "12:00 PM"). */
export function formatKickoffTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Tile subtitle (e.g. "Wed, Jun 17, 1:00 PM"). */
export function formatKickoffTile(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/** Short venue for match tiles (prefer city after comma). */
export function formatVenueTile(venue: string | null | undefined): string | null {
  if (!venue?.trim()) return null;
  const parts = venue
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const label = parts.length >= 2 ? parts[parts.length - 1]! : venue.trim();
  return label.length > 36 ? `${label.slice(0, 34)}…` : label;
}

/** City line for dashboard tiles (API field, then WC host-city inference). */
export function resolveFixtureVenueTile(
  f: Pick<Fixture, "home" | "away" | "kickoff_iso" | "competition" | "venue" | "is_world_cup">,
): string {
  const fromApi = formatVenueTile(f.venue);
  if (fromApi) return fromApi;

  const isWc = f.is_world_cup ?? /world cup|fifa/i.test(f.competition ?? "");

  if (isWc) {
    const scheduled = lookupWc26ScheduledVenue(f.home, f.away, f.kickoff_iso);
    if (scheduled) return scheduled.city;
  }

  const city = tileCityForFixture({
    home: f.home,
    away: f.away,
    kickoff_iso: f.kickoff_iso,
    competition: f.competition,
    venue: f.venue,
    is_world_cup: isWc,
  });
  if (city) return city;

  return "—";
}

/** Date line for match list tiles (e.g. "Wed, Jun 11"). */
export function formatKickoffDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
