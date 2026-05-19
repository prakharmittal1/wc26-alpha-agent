import type { AlphaSignal } from "@/lib/ev";
import type { RagContext } from "@/lib/rag-types";
import type { Wc2026Team } from "@/lib/teams";

export type AnalyzeMatchInput = {
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition?: string;
  p_market?: number | null;
  polymarket_market_slug?: string | null;
};

export type ExpectedSource = "llm" | "rag_elo_blend" | "elo";

export type LlmStance = "agree" | "disagree" | "cautious";

export type LlmInsight = {
  model: string;
  headline: string;
  thinking_steps: string[];
  /** Fair P(home win) after Elo + RAG + judgment. */
  p_expected_home_win: number;
  stance: LlmStance;
  summary: string;
  risks: string[];
  trade_idea: string | null;
};

export type AnalyzeResult = {
  match: {
    home: Wc2026Team;
    away: Wc2026Team;
    kickoff_iso: string;
    competition: string;
  };
  p_market: number | null;
  /** Elo + H2H baseline (reference). */
  p_model: number;
  /** Primary fair probability used vs Polymarket. */
  p_expected: number;
  p_expected_source: ExpectedSource;
  edge: number | null;
  signal: AlphaSignal;
  ev_per_unit: number | null;
  breakdown: {
    elo_home: number;
    elo_away: number;
    home_advantage: number;
    h2h_adjustment: number;
    base_p_home: number;
  };
  market: {
    slug: string | null;
    source: "polymarket" | "client" | "none";
    question?: string | null;
  };
  data_gaps: string[];
  rag: RagContext;
  summary: string;
  elo_built_at: string;
  llm: LlmInsight | null;
  llm_skip_reason?: string;
};
