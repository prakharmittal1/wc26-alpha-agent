import { describe, expect, it } from "vitest";

import { ALPHA_THRESHOLD, classifySignal, computeEv } from "@/lib/ev";

describe("computeEv", () => {
  it("computes positive EV when model exceeds market", () => {
    const r = computeEv({ p_true: 0.6, p_market: 0.45 });
    expect(r.ev).toBeGreaterThan(0);
    expect(r.edge).toBeCloseTo(0.15, 4);
    expect(r.alpha_signal).toBe(true);
  });

  it("flips for NO side", () => {
    const r = computeEv({ p_true: 0.4, p_market: 0.55, side: "no" });
    expect(r.p_true_adjusted).toBeCloseTo(0.6, 4);
    expect(r.p_market_adjusted).toBeCloseTo(0.45, 4);
  });
});

describe("classifySignal", () => {
  it("respects threshold", () => {
    expect(classifySignal(ALPHA_THRESHOLD + 0.01)).toBe("ALPHA_YES");
    expect(classifySignal(-ALPHA_THRESHOLD - 0.01)).toBe("ALPHA_NO");
    expect(classifySignal(0.02)).toBe("NONE");
  });
});
