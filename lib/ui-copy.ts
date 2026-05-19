import type { AnalyzeResult, ExpectedSource } from "@/lib/alpha-types";
import type { AlphaSignal } from "@/lib/ev";
import type { FixtureFeedSource } from "@/lib/fixtures";

/** Show a probability as a whole-number percent (e.g. 64%). */
export function formatChance(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

/** Signed gap vs market in percentage points (e.g. +18%). */
export function formatGap(edge: number | null | undefined): string {
  if (edge == null || !Number.isFinite(edge)) return "—";
  const pts = Math.round(edge * 100);
  return pts >= 0 ? `+${pts}%` : `${pts}%`;
}

/** Expected return per $1 staked, in plain dollars. */
export function formatReturnPerDollar(ev: number | null | undefined): string {
  if (ev == null || !Number.isFinite(ev)) return "—";
  const sign = ev >= 0 ? "+" : "";
  return `${sign}$${ev.toFixed(2)}`;
}

export function expectedSourceLabel(source: ExpectedSource): string {
  switch (source) {
    case "llm":
      return "AI + match history";
    case "rag_elo_blend":
      return "Ratings + past games";
    case "elo":
      return "Team ratings only";
  }
}

export function signalLabel(signal: AlphaSignal): string {
  switch (signal) {
    case "ALPHA_YES":
      return "Home win looks cheap — market may be too low";
    case "ALPHA_NO":
      return "Home win looks expensive — market may be too high";
    default:
      return "No strong disagreement with the market";
  }
}

export function gaugeMarketLabel(
  source: "polymarket" | "neutral" | "expected" | "market",
): string {
  switch (source) {
    case "polymarket":
      return "Market odds";
    case "neutral":
      return "No odds yet";
    case "expected":
      return "Our estimate";
    case "market":
      return "Market odds";
  }
}

export function stanceLabel(stance: NonNullable<AnalyzeResult["llm"]>["stance"]): string {
  switch (stance) {
    case "agree":
      return "Sees a betting opportunity";
    case "disagree":
      return "Market looks fair";
    default:
      return "Uncertain — proceed carefully";
  }
}

export function fixtureFeedLabel(source: FixtureFeedSource): string {
  switch (source) {
    case "football-data-org":
    case "football-data-org+polymarket":
      return "Live match schedule";
    case "bundled":
    case "bundled+polymarket":
      return "Sample schedule";
    case "fixtures-stubs":
      return "Demo matches";
    default:
      return "Match list";
  }
}

/** Turn server data-gap strings into short, user-facing notes. */
export function friendlyDataGap(raw: string): string {
  if (raw.includes("seed ratings") || raw.includes("data:build")) {
    return "Using basic team ratings — full history not loaded yet.";
  }
  if (raw.includes("No RAG chunks")) {
    return "Limited past-match data for this pairing.";
  }
  if (raw.includes("Polymarket Gamma lookup failed")) {
    return "Could not refresh live market prices.";
  }
  if (raw.includes("No Polymarket")) {
    return "No live Polymarket price for this match.";
  }
  if (raw.includes("LLM unavailable")) {
    return "AI estimate unavailable — using ratings and history instead.";
  }
  return raw;
}

export function friendlyLlmSkip(skipReason?: string): string | null {
  if (!skipReason) return null;
  if (skipReason === "no_api_key") {
    return "AI match commentary is not enabled on this site.";
  }
  if (skipReason === "disabled") {
    return "AI commentary was skipped for this request.";
  }
  if (skipReason.startsWith("error:")) {
    const detail = skipReason.replace(/^error:\s*/, "");
    if (detail.toLowerCase().includes("ollama")) {
      return "AI commentary is offline — start Ollama on this computer to enable it.";
    }
    return `AI commentary unavailable: ${detail}`;
  }
  return null;
}
