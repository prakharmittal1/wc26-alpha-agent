import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeMatch } from "@/lib/alpha-engine";
import { canonicalizeTeam } from "@/lib/teams";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  home: z.string().min(1),
  away: z.string().min(1),
  kickoff_iso: z.string().min(8),
  competition: z.string().optional(),
  p_market: z.number().gt(0).lt(1).optional().nullable(),
  market_draw: z.number().gt(0).lt(1).optional().nullable(),
  market_away_win: z.number().gt(0).lt(1).optional().nullable(),
  polymarket_market_slug: z.string().optional().nullable(),
  polymarket_event_slug: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  is_world_cup: z.boolean().optional(),
  include_llm: z.boolean().optional(),
  include_sentiment: z.boolean().optional(),
});

/** POST /api/analyze — Elo + RAG + sentiment + LLM vs Polymarket */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const home = canonicalizeTeam(parsed.data.home);
  const away = canonicalizeTeam(parsed.data.away);
  if (!home || !away) {
    return NextResponse.json(
      {
        error: "Unknown team name(s). Use canonical WC 2026 national team names.",
        home: parsed.data.home,
        away: parsed.data.away,
      },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeMatch(
      {
        home,
        away,
        kickoff_iso: parsed.data.kickoff_iso,
        competition: parsed.data.competition,
        p_market: parsed.data.p_market ?? undefined,
        market_draw: parsed.data.market_draw ?? undefined,
        market_away_win: parsed.data.market_away_win ?? undefined,
        polymarket_event_slug:
          parsed.data.polymarket_event_slug ??
          parsed.data.polymarket_market_slug ??
          undefined,
        polymarket_market_slug: parsed.data.polymarket_market_slug ?? undefined,
        venue: parsed.data.venue ?? undefined,
        city: parsed.data.city ?? undefined,
        is_world_cup: parsed.data.is_world_cup,
      },
      {
        includeLlm: parsed.data.include_llm,
        includeSentiment: parsed.data.include_sentiment,
      },
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
