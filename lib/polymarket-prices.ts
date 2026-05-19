/**
 * Polymarket Gamma public endpoints (no API key) for indicative YES odds on
 * home-win moneyline shards (sport events often expose "Will {team} win on …?").
 */

import { canonicalizeTeam, type Wc2026Team } from "@/lib/teams";

export type GammaHomeWinQuote = {
  /** Polymarket YES-implied probability for the home squad winning (excluding draw semantics). */
  price: number;
  market_slug?: string | null;
  market_question?: string | null;
};

type GammaMarket = {
  question?: string | null;
  outcomes?: unknown;
  outcomePrices?: unknown;
  slug?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
};

type GammaEvent = {
  title?: string | null;
  slug?: string | null;
  markets?: GammaMarket[] | null;
};

type GammaPublicSearchResponse = {
  events?: GammaEvent[] | null;
};

function parseOutcomePrices(raw: unknown): number[] {
  if (raw === null || raw === undefined) return [];

  const toNums = (arr: unknown[]): number[] =>
    arr.map((x) => (typeof x === "string" ? Number(x) : Number(x))).filter(
      (n) => Number.isFinite(n),
    );

  try {
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith('"[')) {
        const parsed = JSON.parse(trimmed) as unknown[];
        return Array.isArray(parsed) ? toNums(parsed) : [];
      }
    }
    if (Array.isArray(raw)) return toNums(raw as unknown[]);
  } catch {
    return [];
  }
  return [];
}

function homeWinnerQuestionMatch(question: string, home: Wc2026Team): boolean {
  const m = /\bwill\s+(.+?)\s+win\b/i.exec(question.trim());
  if (!m?.[1]) return false;

  let subjectChunk = m[1].trim();
  subjectChunk = subjectChunk.replace(/\s+on\b.*$/i, "").trim();
  const subject = canonicalizeTeam(subjectChunk.replace(/\?$/, "").trim());
  return subject === home;
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

    return false;
  };

  return mentions(home) && mentions(away);
}

async function gammaPublicSearch(q: string): Promise<GammaPublicSearchResponse> {
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
  return (await res.json()) as GammaPublicSearchResponse;
}

/**
 * Attempt to read the LIVE active market for `{homeTeam} beats {awayTeam}` style
 * three-way decomposition (moneyline shards). Uses the Gamma public search index.
 */
export async function quoteHomeMoneylineYes(
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
      `${homeTeam} beats ${awayTeam}`,
      day ? `${homeTeam} ${awayTeam} ${day}` : `${homeTeam} ${awayTeam}`,
    ].filter(Boolean)),
  );

  for (const q of queries) {
    let data: GammaPublicSearchResponse;
    try {
      data = await gammaPublicSearch(q);
    } catch {
      continue;
    }
    const events = data.events ?? [];
    for (const ev of events) {
      const title = (ev.title ?? "").trim();
      if (!eventCoversSides(title, homeTeam, awayTeam)) continue;
      const markets = ev.markets ?? [];
      for (const mk of markets) {
        if (!mk || mk.closed === true || mk.active === false) continue;
        const question = String(mk.question ?? "");
        const outcomesTry = mk.outcomes;
        let outs: unknown[] | null = null;
        if (typeof outcomesTry === "string") {
          try {
            outs = JSON.parse(outcomesTry) as unknown[];
          } catch {
            outs = null;
          }
        } else if (Array.isArray(outcomesTry)) {
          outs = outcomesTry as unknown[];
        }
        const isYy =
          outs &&
          outs.length === 2 &&
          typeof outs[0] === "string" &&
          typeof outs[1] === "string" &&
          /\byes\b/i.test(outs[0]) &&
          /\bno\b/i.test(outs[1]);
        if (!isYy) continue;
        if (!homeWinnerQuestionMatch(question, homeTeam)) continue;
        const prices = parseOutcomePrices(mk.outcomePrices);
        const yesPrice = typeof prices[0] === "number" ? Number(prices[0]) : Number.NaN;
        if (!Number.isFinite(yesPrice) || yesPrice <= 0 || yesPrice >= 1) continue;
        return {
          price: Number(yesPrice.toFixed(4)),
          market_slug: mk.slug ?? ev.slug ?? null,
          market_question: question.slice(0, 240),
        };
      }
    }
  }

  return null;
}
