import type { Wc2026Team } from "@/lib/teams";

/** Normalized row from football-data.org before Polymarket enrichment. */
export type FootballFixtureBrief = {
  id: number;
  kickoff_iso: string;
  home_api_name: string;
  away_api_name: string;
  home_team: Wc2026Team;
  away_team: Wc2026Team;
  competition: string;
  /** FIFA World Cup competition from football-data.org */
  is_world_cup?: boolean;
};
