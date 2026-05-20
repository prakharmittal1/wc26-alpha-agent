/** WC 2026 host-region cities — elevation & environment for match context (static). */

export type AltitudeBand = "sea_level" | "moderate" | "high";

export type VenueProfile = {
  city: string;
  country: "Mexico" | "United States" | "Canada";
  elevation_m: number;
  altitude_band: AltitudeBand;
  climate: string;
  /** Plain-language notes for analysts and UI. */
  notes: string[];
};

/** Normalized lookup keys (lowercase, no accents). */
const PROFILES: Record<string, VenueProfile> = {
  "mexico city": {
    city: "Mexico City",
    country: "Mexico",
    elevation_m: 2240,
    altitude_band: "high",
    climate: "Mild days, cool nights; thin air at altitude",
    notes: [
      "High altitude (~2,240 m) — extra stamina demand, ball travels faster.",
      "Teams acclimated in central Mexico or the Andes often adapt better.",
      "European or sea-level squads may fade late without acclimatization.",
    ],
  },
  guadalajara: {
    city: "Guadalajara",
    country: "Mexico",
    elevation_m: 1560,
    altitude_band: "moderate",
    climate: "Warm, relatively dry",
    notes: [
      "Moderate altitude (~1,560 m) — lighter than Mexico City but still a factor.",
    ],
  },
  monterrey: {
    city: "Monterrey",
    country: "Mexico",
    elevation_m: 540,
    altitude_band: "moderate",
    climate: "Hot summers",
    notes: ["Lower altitude than central Mexico but often very hot kickoffs."],
  },
  toronto: {
    city: "Toronto",
    country: "Canada",
    elevation_m: 75,
    altitude_band: "sea_level",
    climate: "Humid summers, cooler springs",
    notes: ["Sea-level venue; cross-border travel common for CONCACAF teams."],
  },
  vancouver: {
    city: "Vancouver",
    country: "Canada",
    elevation_m: 5,
    altitude_band: "sea_level",
    climate: "Mild, rainy",
    notes: ["Sea-level Pacific coast — long travel from Europe or South America."],
  },
  "new york": {
    city: "New York / New Jersey",
    country: "United States",
    elevation_m: 10,
    altitude_band: "sea_level",
    climate: "Humid summers",
    notes: ["Dense travel hub; typical sea-level conditions."],
  },
  "los angeles": {
    city: "Los Angeles",
    country: "United States",
    elevation_m: 90,
    altitude_band: "sea_level",
    climate: "Warm, dry",
    notes: ["Sea-level; long flight from Europe or east coast."],
  },
  miami: {
    city: "Miami",
    country: "United States",
    elevation_m: 2,
    altitude_band: "sea_level",
    climate: "Hot, humid",
    notes: ["Heat and humidity can favor deep squads with rotation."],
  },
  dallas: {
    city: "Dallas",
    country: "United States",
    elevation_m: 130,
    altitude_band: "sea_level",
    climate: "Hot",
    notes: ["Often very hot — stamina and hydration matter in summer kickoffs."],
  },
  houston: {
    city: "Houston",
    country: "United States",
    elevation_m: 15,
    altitude_band: "sea_level",
    climate: "Hot, humid",
    notes: ["Humidity similar to Gulf / Caribbean climates."],
  },
  atlanta: {
    city: "Atlanta",
    country: "United States",
    elevation_m: 320,
    altitude_band: "sea_level",
    climate: "Hot, humid summers",
    notes: ["Sea-level but hot and humid in summer tournaments."],
  },
  seattle: {
    city: "Seattle",
    country: "United States",
    elevation_m: 55,
    altitude_band: "sea_level",
    climate: "Mild, cooler",
    notes: ["Cooler than southern US hosts — different from Gulf heat."],
  },
  denver: {
    city: "Denver",
    country: "United States",
    elevation_m: 1609,
    altitude_band: "high",
    climate: "Dry, sunny",
    notes: [
      "High altitude (~1,600 m) if used — similar concerns to Mexico City, slightly lower.",
    ],
  },
  kansas: {
    city: "Kansas City",
    country: "United States",
    elevation_m: 270,
    altitude_band: "sea_level",
    climate: "Continental — hot summers",
    notes: ["Central US — mid-continent travel from coasts."],
  },
  philadelphia: {
    city: "Philadelphia",
    country: "United States",
    elevation_m: 12,
    altitude_band: "sea_level",
    climate: "Humid summers",
    notes: ["East-coast sea-level venue."],
  },
  boston: {
    city: "Boston",
    country: "United States",
    elevation_m: 10,
    altitude_band: "sea_level",
    climate: "Milder summers than south",
    notes: ["Sea-level northeast US."],
  },
  "san francisco": {
    city: "San Francisco Bay Area",
    country: "United States",
    elevation_m: 15,
    altitude_band: "sea_level",
    climate: "Cool, windy",
    notes: ["Cooler microclimate — can suit technical teams."],
  },
};

