import type { AlphaSignal } from "@/lib/ev";
import type { MismatchVerdict } from "@/lib/mismatch-verdict";
import type { RagContext } from "@/lib/rag-types";
import type { SentimentSnapshot } from "@/lib/sentiment/types";
import type { Wc2026Team } from "@/lib/teams";

export type { MismatchVerdict } from "@/lib/mismatch-verdict";

export type MatchContext = {
  venue_label: string | null;
  city: string | null;
  country: "Mexico" | "United States" | "Canada" | null;
  elevation_m: number | null;
  altitude_band: "sea_level" | "moderate" | "high" | null;
  climate: string | null;
  venue_notes: string[];
  travel_notes: string[];
  source: "venue" | "inferred" | "unknown";
};

export type AnalyzeMatchInput = {
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition?: string;
  p_market?: number | null;
  market_draw?: number | null;
  market_away_win?: number | null;
  polymarket_market_slug?: string | null;
  polymarket_event_slug?: string | null;
  venue?: string | null;
  city?: string | null;
  is_world_cup?: boolean;
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
    home_win?: number | null;
    draw?: number | null;
    away_win?: number | null;
  };
  data_gaps: string[];
  match_context: MatchContext;
  rag: RagContext;
  summary: string;
  elo_built_at: string;
  llm: LlmInsight | null;
  llm_skip_reason?: string;
  /** Plain-language overall mismatch vs Polymarket. */
  verdict: MismatchVerdict;
  /** News headlines about this fixture (when news APIs configured). */
  sentiment: SentimentSnapshot | null;
};
