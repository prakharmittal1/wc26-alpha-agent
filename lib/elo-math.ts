export type EloRatingsFile = {
  built_at: string;
  source: string;
  ratings: Record<string, number>;
};
import type { Wc2026Team } from "@/lib/teams";

export const DEFAULT_ELO = 1500;
export const HOME_ADVANTAGE_ELO = 65;
export const ELO_SCALE = 400;

export function getTeamElo(team: Wc2026Team, ratings: EloRatingsFile): number {
  return ratings.ratings[team] ?? DEFAULT_ELO;
}

export function homeWinProbability(
  home: Wc2026Team,
  away: Wc2026Team,
  ratings: EloRatingsFile,
  homeAdvantage = HOME_ADVANTAGE_ELO,
): number {
  const rHome = getTeamElo(home, ratings);
  const rAway = getTeamElo(away, ratings);
  const exponent = -(rHome + homeAdvantage - rAway) / ELO_SCALE;
  const p = 1 / (1 + Math.pow(10, exponent));
  return clampProbability(p);
}

export function clampProbability(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}