const VENUE_ALIASES: Record<string, string> = {
  azteca: "mexico city",
  "estadio azteca": "mexico city",
  cdmx: "mexico city",
  "ciudad de mexico": "mexico city",
  gdl: "guadalajara",
  akron: "guadalajara",
  bbva: "monterrey",
  "metlife stadium": "new york",
  "sofi stadium": "los angeles",
  "hard rock": "miami",
  "mercedes-benz": "atlanta",
  bcplace: "vancouver",
  "bmo field": "toronto",
};

export function normalizeVenueKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All FIFA WC 2026 host-city profiles (stable tile / fallback assignment). */
export const WC26_HOST_CITY_KEYS = Object.keys(PROFILES);

const MEXICO_HOST_KEYS = ["mexico city", "guadalajara", "monterrey"] as const;
const CANADA_HOST_KEYS = ["toronto", "vancouver"] as const;
const USA_HOST_KEYS = [
  "atlanta",
  "boston",
  "dallas",
  "houston",
  "kansas",
  "los angeles",
  "miami",
  "new york",
  "philadelphia",
  "san francisco",
  "seattle",
] as const;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFromKeys(seed: string, keys: readonly string[]): VenueProfile {
  const key = keys[hashSeed(seed) % keys.length]!;
  return PROFILES[key]!;
}

/** Deterministic host city when API venue is missing (WC group/knockout). */
export function pickWcHostCityProfile(
  home: string,
  away: string,
  kickoff_iso: string,
): VenueProfile {
  const seed = `${home}|${away}|${kickoff_iso.slice(0, 10)}`;
  return pickFromKeys(seed, WC26_HOST_CITY_KEYS);
}

export function pickHostNationCityProfile(
  host: "Mexico" | "United States" | "Canada",
  away: string,
  kickoff_iso: string,
): VenueProfile {
  const seed = `${host}|${away}|${kickoff_iso.slice(0, 10)}`;
  if (host === "Mexico") return pickFromKeys(seed, MEXICO_HOST_KEYS);
  if (host === "Canada") return pickFromKeys(seed, CANADA_HOST_KEYS);
  return pickFromKeys(seed, USA_HOST_KEYS);
}

export function lookupVenueProfile(venueOrCity: string): VenueProfile | null {
  const key = normalizeVenueKey(venueOrCity);
  if (!key) return null;

  const alias = VENUE_ALIASES[key];
  if (alias && PROFILES[alias]) return PROFILES[alias];

  if (PROFILES[key]) return PROFILES[key];

  for (const [profileKey, profile] of Object.entries(PROFILES)) {
    if (key.includes(profileKey) || profileKey.includes(key)) {
      return profile;
    }
    const cityKey = normalizeVenueKey(profile.city);
    if (key.includes(cityKey) || cityKey.includes(key)) return profile;
  }

  return null;
}
