import type { AnalyzeResult } from "@/lib/alpha-types";
import { ALPHA_THRESHOLD } from "@/lib/ev";
import { marketVerdictLine } from "@/lib/ui-copy";

export type MismatchAlignment =
  | "aligned"
  | "we_higher"
  | "market_higher"
  | "no_market";

export type MismatchVerdict = {
  alignment: MismatchAlignment;
  headline: string;
  summary: string;
  comparison_line: string;
  factors_used: string[];
  takeaway: string;
  gap_pp: number | null;
};

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function buildFactorsUsed(result: Omit<AnalyzeResult, "verdict">): string[] {
  const { match } = result;
  const factors: string[] = [];

  factors.push(`Ratings: ${formatPct(result.p_model)} for ${match.home}`);

  if (result.rag.hits.length > 0) {
    factors.push(`Past meetings (${result.rag.hits.length})`);
  }

  if (
    result.match_context.venue_notes.length > 0 ||
    result.match_context.travel_notes.length > 0
  ) {
    const where = result.match_context.city ?? "venue";
    factors.push(`Conditions (${where})`);
  }

  if (result.p_expected_source === "llm") {
    factors.push(`AI (${result.llm?.model ?? "analyst"})`);
  } else if (result.p_expected_source === "rag_elo_blend") {
    factors.push("Ratings blended with history");
  }

  if (result.sentiment && result.sentiment.post_count > 0) {
    factors.push(`News (${result.sentiment.post_count} headlines)`);
  }

  return factors;
}

/** Overall mismatch: our read vs Polymarket for the listed team to win. */
export function buildMismatchVerdict(
  result: Omit<AnalyzeResult, "verdict">,
): MismatchVerdict {
  const { match, p_expected, p_market, p_model, edge, market } = result;
  const team = match.home;
  const opponent = match.away;
  const factors_used = buildFactorsUsed(result);
  const ourLine = `We give ${team} a ${formatPct(p_expected)} chance to win.`;

  if (p_market === null || edge === null) {
    return {
      alignment: "no_market",
      headline: marketVerdictLine("no_market", team),
      comparison_line: ourLine,
      summary: `No betting odds to compare yet. By team strength alone: ${formatPct(p_model)} for ${team}.`,
      factors_used,
      takeaway: "Check back when odds are posted.",
      gap_pp: null,
    };
  }

  const gap_pp = Math.round(edge * 100);
  const marketPct = formatPct(p_market);
  let marketExtra = "";
  if (market.draw != null && market.away_win != null) {
    marketExtra = ` Market line: ${team} ${marketPct}, draw ${formatPct(market.draw)}, ${opponent} ${formatPct(market.away_win)}.`;
  } else {
    marketExtra = ` Market: ${team} ${marketPct}.`;
  }

  const comparison_line = `${ourLine} The market says ${marketPct} (${gap_pp >= 0 ? "+" : ""}${gap_pp}% difference).`;

  const absGap = Math.abs(edge);
  let alignment: MismatchAlignment;
  let headline: string;
  let takeaway: string;

  if (absGap <= ALPHA_THRESHOLD) {
    alignment = "aligned";
    headline = marketVerdictLine("aligned", team);
    takeaway = "";
  } else if (edge > 0) {
    alignment = "we_higher";
    headline = marketVerdictLine("underpriced", team);
    takeaway = "";
  } else {
    alignment = "market_higher";
    headline = marketVerdictLine("overpriced", team);
    takeaway = "";
  }

  const summary =
    result.llm?.summary && absGap > ALPHA_THRESHOLD
      ? result.llm.summary
      : comparison_line + marketExtra;

  return {
    alignment,
    headline,
    summary,
    comparison_line,
    factors_used,
    takeaway,
    gap_pp,
  };
}
