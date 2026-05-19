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
  result: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason">,
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
  return lines.join("\n");
}

export type AnalyzeMatchOptions = {
  /** Default true when an LLM provider is configured. */
  includeLlm?: boolean;
};

export async function analyzeMatch(
  input: AnalyzeMatchInput,
  options: AnalyzeMatchOptions = {},
): Promise<AnalyzeResult> {
  const includeLlm = options.includeLlm !== false && isLlmAnalystConfigured();

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
  if (!isRagAvailable()) {
    data_gaps.push("No RAG chunks — run `npm run data:build -- --file data/results.csv`");
  }

  let p_market: number | null =
    input.p_market != null && Number.isFinite(input.p_market) ? input.p_market : null;
  let marketSlug = input.polymarket_market_slug ?? null;
  let marketSource: AnalyzeResult["market"]["source"] =
    p_market !== null ? "client" : "none";
  let marketQuestion: string | null = null;

  try {
    const quote = await quoteHomeMoneylineYes(input.home, input.away, input.kickoff_iso);
    if (quote?.price !== undefined && Number.isFinite(quote.price)) {
      p_market = quote.price;
      marketSource = "polymarket";
      marketSlug = quote.market_slug ?? marketSlug;
      marketQuestion = quote.market_question ?? null;
    }
  } catch {
    data_gaps.push("Polymarket Gamma lookup failed");
  }

  if (p_market === null) {
    data_gaps.push("No Polymarket home-win YES price found");
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
    const interimBase: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason"> = {
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
      market: {
        slug: marketSlug,
        source: marketSource,
        question: marketQuestion,
      },
      data_gaps,
      rag,
      elo_built_at: ratings.built_at,
    };

    const { insight, skipReason } = await generateAnalystInsight(interimBase as AnalyzeResult);
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

  const partial: Omit<AnalyzeResult, "summary" | "llm" | "llm_skip_reason"> = {
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
    market: {
      slug: marketSlug,
      source: marketSource,
      question: marketQuestion,
    },
    data_gaps,
    rag,
    elo_built_at: ratings.built_at,
  };

  return {
    ...partial,
    summary: formatSummary(partial),
    llm,
    ...(llm_skip_reason ? { llm_skip_reason } : {}),
  };
}

export function analyzeMatchSync(
  home: import("@/lib/teams").Wc2026Team,
  away: import("@/lib/teams").Wc2026Team,
  p_market: number,
  p_expected?: number,
): Pick<AnalyzeResult, "p_model" | "p_expected" | "edge" | "signal" | "ev_per_unit"> {
  const ratings = loadEloRatings();
  const h2h_adj = h2hAdjustment(home, away);
  const base = homeWinProbability(home, away, { ratings });
  const p_model = clampProbability(base + h2h_adj);
  const pExp = p_expected ?? p_model;
  const { edge, signal, ev_per_unit } = computeMarketEdge(pExp, p_market);
  return {
    p_model: Number(p_model.toFixed(4)),
    p_expected: Number(pExp.toFixed(4)),
    edge: edge!,
    signal,
    ev_per_unit,
  };
}
