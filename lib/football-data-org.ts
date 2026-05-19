/**
 * Live fixtures via football-data.org v4 (free tier).
 * https://www.football-data.org/client/register
 */

import type { FootballFixtureBrief } from "@/lib/football-fixtures";
import { canonicalizeTeam, WC2026_TEAMS, type Wc2026Team } from "@/lib/teams";

const WC_SET = new Set<string>(WC2026_TEAMS as unknown as string[]);

const DEFAULT_COMPETITION_CODES =
  process.env.FOOTBALL_DATA_ORG_COMPETITIONS ??
  "WC,EC";

const UPCOMING_STATUSES = new Set([
  "SCHEDULED",
  "TIMED",
  "POSTPONED",
  "IN_PLAY",
  "PAUSED",
]);

type FdoTeam = { name?: string | null; shortName?: string | null };

type FdoMatch = {
  id: number;
  utcDate?: string | null;
  status?: string | null;
  competition?: { name?: string | null; code?: string | null } | null;
  homeTeam?: FdoTeam | null;
  awayTeam?: FdoTeam | null;
};

type FdoMatchesResponse = {
  matches?: FdoMatch[] | null;
  message?: string;
  errorCode?: number;
};

function getToken(): string {
  const token = process.env.FOOTBALL_DATA_ORG_TOKEN?.trim();
  if (!token) throw new Error("FOOTBALL_DATA_ORG_TOKEN is not configured");
  return token;
}

function teamLabel(t: FdoTeam | null | undefined): string | null {
  if (!t) return null;
  const n = (t.name ?? "").trim();
  const s = (t.shortName ?? "").trim();
  return n || s || null;
}

function resolveWcTeam(t: FdoTeam | null | undefined): Wc2026Team | null {
  if (!t) return null;
  const primary = (t.name ?? "").trim();
  const short = (t.shortName ?? "").trim();
  const candidates = [primary, primary.replace(/^The\s+/i, ""), short].filter(Boolean);
  for (const raw of candidates) {
    const c = canonicalizeTeam(raw);
    if (c) return c;
  }
  return null;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function classifyMatch(
  row: FdoMatch,
  options?: { forceWorldCup?: boolean },
): FootballFixtureBrief | null {
  const id = row.id;
  const utc = row.utcDate?.trim();
  const homeRaw = teamLabel(row.homeTeam);
  const awayRaw = teamLabel(row.awayTeam);
  const compCode = row.competition?.code?.trim().toUpperCase() ?? "";
  const compName = row.competition?.name?.trim() ?? compCode ?? "Match";
  const st = (row.status ?? "").trim().toUpperCase();

  if (!Number.isFinite(id) || !utc || !homeRaw || !awayRaw) return null;
  if (!UPCOMING_STATUSES.has(st)) return null;

  const homeTeam = resolveWcTeam(row.homeTeam);
  const awayTeam = resolveWcTeam(row.awayTeam);
  if (!homeTeam || !awayTeam || homeTeam === awayTeam) return null;
  if (!WC_SET.has(homeTeam) || !WC_SET.has(awayTeam)) return null;

  const kick = new Date(utc);
  if (!Number.isFinite(kick.getTime())) return null;
  if (kick.getTime() <= Date.now() - 60_000) return null;

  const isWorldCup =
    options?.forceWorldCup === true || compCode === "WC" || /world cup/i.test(compName);

  return {
    id,
    kickoff_iso: kick.toISOString(),
    home_api_name: homeRaw,
    away_api_name: awayRaw,
    home_team: homeTeam,
    away_team: awayTeam,
    competition: isWorldCup ? `FIFA World Cup` : `${compName}`,
    is_world_cup: isWorldCup,
  };
}

async function fdoGet(path: string, params?: Record<string, string>): Promise<FdoMatch[]> {
  const token = getToken();
  const url = new URL(`https://api.football-data.org/v4${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { "X-Auth-Token": token, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json()) as FdoMatchesResponse;
  if (!res.ok) {
    const msg = json.message ?? res.statusText;
    throw new Error(`football-data.org ${res.status}: ${msg}`);
  }
  if (json.message && !json.matches) {
    throw new Error(`football-data.org: ${json.message}`);
  }
  return json.matches ?? [];
}

/** All upcoming WC matches from the competition endpoint (best for WC 2026). */
export async function fetchWorldCupMatches(): Promise<FootballFixtureBrief[]> {
  const rows = await fdoGet("/competitions/WC/matches");
  const out: FootballFixtureBrief[] = [];
  for (const row of rows) {
    const brief = classifyMatch(row, { forceWorldCup: true });
    if (brief) out.push(brief);
  }
  out.sort((a, b) => Date.parse(a.kickoff_iso) - Date.parse(b.kickoff_iso));
  return out;
}

async function fetchMatchesInWindow(
  fromUtc: Date,
  toUtc: Date,
  competitions: string,
): Promise<FootballFixtureBrief[]> {
  const rows = await fdoGet("/matches", {
    dateFrom: formatDate(fromUtc),
    dateTo: formatDate(toUtc),
    competitions: competitions.replace(/\s+/g, ""),
  });
  const out: FootballFixtureBrief[] = [];
  for (const row of rows) {
    const brief = classifyMatch(row);
    if (brief) out.push(brief);
  }
  return out;
}

function mergeFixtures(lists: FootballFixtureBrief[][]): FootballFixtureBrief[] {
  const byId = new Map<number, FootballFixtureBrief>();
  for (const list of lists) {
    for (const row of list) {
      const prev = byId.get(row.id);
      if (!prev || (row.is_world_cup && !prev.is_world_cup)) {
        byId.set(row.id, row);
      }
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.is_world_cup !== b.is_world_cup) {
      return a.is_world_cup ? -1 : 1;
    }
    return Date.parse(a.kickoff_iso) - Date.parse(b.kickoff_iso);
  });
}

/**
 * WC competition matches first, then other configured comps (EC friendlies, etc.).
 */
export async function fetchWcEligibleFixturesFromFootballData(
  fromUtc: Date,
  toUtc: Date,
): Promise<FootballFixtureBrief[]> {
  const comps = DEFAULT_COMPETITION_CODES.replace(/\s+/g, "");

  const [wcDirect, windowed] = await Promise.all([
    fetchWorldCupMatches().catch(() => [] as FootballFixtureBrief[]),
    fetchMatchesInWindow(fromUtc, toUtc, comps),
  ]);

  return mergeFixtures([wcDirect, windowed]);
}
