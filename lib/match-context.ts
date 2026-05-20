import type { MatchContext } from "@/lib/alpha-types";
export type { MatchContext } from "@/lib/alpha-types";
import { lookupWc26ScheduledVenue } from "@/lib/wc26-schedule";
import {
  lookupVenueProfile,
  pickHostNationCityProfile,
  type VenueProfile,
} from "@/lib/venues";
import type { Wc2026Team } from "@/lib/teams";
import {
  collectVenueEnvironmentNotes,
  WC26_TOURNAMENT_NOTES,
} from "@/lib/wc26-environment";

const HOSTS = new Set<Wc2026Team>(["Mexico", "United States", "Canada"]);

/** Teams often cited as less adapted to high altitude (heuristic for travel notes). */
const SEA_LEVEL_FEDERATIONS = new Set<Wc2026Team>([
  "England",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Portugal",
  "Denmark",
  "Sweden",
  "Norway",
  "Republic of Ireland",
  "Scotland",
  "Wales",
  "Japan",
  "South Korea",
  "Australia",
  "Nigeria",
  "Ghana",
  "Senegal",
  "Morocco",
  "Tunisia",
  "Cameroon",
  "Ivory Coast",
]);

export type ResolveMatchContextInput = {
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  competition?: string;
  venue?: string | null;
  city?: string | null;
  is_world_cup?: boolean;
};

function isWorldCupMatch(competition?: string, flag?: boolean): boolean {
  if (flag) return true;
  return /world cup|fifa wc|\bwc\b/i.test(competition ?? "");
}

function profileToContext(
  profile: VenueProfile,
  venueLabel: string,
  source: MatchContext["source"],
  extraTravel: string[],
  venueNotes: string[],
): MatchContext {
  return {
    venue_label: venueLabel,
    city: profile.city,
    country: profile.country,
    elevation_m: profile.elevation_m,
    altitude_band: profile.altitude_band,
    climate: profile.climate,
    venue_notes: [...profile.notes, ...venueNotes],
    travel_notes: extraTravel,
    source,
  };
}

function inferHostVenue(
  home: Wc2026Team,
  away: Wc2026Team,
  kickoff_iso: string,
  isWc: boolean,
): VenueProfile | null {
  if (!isWc || !HOSTS.has(home)) return null;
  if (home === "Mexico") return pickHostNationCityProfile("Mexico", away, kickoff_iso);
  if (home === "Canada") return pickHostNationCityProfile("Canada", away, kickoff_iso);
  if (home === "United States") {
    return pickHostNationCityProfile("United States", away, kickoff_iso);
  }
  return null;
}

function buildTravelNotes(
  home: Wc2026Team,
  away: Wc2026Team,
  profile: VenueProfile | null,
): string[] {
  const notes: string[] = [];

  if (profile?.altitude_band === "high") {
    if (SEA_LEVEL_FEDERATIONS.has(away) || away === "United States") {
      notes.push(
        `${away} often plays from sea-level conditions — altitude at ${profile.city} can be a disadvantage without prep.`,
      );
    }
    if (away === "Mexico" || away === "Ecuador" || away === "Colombia" || away === "Bolivia") {
      notes.push(`${away} has more experience at altitude in the Americas.`);
    }
  }

  if (profile?.country === "United States" && !HOSTS.has(away)) {
    notes.push(
      `Intercontinental travel: ${away} may face long flights and time-zone shifts before kickoff.`,
    );
  }

  if (profile?.country === "Mexico" && home === "Mexico" && away === "United States") {
    notes.push("Short regional travel — familiar CONCACAF conditions for both sides.");
  }

  if (
    profile?.climate.toLowerCase().includes("humid") ||
    profile?.climate.toLowerCase().includes("hot")
  ) {
    notes.push("Heat/humidity may favor the side with deeper squads and rotation.");
  }

  return notes;
}

