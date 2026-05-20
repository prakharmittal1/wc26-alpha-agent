import { describe, expect, it } from "vitest";

import { lookupWc26ScheduledVenue } from "@/lib/wc26-schedule";

describe("lookupWc26ScheduledVenue", () => {
  it("returns Seattle for Belgium vs Egypt on 2026-06-15", () => {
    const row = lookupWc26ScheduledVenue(
      "Belgium",
      "Egypt",
      "2026-06-15T19:00:00Z",
    );
    expect(row?.city).toBe("Seattle");
    expect(row?.location).toBe("Seattle Stadium");
  });

  it("returns Vancouver for New Zealand vs Egypt on 2026-06-22", () => {
    const row = lookupWc26ScheduledVenue(
      "New Zealand",
      "Egypt",
      "2026-06-22T01:00:00Z",
    );
    expect(row?.city).toBe("Vancouver");
  });
});
