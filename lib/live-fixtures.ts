/**
 * Hydrates dashboard fixtures: football-data.org (free) + Polymarket Gamma,
 * with bundled JSON fallback when no token is set.
 */

import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unstable_cache } from "next/cache";

import type { FootballFixtureBrief } from "@/lib/football-fixtures";
import { fetchWcEligibleFixturesFromFootballData } from "@/lib/football-data-org";
import {
  type Fixture,
  type FixtureFeedMeta,
  type FixtureFeedSource,
  type FixturePriceSource,
  UPCOMING_FIXTURES,
} from "@/lib/fixtures";
import { quoteHomeMoneylineYes } from "@/lib/polymarket-prices";

const RANGE_DAYS = 120;
const MAX_POLY_ENRICH = 14;
const DISPLAY_CAP = 12;

export type FixturesBootstrap = FixtureFeedMeta & { fixtures: Fixture[] };

function loadBundledBriefs(): FootballFixtureBrief[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), "data", "bundled-fixtures.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as {
      fixtures?: Array<{
        id: string;
        home: string;
        away: string;
        kickoff_iso: string;
        competition: string;
      }>;
    };
    return (parsed.fixtures ?? []).map((f, i) => ({
      id: Number(String(f.id).replace(/\D/g, "")) || 9000 + i,
      kickoff_iso: f.kickoff_iso,
      home_api_name: f.home,
      away_api_name: f.away,
      home_team: f.home as FootballFixtureBrief["home_team"],
      away_team: f.away as FootballFixtureBrief["away_team"],
      competition: f.competition,
    }));
  } catch {
    return UPCOMING_FIXTURES.map((f, i) => ({
      id: 9000 + i,
      kickoff_iso: f.kickoff_iso,
      home_api_name: f.home,
      away_api_name: f.away,
      home_team: f.home,
      away_team: f.away,
      competition: f.competition,
    }));
  }
}

async function enrichBriefsWithPolymarket(
  briefs: FootballFixtureBrief[],
): Promise<{ fixtures: Fixture[]; hasPolymarket: boolean }> {
  const slice = briefs.slice(0, MAX_POLY_ENRICH);
  const enriched: Fixture[] = [];

  for (const row of slice) {
    let priceSrc: FixturePriceSource = "none";
    let homeWin = 0.5;
    let slug: string | null = null;

    try {
      const quote = await quoteHomeMoneylineYes(
        row.home_team,
        row.away_team,
        row.kickoff_iso,
      );
      if (quote?.price !== undefined && Number.isFinite(quote.price)) {
        homeWin = quote.price;
        priceSrc = "polymarket";
        slug = quote.market_slug ?? null;
      }
    } catch {
      homeWin = 0.5;
      priceSrc = "none";
    }

    enriched.push({
      id: `fx-${row.id}`,
      home: row.home_team,
      away: row.away_team,
      kickoff_iso: row.kickoff_iso,
      competition: row.competition,
      market_home_win: Number(homeWin.toFixed(4)),
      market_price_source: priceSrc,
      polymarket_market_slug: slug,
      is_world_cup: row.is_world_cup,
    });
  }

  enriched.sort((a, b) => Date.parse(a.kickoff_iso) - Date.parse(b.kickoff_iso));
  const hasPolymarket = enriched.some((x) => x.market_price_source === "polymarket");
  return {
    fixtures: enriched.slice(0, DISPLAY_CAP),
    hasPolymarket,
  };
}

export async function loadDashboardFixtures(): Promise<FixturesBootstrap> {
  const stubDetail =
    "No FOOTBALL_DATA_ORG_TOKEN — showing bundled demo fixtures. Register free at https://www.football-data.org/client/register";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const to = new Date(today.getTime());
  to.setUTCDate(to.getUTCDate() + RANGE_DAYS);

  let briefs: FootballFixtureBrief[] = [];
  let backend: "football-data-org" | "bundled" | null = null;

  if (process.env.FOOTBALL_DATA_ORG_TOKEN?.trim()) {
    backend = "football-data-org";
    try {
      briefs = await fetchWcEligibleFixturesFromFootballData(today, to);
    } catch (err) {
      return {
        fixtures: UPCOMING_FIXTURES,
        source: "fallback",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    backend = "bundled";
    briefs = loadBundledBriefs();
    if (briefs.length === 0) {
      return {
        fixtures: UPCOMING_FIXTURES,
        source: "fixtures-stubs",
        detail: stubDetail,
      };
    }
    return finishBootstrap(briefs, "bundled", stubDetail);
  }

  if (briefs.length === 0) {
    briefs = loadBundledBriefs();
    return finishBootstrap(
      briefs.length > 0 ? briefs : [],
      "fallback",
      "football-data.org returned no WC-eligible fixtures in this window — using bundled fixtures.",
    );
  }

  return finishBootstrap(
    briefs,
    backend === "football-data-org" ? "football-data-org" : "bundled",
    undefined,
  );
}

async function finishBootstrap(
  briefs: FootballFixtureBrief[],
  backend: "football-data-org" | "bundled" | "fallback",
  detail?: string,
): Promise<FixturesBootstrap> {
  if (briefs.length === 0) {
    return {
      fixtures: UPCOMING_FIXTURES,
      source: "fixtures-stubs",
      detail: detail ?? "No fixtures available.",
    };
  }

  const { fixtures, hasPolymarket } = await enrichBriefsWithPolymarket(briefs);
  let source: FixtureFeedSource;
  if (backend === "football-data-org") {
    source = hasPolymarket ? "football-data-org+polymarket" : "football-data-org";
  } else if (backend === "bundled") {
    source = hasPolymarket ? "bundled+polymarket" : "bundled";
  } else {
    source = "fallback";
  }

  return {
    fixtures,
    source,
    detail:
      detail ??
      (!hasPolymarket
        ? "No matching Polymarket home-win shards — gauges show neutral placeholders."
        : undefined),
  };
}

const cachedDashboardFixtures = unstable_cache(
  async () => loadDashboardFixtures(),
  ["dashboard-fixtures-lite-v2-wc-rag"],
  { revalidate: 300 },
);

export async function getCachedDashboardFixtures(): Promise<FixturesBootstrap> {
  return cachedDashboardFixtures();
}
