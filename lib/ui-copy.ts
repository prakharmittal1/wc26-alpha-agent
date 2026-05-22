import type { AnalyzeResult } from "@/lib/alpha-types";
import type { SentimentSourceId, SentimentTone } from "@/lib/sentiment/types";

const NA = "—";

/** Show a probability as a whole number percent (e.g. 64%). */
export function formatChance(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return NA;
  return `${Math.round(p * 100)}%`;
}

/** Polymarket style price in cents (e.g. 67¢). */
export function formatMarketCents(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return NA;
  return `${Math.round(p * 100)}¢`;
}

/** Signed gap vs market (e.g. +18%). */
export function formatGap(edge: number | null | undefined): string {
  if (edge == null || !Number.isFinite(edge)) return NA;
  const pts = Math.round(edge * 100);
  return pts >= 0 ? `+${pts}%` : `${pts}%`;
}

/** Gap badge for verdict card (percentage points as %). */
export function formatGapBadge(gapPp: number | null | undefined): string | null {
  if (gapPp == null || !Number.isFinite(gapPp)) return null;
  return gapPp >= 0 ? `+${gapPp}%` : `${gapPp}%`;
}

/** One-line verdict vs betting market. */
export function marketVerdictLine(
  kind: "underpriced" | "overpriced" | "aligned" | "no_market",
  team: string,
): string {
  switch (kind) {
    case "underpriced":
      return `Odds look low on ${team}`;
    case "overpriced":
      return `Odds look high on ${team}`;
    case "aligned":
      return "Matches market odds";
    case "no_market":
      return "No betting odds yet";
  }
}

export function stanceLabel(stance: NonNullable<AnalyzeResult["llm"]>["stance"]): string {
  switch (stance) {
    case "agree":
      return "Possible value";
    case "disagree":
      return "Odds look fair";
    default:
      return "Hard to call";
  }
}

/** Turn server data gap strings into short, plain notes. */
export function friendlyDataGap(raw: string): string {
  if (raw.includes("seed ratings") || raw.includes("data:build")) {
    return "Limited team history in our database.";
  }
  if (raw.includes("No RAG chunks")) {
    return "Not much head-to-head history for this pairing.";
  }
  if (raw.includes("Polymarket Gamma lookup failed")) {
    return "Could not refresh the latest betting odds.";
  }
  if (raw.includes("No Polymarket")) {
    return "No live betting odds for this match yet.";
  }
  if (raw.includes("LLM unavailable")) {
    return "Using team strength and past results only.";
  }
  if (raw.includes("News buzz")) {
    return raw.replace(/^News buzz:\s*/i, "Headlines: ");
  }
  if (raw.includes("No recent news")) {
    return "No recent news headlines for this match.";
  }
  return raw.replace(/\s*—\s*/g, ". ").replace(/-/g, " ");
}

export function sentimentToneLabel(tone: SentimentTone): string {
  switch (tone) {
    case "positive":
      return "Mostly positive";
    case "negative":
      return "Mostly negative";
    case "mixed":
      return "Mixed";
    default:
      return "Not much signal";
  }
}

export function sentimentSourceLabel(_source: SentimentSourceId): string {
  return "News";
}

export function friendlyLlmSkip(skipReason?: string): string | null {
  if (!skipReason) return null;
  if (skipReason === "no_api_key") {
    return "Extra written analysis is turned off.";
  }
  if (skipReason === "disabled") {
    return "Extra written analysis was skipped.";
  }
  if (skipReason.startsWith("error:")) {
    return "Extra written analysis is not available right now.";
  }
  return null;
}
