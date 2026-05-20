/**
 * Shared Polymarket Gamma API helpers (no API key).
 */

import { canonicalizeTeam, type Wc2026Team } from "@/lib/teams";

export const FIFA_WC_SERIES_ID = "11433";
export const FIFA_WC_TAG_ID = "102232";

export type GammaMarket = {
  question?: string | null;
  outcomes?: unknown;
  outcomePrices?: unknown;
  slug?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
};

export type GammaEvent = {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  eventDate?: string | null;
  endDate?: string | null;
  startDate?: string | null;
  markets?: GammaMarket[] | null;
  closed?: boolean | null;
  active?: boolean | null;
};

export type ThreeWayPrices = {
  home: number;
  draw: number;
  away: number;
};

export type ParsedWcGame = {
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  prices: ThreeWayPrices;
  event_slug: string;
  event_id: string;
  event_title: string;
};

export function parseOutcomePrices(raw: unknown): number[] {
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

function parseOutcomes(raw: unknown): string[] | null {
  try {
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x));
      }
    }
    if (Array.isArray(raw)) return raw.map((x) => String(x));
  } catch {
    return null;
  }
  return null;
}

function yesPriceFromMarket(mk: GammaMarket): number | null {
  if (!mk || mk.closed === true || mk.active === false) return null;
  const outs = parseOutcomes(mk.outcomes);
  if (!outs || outs.length !== 2 || !/\byes\b/i.test(outs[0] ?? "")) return null;
  const prices = parseOutcomePrices(mk.outcomePrices);
  const p = prices[0];
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return Number(p.toFixed(4));
}

/** Parse "Mexico vs. South Africa" → canonical teams (first side = home). */
export function parseVersusTitle(title: string): { home: Wc2026Team; away: Wc2026Team } | null {
  const m = /^(.+?)\s+vs\.?\s+(.+)$/i.exec(title.trim());
  if (!m?.[1] || !m?.[2]) return null;
  const home = canonicalizeTeam(m[1].trim());
  const away = canonicalizeTeam(m[2].trim());
  if (!home || !away || home === away) return null;
  return { home, away };
}

export function isExcludedSportsEventTitle(title: string): boolean {
  return /more markets|halftime|exact score|spread:|total goals|both teams to score|o\/u/i.test(
    title,
  );
}

/**
 * Extract home / draw / away YES prices from the 3 moneyline shards on a game event.
 */
export function parseThreeWayFromEvent(event: GammaEvent): ParsedWcGame | null {
  const title = (event.title ?? "").trim();
  if (!title || isExcludedSportsEventTitle(title)) return null;

  const sides = parseVersusTitle(title);
  if (!sides) return null;

  const { home, away } = sides;
  let homePrice: number | null = null;
  let drawPrice: number | null = null;
  let awayPrice: number | null = null;

  for (const mk of event.markets ?? []) {
    const q = String(mk?.question ?? "");
    const p = yesPriceFromMarket(mk);
    if (p === null) continue;

    if (/\bend in a draw\b/i.test(q)) {
      drawPrice = p;
      continue;
    }

    const winMatch = /\bwill\s+(.+?)\s+win\b/i.exec(q);
    if (!winMatch?.[1]) continue;
    const subject = canonicalizeTeam(
      winMatch[1].replace(/\s+on\b.*$/i, "").replace(/\?$/, "").trim(),
    );
    if (subject === home) homePrice = p;
    else if (subject === away) awayPrice = p;
  }

  if (homePrice === null || drawPrice === null || awayPrice === null) return null;

  const kickoff_iso = kickoffFromEvent(event);
  if (!kickoff_iso) return null;

  const slug = (event.slug ?? "").trim();
  if (!slug) return null;

  return {
    home,
    away,
    kickoff_iso,
    prices: { home: homePrice, draw: drawPrice, away: awayPrice },
    event_slug: slug,
    event_id: String(event.id ?? slug),
    event_title: title,
  };
}

function kickoffFromEvent(event: GammaEvent): string | null {
  const end = event.endDate?.trim();
  if (end) {
    const d = new Date(end);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  const dateOnly = event.eventDate?.trim();
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date(`${dateOnly}T19:00:00.000Z`).toISOString();
  }
  return null;
}

export async function gammaGetEvents(params: Record<string, string>): Promise<GammaEvent[]> {
  const url = new URL("https://gamma-api.polymarket.com/events");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const snippet = await res.text().catch(() => "");
    throw new Error(`gamma events ${res.status}: ${snippet.slice(0, 200)}`);
  }
  const json = (await res.json()) as GammaEvent[] | { data?: GammaEvent[] };
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

export async function gammaGetEventBySlug(slug: string): Promise<GammaEvent | null> {
  const url = `https://gamma-api.polymarket.com/events/slug/${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as GammaEvent;
}
