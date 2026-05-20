/**
 * WC 2026 environmental factors (heat, altitude, travel, air quality).
 * Sourced from FIFA/Aspetar/Sports Medicine guidance on the 2026 tournament.
 */

import type { VenueProfile } from "@/lib/venues";
import type { Wc2026Team } from "@/lib/teams";

/** Tournament-wide stressors (shown in analysis when relevant). */
export const WC26_TOURNAMENT_NOTES: readonly string[] = [
  "Tournament spans Mexico, USA, and Canada (~4,000 km) — jet lag and inter-city travel are routine.",
  "Most host cities face hot or humid summer kickoffs; FIFA has mandated cooling breaks.",
  "Short turnarounds (often under 4 days) in later rounds add cumulative fatigue.",
];

export function heatHumidityNote(profile: VenueProfile): string | null {
  const c = profile.climate.toLowerCase();
  if (!/hot|humid|warm/.test(c)) return null;
  return "Heat and humidity raise cardiac load — favor deeper squads, rotation, and hydration prep.";
}

export function altitudeNote(profile: VenueProfile): string | null {
  if (profile.altitude_band === "high") {
    return "High altitude (~1,600–2,240 m) can reduce high-speed running and slow recovery for non-acclimatized players.";
  }
  if (profile.altitude_band === "moderate") {
    return "Moderate altitude still taxes aerobic capacity vs sea-level squads.";
  }
  return null;
}

export function airQualityNote(profile: VenueProfile): string | null {
  const city = profile.city.toLowerCase();
  if (city.includes("los angeles")) {
    return "Los Angeles can have elevated ozone/smog — a factor for players with asthma or allergies.";
  }
  if (profile.country === "Mexico" && profile.altitude_band !== "sea_level") {
    return "Urban Mexico venues may have higher particulate matter — respiratory sensitivity matters.";
  }
  return null;
}

export function circadianTravelNote(
  home: Wc2026Team,
  away: Wc2026Team,
  profile: VenueProfile,
): string | null {
  const intercontinental =
    profile.country === "United States" &&
    !["Mexico", "United States", "Canada"].includes(away);

  if (intercontinental) {
    return `${away} may cross several time zones before kickoff — circadian misalignment can hurt sharpness early in the match.`;
  }

  if (profile.country === "Canada" && home !== "Canada" && away !== "Canada") {
    return "Long-haul travel into Canada can compress recovery time before kickoff.";
  }

  return null;
}

export function collectVenueEnvironmentNotes(
  profile: VenueProfile,
  home: Wc2026Team,
  away: Wc2026Team,
  options?: { isWorldCup?: boolean },
): string[] {
  const notes: string[] = [];
  const heat = heatHumidityNote(profile);
  const alt = altitudeNote(profile);
  const air = airQualityNote(profile);
  const jet = circadianTravelNote(home, away, profile);

  if (heat) notes.push(heat);
  if (alt) notes.push(alt);
  if (air) notes.push(air);
  if (jet) notes.push(jet);

  if (options?.isWorldCup && profile.country === "United States") {
    notes.push(
      "US host cities vary from cool Pacific (Seattle) to Gulf heat (Miami/Houston) — climate mismatch between games is common.",
    );
  }

  return notes;
}