function finalizeContext(
  profile: VenueProfile,
  venueLabel: string,
  source: MatchContext["source"],
  input: ResolveMatchContextInput,
  isWc: boolean,
): MatchContext {
  const travel = buildTravelNotes(input.home, input.away, profile);
  const env = collectVenueEnvironmentNotes(profile, input.home, input.away, {
    isWorldCup: isWc,
  });
  if (isWc) {
    travel.push(WC26_TOURNAMENT_NOTES[0]!);
  }
  return profileToContext(profile, venueLabel, source, travel, env);
}

/**
 * Resolve venue, altitude, and travel context for a fixture (no external APIs).
 */
export function resolveMatchContext(input: ResolveMatchContextInput): MatchContext {
  const isWc = isWorldCupMatch(input.competition, input.is_world_cup);
  const travelFromProfile: string[] = [];

  const candidates = [input.venue, input.city].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );

  for (const raw of candidates) {
    const profile = lookupVenueProfile(raw);
    if (profile) {
      return finalizeContext(profile, raw.trim(), "venue", input, isWc);
    }
  }

  if (isWc) {
    const scheduled = lookupWc26ScheduledVenue(
      input.home,
      input.away,
      input.kickoff_iso,
    );
    if (scheduled) {
      const profile = lookupVenueProfile(scheduled.city);
      if (profile) {
        return finalizeContext(
          profile,
          scheduled.location,
          "venue",
          input,
          isWc,
        );
      }
      return {
        venue_label: scheduled.location,
        city: scheduled.city,
        country: null,
        elevation_m: null,
        altitude_band: null,
        climate: null,
        venue_notes: [],
        travel_notes: isWc ? [WC26_TOURNAMENT_NOTES[0]!] : [],
        source: "venue",
      };
    }
  }

  const inferred = inferHostVenue(input.home, input.away, input.kickoff_iso, isWc);
  if (inferred) {
    const label = `${inferred.city} (${input.home} host)`;
    return finalizeContext(inferred, label, "inferred", input, isWc);
  }

  if (HOSTS.has(input.home) && isWc) {
    travelFromProfile.push(
      `${input.home} is a 2026 World Cup co-host — home crowd and familiar logistics help the home side.`,
    );
  }

  return {
    venue_label: null,
    city: null,
    country: null,
    elevation_m: null,
    altitude_band: null,
    climate: null,
    venue_notes: [],
    travel_notes: travelFromProfile,
    source: "unknown",
  };
}

/** City name for match tiles (always defined for World Cup fixtures). */
export function tileCityForFixture(input: ResolveMatchContextInput): string | null {
  const ctx = resolveMatchContext(input);
  if (ctx.city) return ctx.city;
  return null;
}

/** One-line summary for UI (plain language). */
export function matchContextHeadline(ctx: MatchContext): string | null {
  if (ctx.city) {
    if (ctx.altitude_band === "high") {
      return `${ctx.city} · high-altitude stadium`;
    }
    if (ctx.altitude_band === "moderate") {
      return `${ctx.city} · some altitude`;
    }
    return ctx.city;
  }
  if (ctx.travel_notes.length > 0 && !ctx.city) {
    return "Travel and home advantage may matter";
  }
  return null;
}

function normVenueText(s: string): string {
  return s.trim().toLowerCase();
}

/** Avoid repeating city name when venue_label and headline say the same thing. */
export function formatMatchVenueDisplay(ctx: MatchContext): {
  title: string | null;
  detail: string | null;
} {
  const label = ctx.venue_label?.trim() ?? null;
  const city = ctx.city?.trim() ?? null;
  const headline = matchContextHeadline(ctx);

  let title: string | null = null;
  if (label && city) {
    const labelN = normVenueText(label);
    const cityN = normVenueText(city);
    title = labelN === cityN ? city : label;
  } else {
    title = label ?? city ?? headline;
  }

  let detail: string | null = null;
  if (headline && title) {
    const headlineN = normVenueText(headline);
    const titleN = normVenueText(title);
    const cityN = city ? normVenueText(city) : null;
    const redundant =
      headlineN === titleN ||
      (cityN != null && headlineN === cityN && titleN !== cityN);
    if (!redundant) detail = headline;
  } else if (headline && !title) {
    detail = headline;
  }

  return { title, detail };
}
