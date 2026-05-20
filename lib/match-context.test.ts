import { describe, expect, it } from "vitest";

import {
  formatMatchVenueDisplay,
  matchContextHeadline,
  resolveMatchContext,
} from "@/lib/match-context";

describe("resolveMatchContext", () => {
  it("resolves Mexico City altitude from venue string", () => {
    const ctx = resolveMatchContext({
      home: "Mexico",
      away: "United States",
      kickoff_iso: "2026-06-15T01:00:00Z",
      venue: "Estadio Azteca, Mexico City",
    });
    expect(ctx.city).toBe("Mexico City");
    expect(ctx.elevation_m).toBeGreaterThan(2000);
    expect(ctx.altitude_band).toBe("high");
    expect(ctx.venue_notes.length).toBeGreaterThan(0);
    const combined = [...ctx.venue_notes, ...ctx.travel_notes].join(" ");
    expect(/altitude|regional travel/i.test(combined)).toBe(true);
  });

  it("infers a Mexico host city for WC host home when venue missing", () => {
    const ctx = resolveMatchContext({
      home: "Mexico",
      away: "Brazil",
      kickoff_iso: "2026-07-01T20:00:00Z",
      competition: "FIFA World Cup",
      is_world_cup: true,
    });
    expect(ctx.source).toBe("inferred");
    expect(ctx.city).toBeTruthy();
    expect(["Mexico City", "Guadalajara", "Monterrey"]).toContain(ctx.city);
  });

  it("uses official schedule city for Belgium vs Egypt", () => {
    const ctx = resolveMatchContext({
      home: "Belgium",
      away: "Egypt",
      kickoff_iso: "2026-06-15T19:00:00Z",
      competition: "FIFA World Cup",
      is_world_cup: true,
    });
    expect(ctx.city).toBe("Seattle");
    expect(ctx.source).toBe("venue");
  });

  it("does not duplicate Dallas when venue and headline are the same city", () => {
    const ctx = resolveMatchContext({
      home: "United States",
      away: "England",
      kickoff_iso: "2026-06-20T19:00:00Z",
      venue: "Dallas",
      competition: "FIFA World Cup",
    });
    expect(ctx.city).toBe("Dallas");
    expect(ctx.venue_label).toBe("Dallas");
    expect(matchContextHeadline(ctx)).toBe("Dallas");
    expect(formatMatchVenueDisplay(ctx)).toEqual({ title: "Dallas", detail: null });
  });

  it("shows stadium label once with city-only headline folded in", () => {
    const ctx = resolveMatchContext({
      home: "Belgium",
      away: "Egypt",
      kickoff_iso: "2026-06-15T19:00:00Z",
      competition: "FIFA World Cup",
      is_world_cup: true,
    });
    if (ctx.venue_label && ctx.city && ctx.venue_label !== ctx.city) {
      const display = formatMatchVenueDisplay(ctx);
      expect(display.title).toBe(ctx.venue_label);
      expect(display.detail).not.toBe(ctx.city);
    }
  });

  it("includes heat and travel environment notes for Miami", () => {
    const ctx = resolveMatchContext({
      home: "United States",
      away: "England",
      kickoff_iso: "2026-07-10T22:00:00Z",
      venue: "Miami",
      competition: "FIFA World Cup",
    });
    const text = [...ctx.venue_notes, ...ctx.travel_notes].join(" ");
    expect(/heat|humid/i.test(text)).toBe(true);
    expect(/time zone|travel|jet lag/i.test(text)).toBe(true);
  });
});
