import type { AnalyzeResult, ExpectedSource } from "@/lib/alpha-types";
import type { AlphaSignal } from "@/lib/ev";
import type { FixtureFeedSource } from "@/lib/fixtures";

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

/** Expected return per $1 staked, in plain dollars. */
export function formatReturnPerDollar(ev: number | null | undefined): string {
  if (ev == null || !Number.isFinite(ev)) return NA;
  const sign = ev >= 0 ? "+" : "";
  return `${sign}$${ev.toFixed(2)}`;
}

export function teamWinChanceLabel(team: string): string {
  return `Chance ${team} wins`;
}

/** Internal / debug only — not shown in the main UI. */
export function expectedSourceLabel(source: ExpectedSource): string {
  switch (source) {
    case "llm":
      return "AI + history";
    case "rag_elo_blend":
      return "Ratings + history";
    case "elo":
      return "Ratings only";
  }
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

export function signalLabel(signal: AlphaSignal, team: string): string {
  switch (signal) {
    case "ALPHA_YES":
      return marketVerdictLine("underpriced", team);
    case "ALPHA_NO":
      return marketVerdictLine("overpriced", team);
    default:
      return marketVerdictLine("aligned", team);
  }
}

export function gaugeMarketLabel(
  source: "polymarket" | "neutral" | "expected" | "market",
): string {
  switch (source) {
    case "polymarket":
    case "market":
      return "Market";
    case "neutral":
      return "No odds";
    case "expected":
      return "Our estimate";
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

export function fixtureFeedLabel(source: FixtureFeedSource): string {
  switch (source) {
    case "polymarket":
      return "Match list from Polymarket";
    case "polymarket+football-data-org":
      return "Matches and live updates";
    case "football-data-org":
    case "football-data-org+polymarket":
      return "Live match schedule";
    case "bundled":
    case "bundled+polymarket":
      return "Sample matches";
    case "fixtures-stubs":
      return "Demo matches";
    default:
      return "Match list";
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
  return raw.replace(/\s*—\s*/g, ". ").replace(/-/g, " ");
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
