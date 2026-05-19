/**
 * Fixtures shared by `/` + `/api/chat` prompts + `ProbabilityGauge`.
 *
 * Prefer `GET /api/matches` (or `lib/live-fixtures#getCachedDashboardFixtures`)
 * for rows backed by football-data.org + Gamma Polymarket.
 *
 * Bundled JSON / hard-coded stubs when `FOOTBALL_DATA_ORG_TOKEN` is unset.
 */

import type { Wc2026Team } from "@/lib/teams";

export type FixturePriceSource = "polymarket" | "none";

export type Fixture = {
  id: string;
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition: string;
  /** Polymarket YES-implied P(home win) when Gamma matched an active shard. */
  market_home_win: number;
  /** Gamma-enriched shard vs illustrative/neutral filler. */
  market_price_source?: FixturePriceSource;
  polymarket_market_slug?: string | null;
  is_world_cup?: boolean;
};

/** Hydration provenance surfaced by `/` + `GET /api/matches`. */
export type FixtureFeedSource =
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
