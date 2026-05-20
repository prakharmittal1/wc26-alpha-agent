import { describe, expect, it } from "vitest";

import {
  parseThreeWayFromEvent,
  parseVersusTitle,
  type GammaEvent,
} from "@/lib/polymarket-gamma";

describe("parseThreeWayFromEvent", () => {
  it("parses Mexico vs South Africa moneyline shards", () => {
    const event: GammaEvent = {
      id: "351715",
      title: "Mexico vs. South Africa",
      slug: "fifwc-mex-rsa-2026-06-11",
      eventDate: "2026-06-11",
      endDate: "2026-06-11T19:00:00Z",
      markets: [
        {
          question: "Will Mexico win on 2026-06-11?",
          outcomes: '["Yes", "No"]',
          outcomePrices: '["0.665", "0.335"]',
          active: true,
          closed: false,
        },
        {
          question: "Will Mexico vs. South Africa end in a draw?",
          outcomes: '["Yes", "No"]',
          outcomePrices: '["0.215", "0.785"]',
          active: true,
          closed: false,
        },
        {
          question: "Will South Africa win on 2026-06-11?",
          outcomes: '["Yes", "No"]',
          outcomePrices: '["0.125", "0.875"]',
          active: true,
          closed: false,
        },
      ],
    };

    const parsed = parseThreeWayFromEvent(event);
    expect(parsed).not.toBeNull();
    expect(parsed!.home).toBe("Mexico");
    expect(parsed!.away).toBe("South Africa");
    expect(parsed!.prices.home).toBeCloseTo(0.665, 3);
    expect(parsed!.prices.draw).toBeCloseTo(0.215, 3);
    expect(parsed!.prices.away).toBeCloseTo(0.125, 3);
  });
});

describe("parseVersusTitle", () => {
  it("canonicalizes Korea Republic", () => {
    const sides = parseVersusTitle("Korea Republic vs. Czechia");
    expect(sides?.home).toBe("South Korea");
    expect(sides?.away).toBe("Czechia");
  });
});
