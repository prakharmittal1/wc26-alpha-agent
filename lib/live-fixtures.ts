/**
 * Dashboard fixtures: Polymarket WC games (primary), football-data.org fallback,
 * bundled JSON when offline.
 */

import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unstable_cache } from "next/cache";

import type { FootballFixtureBrief } from "@/lib/football-fixtures";
import { fetchWcEligibleFixturesFromFootballData } from "@/lib/football-data-org";
import { fetchPolymarketWcGames } from "@/lib/polymarket-wc-fixtures";
import {
  type Fixture,
  type FixtureFeedMeta,
  type FixtureFeedSource,
  type FixturePriceSource,
  UPCOMING_FIXTURES,
} from "@/lib/fixtures";
import { resolveMatchContext } from "@/lib/match-context";
import { lookupWc26ScheduledVenue } from "@/lib/wc26-schedule";
import { quoteHomeMoneylineYes } from "@/lib/polymarket-prices";

const RANGE_DAYS = 120;
const DISPLAY_CAP = 24;

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
        venue?: string | null;
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
      venue: f.venue ?? null,
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
      venue: f.venue ?? null,
    }));
  }
}

function polyGameToFixture(game: Awaited<ReturnType<typeof fetchPolymarketWcGames>>[number]): Fixture {
  const competition = "FIFA World Cup";
  const draft: Fixture = {
    id: `poly-${game.event_id}`,
    home: game.home,
    away: game.away,
    kickoff_iso: game.kickoff_iso,
    competition,
    market_home_win: game.prices.home,
    market_draw: game.prices.draw,
    market_away_win: game.prices.away,
    market_three_way: game.prices,
    market_price_source: "polymarket",
    polymarket_event_slug: game.event_slug,
    polymarket_market_slug: game.event_slug,
    is_world_cup: true,
    venue: null,
  };
  const scheduled = lookupWc26ScheduledVenue(
    game.home,
    game.away,
    game.kickoff_iso,
  );
  if (scheduled) {
    draft.venue = scheduled.city;
  } else {
    const ctx = resolveMatchContext({
      home: game.home,
      away: game.away,
      kickoff_iso: game.kickoff_iso,
      competition,
      is_world_cup: true,
    });
    draft.venue = ctx.city ?? ctx.venue_label ?? null;
  }
  return draft;
}

async function enrichBriefsWithPolymarket(
  briefs: FootballFixtureBrief[],
): Promise<{ fixtures: Fixture[]; hasPolymarket: boolean }> {
  const enriched: Fixture[] = [];

  for (const row of briefs) {
    let priceSrc: FixturePriceSource = "none";
    let homeWin = 0.5;
    let draw: number | null = null;
    let awayWin: number | null = null;
    let threeWay = null;
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
        slug = quote.event_slug ?? quote.market_slug ?? null;
        if (quote.three_way) {
          draw = quote.three_way.draw;
          awayWin = quote.three_way.away;
          threeWay = quote.three_way;
        }
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
      venue: row.venue ?? null,
      market_home_win: Number(homeWin.toFixed(4)),
      market_draw: draw !== null ? Number(draw.toFixed(4)) : null,
      market_away_win: awayWin !== null ? Number(awayWin.toFixed(4)) : null,
      market_three_way: threeWay,
      market_price_source: priceSrc,
      polymarket_event_slug: slug,
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
        ? "No Polymarket prices matched — odds placeholders on tiles."
        : undefined),
  };
}

export async function loadDashboardFixtures(): Promise<FixturesBootstrap> {
  const stubDetail =
    "Using demo fixtures — Polymarket or football-data.org unavailable.";

  try {
    const polyGames = await fetchPolymarketWcGames();
    if (polyGames.length > 0) {
      const fixtures = polyGames.slice(0, DISPLAY_CAP).map(polyGameToFixture);
      return {
        fixtures,
        source: "polymarket",
        detail: `${fixtures.length} World Cup matches from Polymarket (home / draw / away odds).`,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fallback = await loadFootballDataOrBundled(stubDetail);
    return {
      ...fallback,
      detail: `Polymarket schedule unavailable (${msg}). ${fallback.detail ?? ""}`.trim(),
    };
  }

  return loadFootballDataOrBundled(stubDetail);
}

async function loadFootballDataOrBundled(stubDetail: string): Promise<FixturesBootstrap> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const to = new Date(today.getTime());
  to.setUTCDate(to.getUTCDate() + RANGE_DAYS);

  if (process.env.FOOTBALL_DATA_ORG_TOKEN?.trim()) {
    try {
      const briefs = await fetchWcEligibleFixturesFromFootballData(today, to);
      if (briefs.length > 0) {
        return finishBootstrap(briefs, "football-data-org", undefined);
      }
    } catch (err) {
      const briefs = loadBundledBriefs();
      if (briefs.length > 0) {
        return finishBootstrap(
          briefs,
          "bundled",
          err instanceof Error ? err.message : String(err),
        );
      }
      return {
        fixtures: UPCOMING_FIXTURES,
        source: "fallback",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const briefs = loadBundledBriefs();
  if (briefs.length > 0) {
    return finishBootstrap(briefs, "bundled", stubDetail);
  }

  return {
    fixtures: UPCOMING_FIXTURES,
    source: "fixtures-stubs",
    detail: stubDetail,
  };
}

const cachedDashboardFixtures = unstable_cache(
  async () => loadDashboardFixtures(),
  ["dashboard-fixtures-poly-wc-v4"],
  { revalidate: 300 },
);

export async function getCachedDashboardFixtures(): Promise<FixturesBootstrap> {
  return cachedDashboardFixtures();
}
