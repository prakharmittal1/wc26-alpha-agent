import "server-only";

import { z } from "zod";

import type { AnalyzeResult, LlmInsight } from "@/lib/alpha-types";
import {
  generateObject,
  getResolvedLlm,
  isLlmAnalystConfigured,
  isOllamaReachable,
} from "@/lib/llm-provider";

const InsightSchema = z.object({
  p_expected_home_win: z
    .number()
    .min(0.05)
    .max(0.95)
    .describe(
      "Your fair probability that the HOME team wins the match. Synthesize elo p_model, every historical_context (RAG) row, and football judgment. Do not copy p_model verbatim unless RAG fully agrees.",
    ),
  headline: z
    .string()
    .describe("One punchy sentence: trade thesis or 'pass'."),
  thinking_steps: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(
      "Reasoning steps: cite Elo, RAG, match_conditions (altitude/travel), then adjustment to p_expected.",
    ),
  stance: z
    .enum(["agree", "disagree", "cautious"])
    .describe(
      "Vs Polymarket: agree = your p_expected vs p_market shows actionable edge; disagree = market looks right; cautious = edge exists but uncertain.",
    ),
  summary: z
    .string()
    .describe("2–4 sentences: your final view for a prediction-market bettor."),
  risks: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Concrete risks the Elo model does not capture."),
  trade_idea: z
    .string()
    .nullable()
    .describe("YES/NO/pass on home-win contract vs p_market, or null."),
});

export { isLlmAnalystConfigured };

type QuantForLlm = Omit<AnalyzeResult, "summary" | "verdict" | "llm" | "llm_skip_reason">;

function buildPrompt(quant: QuantForLlm): string {
  return [
    "You are a World Cup 2026 prediction-market analyst.",
    "Produce p_expected_home_win: your fair probability the HOME team wins.",
    "",
    "Inputs you MUST use:",
    "1. p_model — Elo + head-to-head baseline (anchor, not gospel).",
    "2. historical_context — keyword RAG rows; weight recent H2H and World Cup results heavily.",
    "3. p_market — Polymarket YES price for home win (if null, ignore market comparison).",
    "4. match_conditions — venue, altitude, heat/humidity, air quality, travel, jet lag; use ONLY facts listed there.",
    "",
    "Rules:",
    "- Output p_expected_home_win in [0.05, 0.95].",
    "- If RAG shows home dominated recent meetings, nudge above p_model; if away dominated, nudge below.",
    "- At high altitude (e.g. Mexico City ~2,240 m), nudge toward teams better suited per match_conditions; mention in risks.",
    "- Factor heat/humidity, cooling-break conditions, altitude, air quality, and jet lag when match_conditions notes them.",
    "- Do NOT invent scores not listed in historical_context.",
    "- Do NOT invent venue facts not in match_conditions.",
    "- stance compares YOUR p_expected_home_win to p_market (not the old elo-only edge).",
    "- Be direct; one sentence per thinking_step.",
    "",
    "historical_context (RAG):",
    JSON.stringify(quant.rag.hits, null, 2),
    "",
    "match_conditions (venue / altitude / travel):",
    JSON.stringify(quant.match_context, null, 2),
    "",
    "Quant baseline (JSON):",
    JSON.stringify(
      {
        match: quant.match,
        p_model: quant.p_model,
        p_market: quant.p_market,
        breakdown: quant.breakdown,
        market: quant.market,
        market_three_way: {
          home: quant.market.home_win,
          draw: quant.market.draw,
          away: quant.market.away_win,
        },
        data_gaps: quant.data_gaps,
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function generateAnalystInsight(
  quant: QuantForLlm,
): Promise<{ insight: LlmInsight | null; skipReason?: string }> {
  const resolved = getResolvedLlm();
  if (!resolved) {
    return { insight: null, skipReason: "no_api_key" };
  }

  if (resolved.provider === "ollama") {
    const up = await isOllamaReachable();
    if (!up) {
      return {
        insight: null,
        skipReason:
          "error: Ollama not reachable — run `ollama serve` and `ollama pull " +
          resolved.modelId +
          "`",
      };
    }
  }

  try {
    const { object } = await generateObject({
      model: resolved.model,
      schema: InsightSchema,
      temperature: 0.35,
      prompt: buildPrompt(quant),
    });

    const p = Number(Math.min(0.95, Math.max(0.05, object.p_expected_home_win)).toFixed(4));

    return {
      insight: {
        model: resolved.displayName,
        p_expected_home_win: p,
        headline: object.headline.trim(),
        thinking_steps: object.thinking_steps.map((s) => s.trim()),
        stance: object.stance,
        summary: object.summary.trim(),
        risks: object.risks.map((s) => s.trim()),
        trade_idea: object.trade_idea?.trim() ?? null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { insight: null, skipReason: `error: ${message}` };
  }
}
