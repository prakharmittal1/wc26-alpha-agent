/**
 * Canonical national-team names for WC 2026 discourse.
 *
 * We over-include nations likely to appear in WC 2026 coverage,
 * even if qualification is still uncertain.
 */

export const WC2026_TEAMS = [
  // Hosts
  "United States",
  "Canada",
  "Mexico",

  // CONMEBOL
  "Brazil",
  "Argentina",
  "Uruguay",
  "Colombia",
  "Ecuador",
  "Paraguay",
  "Chile",
  "Peru",
  "Bolivia",
  "Venezuela",

  // CONCACAF (non-host)
  "Costa Rica",
  "Jamaica",
  "Panama",
  "Honduras",
  "El Salvador",
  "Guatemala",
  "Haiti",
  "Trinidad and Tobago",
  "Curaçao",

  // UEFA
  "England",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Portugal",
  "Belgium",
  "Netherlands",
  "Croatia",
  "Denmark",
  "Switzerland",
  "Austria",
  "Poland",
  "Norway",
  "Hungary",
  "Sweden",
  "Czechia",
  "Türkiye",
  "Wales",
  "Ukraine",
  "Scotland",
  "Serbia",
  "Greece",
  "Slovakia",
  "Slovenia",
  "Republic of Ireland",
  "Albania",
  "Romania",
  "Bosnia and Herzegovina",
  "Iceland",
  "Finland",
  "North Macedonia",

  // AFC
  "Japan",
  "South Korea",
  "Iran",
  "Saudi Arabia",
  "Australia",
  "Qatar",
  "Iraq",
  "United Arab Emirates",
  "Uzbekistan",
  "Jordan",
  "China",

  // CAF
  "Morocco",
  "Senegal",
  "Egypt",
  "Tunisia",
  "Algeria",
  "Nigeria",
  "Cameroon",
  "Ghana",
  "Ivory Coast",
  "South Africa",
  "Mali",
  "Cape Verde",
  "DR Congo",

  // OFC
  "New Zealand",
] as const;

export type Wc2026Team = (typeof WC2026_TEAMS)[number];

/**
 * Common alternate spellings / FIFA codes / colloquialisms -> canonical.
 * All keys are lower-cased; lookup happens after `.toLowerCase().trim()`.
 *
 * Add aggressively, but never collide on an ambiguous token (e.g. "Korea"
 * is intentionally absent because it could mean either Korea).
 */
const RAW_ALIASES: Record<string, Wc2026Team> = {
  // United States
  "usa": "United States",
  "u.s.a.": "United States",
  "us": "United States",
  "u.s.": "United States",
  "usmnt": "United States",
  "american": "United States",
  "americans": "United States",
  "united states of america": "United States",

  // Brazil
  "bra": "Brazil",
  "brasil": "Brazil",
  "seleção": "Brazil",
  "selecao": "Brazil",

  // Argentina
  "arg": "Argentina",
  "argentinian": "Argentina",
  "albiceleste": "Argentina",

  // Mexico
  "mex": "Mexico",
  "el tri": "Mexico",
  "méxico": "Mexico",
  "tri": "Mexico",

  // Türkiye / Turkey
  "tur": "Türkiye",
  "turkey": "Türkiye",
  "turkiye": "Türkiye",

  // South Korea
  "kor": "South Korea",
  "korea republic": "South Korea",
  "republic of korea": "South Korea",
  "south korean": "South Korea",

  // Iran
  "irn": "Iran",
  "ir iran": "Iran",
  "islamic republic of iran": "Iran",
  "team melli": "Iran",

  // England
  "eng": "England",
  "three lions": "England",
  "english": "England",

  // Czechia
  "cze": "Czechia",
  "czech": "Czechia",
  "czech republic": "Czechia",

  // Republic of Ireland
  "ireland": "Republic of Ireland",
  "irl": "Republic of Ireland",
  "roi": "Republic of Ireland",

  // Netherlands
  "ned": "Netherlands",
  "holland": "Netherlands",
  "dutch": "Netherlands",
  "oranje": "Netherlands",

  // Bosnia
  "bosnia": "Bosnia and Herzegovina",
  "bih": "Bosnia and Herzegovina",

  // North Macedonia
  "macedonia": "North Macedonia",
  "mkd": "North Macedonia",

  // Saudi Arabia
  "ksa": "Saudi Arabia",
  "saudi": "Saudi Arabia",
  "green falcons": "Saudi Arabia",

  // UAE
  "uae": "United Arab Emirates",

  // Ivory Coast
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "civ": "Ivory Coast",

  // DR Congo
  "congo dr": "DR Congo",
  "drc": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "democratic republic of congo": "DR Congo",
  "dr. congo": "DR Congo",

  // Cape Verde
  "cabo verde": "Cape Verde",

  // Curaçao
  "curacao": "Curaçao",

  // Trinidad
  "trinidad": "Trinidad and Tobago",
  "t&t": "Trinidad and Tobago",

  // New Zealand
  "all whites": "New Zealand",
  "nzl": "New Zealand",

  // FIFA / Opta spelling variants surfaced by API vendors
  "china pr": "China",
};

const CANONICAL_BY_LOWER: Map<string, Wc2026Team> = (() => {
  const m = new Map<string, Wc2026Team>();
  for (const t of WC2026_TEAMS) m.set(t.toLowerCase(), t);
  for (const [k, v] of Object.entries(RAW_ALIASES)) m.set(k.toLowerCase(), v);
  return m;
})();

export function canonicalizeTeam(input: string): Wc2026Team | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return CANONICAL_BY_LOWER.get(key) ?? null;
}

export function canonicalizeMany(inputs: readonly string[]): Wc2026Team[] {
  const out = new Set<Wc2026Team>();
  for (const raw of inputs) {
    const c = canonicalizeTeam(raw);
    if (c) out.add(c);
  }
  return [...out];
}
