/**
 * Hard-coded upcoming-fixture stubs for the dashboard while the football
 * MCP isn't wired into the server-side `/` page (it's a Server Component;
 * MCP spawn lives in the chat route instead).
 *
 * Replace this with a server-side fetch off API-Football once you have a
 * RAPIDAPI_KEY filled - or fetch them via `/api/fixtures` in Phase 5.
 */

import type { Wc2026Team } from "@/lib/teams";

export type Fixture = {
  id: string;
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition: string;
  /** Polymarket-style indicative YES price for the home-win contract. */
  market_home_win: number;
};

export const UPCOMING_FIXTURES: Fixture[] = [
  {
    id: "fx-001",
    home: "Mexico",
    away: "United States",
    kickoff_iso: "2026-05-23T01:00:00Z",
    competition: "International friendly",
    market_home_win: 0.46,
  },
  {
    id: "fx-002",
    home: "Brazil",
    away: "Argentina",
    kickoff_iso: "2026-05-29T22:30:00Z",
    competition: "Superclásico friendly",
    market_home_win: 0.52,
  },
  {
    id: "fx-003",
    home: "Germany",
    away: "France",
    kickoff_iso: "2026-06-04T19:00:00Z",
    competition: "Euro tune-up",
    market_home_win: 0.41,
  },
  {
    id: "fx-004",
    home: "Japan",
    away: "South Korea",
    kickoff_iso: "2026-06-07T10:00:00Z",
    competition: "AFC friendly",
    market_home_win: 0.55,
  },
  {
    id: "fx-005",
    home: "Morocco",
    away: "Nigeria",
    kickoff_iso: "2026-06-10T20:00:00Z",
    competition: "CAF tune-up",
    market_home_win: 0.48,
  },
  {
    id: "fx-006",
    home: "Netherlands",
    away: "Belgium",
    kickoff_iso: "2026-06-12T18:45:00Z",
    competition: "International friendly",
    market_home_win: 0.50,
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
