import "server-only";

import type {
  AnalyzeMatchInput,
  AnalyzeResult,
  ExpectedSource,
} from "@/lib/alpha-types";
import { classifySignal, computeEv } from "@/lib/ev";
import {
  getTeamElo,
  h2hAdjustment,
  homeWinProbability,
  loadEloRatings,
  clampProbability,
  HOME_ADVANTAGE_ELO,
} from "@/lib/elo";
import { generateAnalystInsight, isLlmAnalystConfigured } from "@/lib/llm-analyst";
import { quoteHomeMoneylineYes } from "@/lib/polymarket-prices";
import { isRagAvailable, searchRagForMatch } from "@/lib/rag";
import { blendEloWithRag } from "@/lib/rag-form";
import { resolveMatchContext } from "@/lib/match-context";
import { buildMismatchVerdict } from "@/lib/mismatch-verdict";
import type { ThreeWayPrices } from "@/lib/polymarket-gamma";
import {
  gatherMatchSentiment,
  isSentimentConfigured,
} from "@/lib/sentiment/gather";

function buildMarketBlock(
  slug: string | null,
  source: AnalyzeResult["market"]["source"],
  question: string | null,
  p_market: number | null,
  threeWay: ThreeWayPrices | null | undefined,
  input: AnalyzeMatchInput,
): AnalyzeResult["market"] {
  return {
    slug,
    source,
    question,
    home_win: p_market,
    draw:
      threeWay?.draw ??
      (input.market_draw != null && Number.isFinite(input.market_draw)
        ? input.market_draw
        : null),
    away_win:
      threeWay?.away ??
      (input.market_away_win != null && Number.isFinite(input.market_away_win)
        ? input.market_away_win
        : null),
  };
}

function computeMarketEdge(p_expected: number, p_market: number | null) {
  const edge = p_market !== null ? p_expected - p_market : null;
  const signal = edge !== null ? classifySignal(edge) : ("NONE" as const);
  let ev_per_unit: number | null = null;
  if (p_market !== null && edge !== null) {
    const side = signal === "ALPHA_NO" ? "no" : "yes";
    ev_per_unit = computeEv({ p_true: p_expected, p_market, side }).ev;
  }
  return {
    edge: edge !== null ? Number(edge.toFixed(4)) : null,
    signal,
    ev_per_unit,
  };
}

function formatSummary(
  result: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason" | "verdict">,
): string {
  const { match, p_model, p_expected, p_expected_source, p_market, edge, signal, ev_per_unit, breakdown } =
    result;
  const lines = [
    `SUMMARY`,
    `match:        ${match.home} vs ${match.away}  (${match.kickoff_iso})`,
    `outcome:      ${match.home} to win (home YES)`,
    `p_model:      ${p_model.toFixed(4)}  (Elo baseline)`,
    `p_expected:   ${p_expected.toFixed(4)}  (source: ${p_expected_source})`,
    `p_market:     ${p_market !== null ? p_market.toFixed(4) : "n/a"}  (source: ${result.market.source})`,
    `edge:         ${edge !== null ? (edge >= 0 ? "+" : "") + edge.toFixed(4) : "n/a"}  (p_expected - p_market)`,
    `signal:       ${signal === "NONE" ? "none" : signal}`,
    `ev_per_unit:  ${ev_per_unit !== null ? ev_per_unit.toFixed(4) : "n/a"}`,
    `elo:          ${breakdown.elo_home.toFixed(0)} vs ${breakdown.elo_away.toFixed(0)}, H2H adj ${breakdown.h2h_adjustment >= 0 ? "+" : ""}${breakdown.h2h_adjustment.toFixed(3)}`,
  ];
  if (result.data_gaps.length > 0) {
    lines.push(`gaps:         ${result.data_gaps.join("; ")}`);
  }
  const mc = result.match_context;
  if (mc.city) {
    lines.push(
      `venue:        ${mc.venue_label ?? mc.city} (${mc.elevation_m ?? "?"}m, ${mc.altitude_band ?? "?"})`,
    );
  }
  return lines.join("\n");
}

export type AnalyzeMatchOptions = {
  /** Default true when an LLM provider is configured. */
  includeLlm?: boolean;
  /** Default true when GNews or NewsAPI keys are set. */
  includeSentiment?: boolean;
};

