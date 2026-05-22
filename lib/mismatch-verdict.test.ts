import { describe, expect, it } from "vitest";

import type { AnalyzeResult } from "@/lib/alpha-types";
import { buildMismatchVerdict } from "@/lib/mismatch-verdict";

function baseResult(overrides: Partial<AnalyzeResult> = {}): AnalyzeResult {
  return {
    match: {
      home: "Mexico",
      away: "United States",
      kickoff_iso: "2026-06-11T19:00:00Z",
      competition: "FIFA World Cup",
    },
    p_market: 0.46,
    p_model: 0.72,
    p_expected: 0.64,
    p_expected_source: "llm",
    edge: 0.18,
    signal: "ALPHA_YES",
    ev_per_unit: 0.39,
    breakdown: {
      elo_home: 1650,
      elo_away: 1570,
      home_advantage: 65,
      h2h_adjustment: 0.02,
      base_p_home: 0.7,
    },
    market: {
      slug: "fifwc-mex-usa",
      source: "polymarket",
      home_win: 0.46,
      draw: 0.22,
      away_win: 0.32,
    },
    data_gaps: [],
    match_context: {
      venue_label: "Mexico City",
      city: "Mexico City",
      country: "Mexico",
      elevation_m: 2240,
      altitude_band: "high",
      climate: "High altitude",
      venue_notes: ["Altitude factor"],
      travel_notes: [],
      source: "venue",
    },
    rag: { built_at: "2026-01-01", hits: [{ id: "1", content: "x", date: "2020", tournament: "t", score: 1 }] },
    summary: "",
    elo_built_at: "2026-01-01",
    llm: null,
    sentiment: null,
    verdict: {
      alignment: "aligned",
      headline: "",
      summary: "",
      comparison_line: "",
      factors_used: [],
      takeaway: "",
      gap_pp: null,
    },
    ...overrides,
  };
}

describe("buildMismatchVerdict", () => {
  it("flags when we are higher than market", () => {
    const v = buildMismatchVerdict(baseResult());
    expect(v.alignment).toBe("we_higher");
    expect(v.gap_pp).toBe(18);
    expect(v.headline).toBe("Odds look low on Mexico");
    expect(v.factors_used.some((f) => /Past meetings/i.test(f))).toBe(true);
    expect(v.factors_used.some((f) => /^AI /i.test(f))).toBe(true);
  });

  it("reports aligned when gap is small", () => {
    const v = buildMismatchVerdict(
      baseResult({ edge: 0.02, p_expected: 0.47, signal: "NONE" }),
    );
    expect(v.alignment).toBe("aligned");
  });
});
