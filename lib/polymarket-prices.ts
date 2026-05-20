/**
 * Polymarket Gamma public endpoints (no API key).
 * Supports 3-way match odds (home / draw / away) and legacy home-win YES search.
 */

import {
  type GammaEvent,
  type ParsedWcGame,
  type ThreeWayPrices,
  gammaGetEventBySlug,
  parseThreeWayFromEvent,
} from "@/lib/polymarket-gamma";
import { canonicalizeTeam, type Wc2026Team } from "@/lib/teams";

export type { ThreeWayPrices, ParsedWcGame } from "@/lib/polymarket-gamma";

export type GammaHomeWinQuote = {
  price: number;
  market_slug?: string | null;
  market_question?: string | null;
  three_way?: ThreeWayPrices | null;
  event_slug?: string | null;
};

async function gammaPublicSearch(q: string): Promise<{ events?: GammaEvent[] | null }> {
  const url = new URL("https://gamma-api.polymarket.com/public-search");
  url.searchParams.set("q", q);
  url.searchParams.set("events_status", "active");
  url.searchParams.set("limit_per_type", "20");

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const snippet = await res.text().catch(() => "");
    throw new Error(`gamma public-search ${res.status}: ${snippet.slice(0, 200)}`);
  }
  return (await res.json()) as { events?: GammaEvent[] | null };
}

function eventCoversSides(title: string, home: Wc2026Team, away: Wc2026Team): boolean {
  const lo = title.toLowerCase();
  const mentions = (team: Wc2026Team) => {
    if (lo.includes(team.toLowerCase())) return true;
    if (team === "United States") {
      return /\busa\b|u\.s\.(\s*a\.?)?|united\s+states|usmnt\b/i.test(lo);
    }
    if (team === "South Korea") {
      return /south\s+korea|korea\s+republic|republic\s+of\s+korea/.test(lo);
    }
    if (team === "Türkiye") {
      return /t[uü]rkiye|\bturkey\b/i.test(lo);
    }
    if (team === "Ivory Coast") {
      return (
        /ivory\s+coast/i.test(lo) ||
        /côte\s*d[\u0027\u2019]?ivoire/i.test(lo) ||
        /\bc[oô]te\s+d[\u0027\u2019]?ivoire/i.test(lo)
      );
    }
    if (team === "Republic of Ireland") {
      return /republic\s+of\s+ireland|\bireland\b|roi\b/i.test(lo);
    }
    if (team === "Scotland") return /\bscotland\b|sco\b/i.test(lo);
    if (team === "Wales") return /\bwales\b|cymru\b/i.test(lo);
    if (team === "England") return /\bengland\b|three\s+lions\b/i.test(lo);
    if (team === "Iran") return /\biran\b|ir iran\b/i.test(lo);
    return false;
  };

  return mentions(home) && mentions(away);
}

/** Lookup 3-way prices for a known Polymarket event slug. */
export async function quoteThreeWayByEventSlug(
  eventSlug: string,
): Promise<(ParsedWcGame & { prices: ThreeWayPrices }) | null> {
  const ev = await gammaGetEventBySlug(eventSlug);
  if (!ev) return null;
  return parseThreeWayFromEvent(ev);
}

/**
 * 3-way moneyline (home / draw / away) via public search — matches Polymarket game pages.
 */
export async function quoteThreeWayMoneyline(
  homeTeam: Wc2026Team,
  awayTeam: Wc2026Team,
  kickoffIso?: string,
): Promise<(ParsedWcGame & { prices: ThreeWayPrices }) | null> {
  const day = kickoffIso?.slice(0, 10) ?? "";
  const queries = Array.from(
    new Set([
      `${homeTeam} ${awayTeam}`,
      `${homeTeam} vs ${awayTeam}`,
      day ? `${homeTeam} ${awayTeam} ${day}` : "",
    ].filter(Boolean)),
  );

  for (const q of queries) {
    let data: { events?: GammaEvent[] | null };
    try {
      data = await gammaPublicSearch(q);
    } catch {
      continue;
    }
    for (const ev of data.events ?? []) {
      const title = (ev.title ?? "").trim();
      if (!eventCoversSides(title, homeTeam, awayTeam)) continue;
      const parsed = parseThreeWayFromEvent(ev);
      if (parsed && parsed.home === homeTeam && parsed.away === awayTeam) {
        return parsed;
      }
    }
  }

  return null;
}

/** Home-win YES price; prefers 3-way shard, falls back to legacy search. */
export async function quoteHomeMoneylineYes(
  homeTeam: Wc2026Team,
  awayTeam: Wc2026Team,
  kickoffIso: string,
  options?: { eventSlug?: string | null },
): Promise<GammaHomeWinQuote | null> {
  if (options?.eventSlug) {
    const bySlug = await quoteThreeWayByEventSlug(options.eventSlug);
    if (bySlug) {
      return {
        price: bySlug.prices.home,
        market_slug: bySlug.event_slug,
        market_question: bySlug.event_title,
        three_way: bySlug.prices,
        event_slug: bySlug.event_slug,
      };
    }
  }

  const three = await quoteThreeWayMoneyline(homeTeam, awayTeam, kickoffIso);
  if (three) {
    return {
      price: three.prices.home,
      market_slug: three.event_slug,
      market_question: three.event_title,
      three_way: three.prices,
      event_slug: three.event_slug,
    };
  }

  return legacyHomeWinYesSearch(homeTeam, awayTeam, kickoffIso);
}

async function legacyHomeWinYesSearch(
  homeTeam: Wc2026Team,
  awayTeam: Wc2026Team,
  kickoffIso: string,
): Promise<GammaHomeWinQuote | null> {
  const day = kickoffIso.slice(0, 10);
  const queries = Array.from(
    new Set([
      `${homeTeam} vs ${awayTeam}`,
      `${awayTeam} vs ${homeTeam}`,
      `${homeTeam} ${awayTeam} soccer`,
      `${homeTeam} ${awayTeam} fifa`,
      day ? `${homeTeam} ${awayTeam} ${day}` : `${homeTeam} ${awayTeam}`,
    ]),
  );

  for (const q of queries) {
    let data: { events?: GammaEvent[] | null };
    try {
      data = await gammaPublicSearch(q);
    } catch {
      continue;
    }
    for (const ev of data.events ?? []) {
      const title = (ev.title ?? "").trim();
      if (!eventCoversSides(title, homeTeam, awayTeam)) continue;
      const parsed = parseThreeWayFromEvent(ev);
      if (parsed) {
        return {
          price: parsed.prices.home,
          market_slug: parsed.event_slug,
          market_question: parsed.event_title,
          three_way: parsed.prices,
          event_slug: parsed.event_slug,
        };
      }
    }
  }

  return null;
}
