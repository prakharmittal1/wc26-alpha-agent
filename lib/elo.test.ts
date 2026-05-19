import { describe, expect, it } from "vitest";

import {
  clampProbability,
  homeWinProbability,
  type EloRatingsFile,
} from "@/lib/elo-math";

const TEST_RATINGS: EloRatingsFile = {
  built_at: "test",
  source: "test",
  ratings: { Brazil: 2100, Bolivia: 1700 },
};

describe("homeWinProbability", () => {
  it("favors stronger home team", () => {
    const p = homeWinProbability("Brazil", "Bolivia", TEST_RATINGS);
    expect(p).toBeGreaterThan(0.7);
  });

  it("clamps extremes", () => {
    expect(clampProbability(0.01)).toBe(0.05);
    expect(clampProbability(0.99)).toBe(0.95);
  });
});
