import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  clampProbability,
  DEFAULT_ELO,
  getTeamElo as ratingForTeam,
  HOME_ADVANTAGE_ELO,
  homeWinProbability as homeWinFromRatings,
  type EloRatingsFile,
} from "@/lib/elo-math";
import { canonicalizeTeam, type Wc2026Team } from "@/lib/teams";

export {
  clampProbability,
  DEFAULT_ELO,
  ELO_SCALE,
  HOME_ADVANTAGE_ELO,
} from "@/lib/elo-math";

export type { EloRatingsFile } from "@/lib/elo-math";

export type H2hRecord = {
  home_wins: number;
  away_wins: number;
  draws: number;
  total: number;
};

export type H2hIndexFile = {
  built_at: string;
  pairs: Record<string, H2hRecord>;
};

let cachedRatings: EloRatingsFile | null = null;
let cachedH2h: H2hIndexFile | null = null;

function dataPath(...parts: string[]): string {
  return join(process.cwd(), "data", "processed", ...parts);
}

function loadJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadEloRatings(): EloRatingsFile {
  if (cachedRatings) return cachedRatings;
  const fromDisk = loadJson<EloRatingsFile>(dataPath("elo-ratings.json"));
  cachedRatings = fromDisk ?? {
    built_at: "fallback",
    source: "inline-default",
    ratings: {},
  };
  return cachedRatings;
}

export function loadH2hIndex(): H2hIndexFile {
  if (cachedH2h) return cachedH2h;
  cachedH2h = loadJson<H2hIndexFile>(dataPath("h2h-index.json")) ?? {
    built_at: "fallback",
    pairs: {},
  };
  return cachedH2h;
}

export function getTeamElo(team: Wc2026Team, ratings?: EloRatingsFile): number {
  return ratingForTeam(team, ratings ?? loadEloRatings());
}

export function homeWinProbability(
  home: Wc2026Team,
  away: Wc2026Team,
  options?: { homeAdvantage?: number; ratings?: EloRatingsFile },
): number {
  const ratings = options?.ratings ?? loadEloRatings();
  return homeWinFromRatings(home, away, ratings, options?.homeAdvantage);
}

function h2hKey(home: Wc2026Team, away: Wc2026Team): string {
  return `${home}|${away}`;
}

export function h2hAdjustment(home: Wc2026Team, away: Wc2026Team): number {
  const idx = loadH2hIndex();
  const rec = idx.pairs[h2hKey(home, away)];
  if (!rec || rec.total < 3) return 0;
  const homeRate = (rec.home_wins + 0.5 * rec.draws) / rec.total;
  return (homeRate - 0.5) * 0.06;
}

export function eloForName(name: string): number | null {
  const team = canonicalizeTeam(name);
  if (!team) return null;
  return getTeamElo(team);
}