export async function analyzeMatch(
  input: AnalyzeMatchInput,
  options: AnalyzeMatchOptions = {},
): Promise<AnalyzeResult> {
  const includeLlm = options.includeLlm !== false && isLlmAnalystConfigured();
  const includeSentiment =
    options.includeSentiment !== false && isSentimentConfigured();

  const ratings = loadEloRatings();
  const data_gaps: string[] = [];

  const elo_home = getTeamElo(input.home, ratings);
  const elo_away = getTeamElo(input.away, ratings);
  const h2h_adj = h2hAdjustment(input.home, input.away);
  const base_p_home = homeWinProbability(input.home, input.away, { ratings });
  const p_model = clampProbability(base_p_home + h2h_adj);

  if (ratings.source === "seed-ratings" || ratings.source === "inline-default") {
    data_gaps.push(
      "Elo uses seed ratings — run `npm run data:build -- --file data/results.csv`",
    );
  }

  const rag = searchRagForMatch(input.home, input.away, 6);
  const match_context = resolveMatchContext({
    home: input.home,
    away: input.away,
    kickoff_iso: input.kickoff_iso,
    competition: input.competition,
    venue: input.venue,
    city: input.city,
    is_world_cup: input.is_world_cup,
  });
  if (!isRagAvailable()) {
    data_gaps.push("No RAG chunks — run `npm run data:build -- --file data/results.csv`");
  }

  let sentiment = null;
  if (includeSentiment) {
    try {
      sentiment = await gatherMatchSentiment(input.home, input.away, input.kickoff_iso);
      if (sentiment && sentiment.post_count === 0) {
        const errors = sentiment.sources
          .filter((s) => s.status === "error")
          .map((s) => s.detail)
          .filter(Boolean);
        if (errors.length > 0) {
          data_gaps.push(`News buzz: ${errors[0]}`);
        } else {
          data_gaps.push("No recent news headlines for this match");
        }
      }
    } catch {
      data_gaps.push("News headline lookup failed");
    }
  }

  let p_market: number | null =
    input.p_market != null && Number.isFinite(input.p_market) ? input.p_market : null;
  let marketSlug = input.polymarket_market_slug ?? null;
  let marketSource: AnalyzeResult["market"]["source"] =
    p_market !== null ? "client" : "none";
  let marketQuestion: string | null = null;
  let marketThreeWay: ThreeWayPrices | null | undefined;

  if (
    p_market !== null &&
    input.market_draw != null &&
    input.market_away_win != null
  ) {
    marketThreeWay = {
      home: p_market,
      draw: input.market_draw,
      away: input.market_away_win,
    };
    marketSource = "client";
  }

  try {
    const quote = await quoteHomeMoneylineYes(input.home, input.away, input.kickoff_iso, {
      eventSlug: input.polymarket_event_slug ?? input.polymarket_market_slug,
    });
    if (quote?.price !== undefined && Number.isFinite(quote.price)) {
      p_market = quote.price;
      marketSource = "polymarket";
      marketSlug = quote.event_slug ?? quote.market_slug ?? marketSlug;
      marketQuestion = quote.market_question ?? null;
      marketThreeWay = quote.three_way ?? marketThreeWay;
    }
  } catch {
    data_gaps.push("Polymarket Gamma lookup failed");
  }

  if (p_market === null) {
    data_gaps.push("No Polymarket match odds found for this fixture");
  }

  let p_expected = p_model;
  let p_expected_source: ExpectedSource = "elo";

  const ragBlend = blendEloWithRag(p_model, rag.hits, input.home, input.away);
  if (ragBlend !== null) {
    p_expected = ragBlend;
    p_expected_source = "rag_elo_blend";
  }

  let llm = null;
  let llm_skip_reason: string | undefined;

  if (!includeLlm) {
    llm_skip_reason = options.includeLlm === false ? "disabled" : "no_api_key";
  } else {
    const interimBase: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason" | "verdict"> =
      {
      match: {
        home: input.home,
        away: input.away,
        kickoff_iso: input.kickoff_iso,
        competition: input.competition ?? "Match",
      },
      p_market,
      p_model: Number(p_model.toFixed(4)),
      p_expected: Number(p_expected.toFixed(4)),
      p_expected_source,
      ...computeMarketEdge(p_expected, p_market),
      breakdown: {
        elo_home,
        elo_away,
        home_advantage: HOME_ADVANTAGE_ELO,
        h2h_adjustment: Number(h2h_adj.toFixed(4)),
        base_p_home: Number(base_p_home.toFixed(4)),
      },
      market: buildMarketBlock(
        marketSlug,
        marketSource,
        marketQuestion,
        p_market,
        marketThreeWay,
        input,
      ),
      data_gaps,
      match_context,
      rag,
      sentiment,
      elo_built_at: ratings.built_at,
    };

    const { insight, skipReason } = await generateAnalystInsight(interimBase);
    if (insight) {
      p_expected = insight.p_expected_home_win;
      p_expected_source = "llm";
      llm = insight;
    } else {
      llm_skip_reason = skipReason;
      if (p_expected_source === "elo" && rag.hits.length > 0) {
        data_gaps.push("LLM unavailable — using Elo-only expected (enable Ollama or Gemini for RAG-weighted probability)");
      }
    }
  }

  p_expected = Number(p_expected.toFixed(4));

  const partial: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason" | "verdict"> = {
    match: {
      home: input.home,
      away: input.away,
      kickoff_iso: input.kickoff_iso,
      competition: input.competition ?? "Match",
    },
    p_market,
    p_model: Number(p_model.toFixed(4)),
    p_expected,
    p_expected_source,
    ...computeMarketEdge(p_expected, p_market),
    breakdown: {
      elo_home,
      elo_away,
      home_advantage: HOME_ADVANTAGE_ELO,
      h2h_adjustment: Number(h2h_adj.toFixed(4)),
      base_p_home: Number(base_p_home.toFixed(4)),
    },
    market: buildMarketBlock(
      marketSlug,
      marketSource,
      marketQuestion,
      p_market,
      marketThreeWay,
      input,
    ),
    data_gaps,
    match_context,
    rag,
    sentiment,
    elo_built_at: ratings.built_at,
  };

  const summary = formatSummary(partial);
  const withSummary = {
    ...partial,
    summary,
    llm,
    ...(llm_skip_reason ? { llm_skip_reason } : {}),
  };
  return {
    ...withSummary,
    verdict: buildMismatchVerdict(withSummary),
  };
}

