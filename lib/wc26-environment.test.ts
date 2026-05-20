import { describe, expect, it } from "vitest";

import { lookupVenueProfile } from "@/lib/venues";
import { collectVenueEnvironmentNotes, heatHumidityNote } from "@/lib/wc26-environment";

describe("wc26-environment", () => {
  it("flags heat for humid host cities", () => {
    const miami = lookupVenueProfile("Miami");
    expect(miami).not.toBeNull();
    expect(heatHumidityNote(miami!)).toMatch(/heat/i);
  });

  it("bundles altitude and air-quality style notes", () => {
    const cdmx = lookupVenueProfile("Mexico City");
    const notes = collectVenueEnvironmentNotes(cdmx!, "Mexico", "England", {
      isWorldCup: true,
    });
    expect(notes.some((n) => /altitude/i.test(n))).toBe(true);
  });
});
