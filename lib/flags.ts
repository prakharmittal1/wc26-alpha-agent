/**
 * Canonical-team -> regional-indicator flag emoji.
 *
 * Keys are the canonical names from lib/teams.ts. Anything not in here
 * falls back to a neutral globe via `flagFor()`.
 */

import type { Wc2026Team } from "@/lib/teams";

const TABLE: Record<Wc2026Team, string> = {
  // Hosts
  "United States": "\u{1F1FA}\u{1F1F8}",
  "Canada": "\u{1F1E8}\u{1F1E6}",
  "Mexico": "\u{1F1F2}\u{1F1FD}",

  // CONMEBOL
  "Brazil": "\u{1F1E7}\u{1F1F7}",
  "Argentina": "\u{1F1E6}\u{1F1F7}",
  "Uruguay": "\u{1F1FA}\u{1F1FE}",
  "Colombia": "\u{1F1E8}\u{1F1F4}",
  "Ecuador": "\u{1F1EA}\u{1F1E8}",
  "Paraguay": "\u{1F1F5}\u{1F1FE}",
  "Chile": "\u{1F1E8}\u{1F1F1}",
  "Peru": "\u{1F1F5}\u{1F1EA}",
  "Bolivia": "\u{1F1E7}\u{1F1F4}",
  "Venezuela": "\u{1F1FB}\u{1F1EA}",

  // CONCACAF (non-host)
  "Costa Rica": "\u{1F1E8}\u{1F1F7}",
  "Jamaica": "\u{1F1EF}\u{1F1F2}",
  "Panama": "\u{1F1F5}\u{1F1E6}",
  "Honduras": "\u{1F1ED}\u{1F1F3}",
  "El Salvador": "\u{1F1F8}\u{1F1FB}",
  "Guatemala": "\u{1F1EC}\u{1F1F9}",
  "Haiti": "\u{1F1ED}\u{1F1F9}",
  "Trinidad and Tobago": "\u{1F1F9}\u{1F1F9}",
  "Curaçao": "\u{1F1E8}\u{1F1FC}",

  // UEFA
  "England": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "France": "\u{1F1EB}\u{1F1F7}",
  "Germany": "\u{1F1E9}\u{1F1EA}",
  "Spain": "\u{1F1EA}\u{1F1F8}",
  "Italy": "\u{1F1EE}\u{1F1F9}",
  "Portugal": "\u{1F1F5}\u{1F1F9}",
  "Belgium": "\u{1F1E7}\u{1F1EA}",
  "Netherlands": "\u{1F1F3}\u{1F1F1}",
  "Croatia": "\u{1F1ED}\u{1F1F7}",
  "Denmark": "\u{1F1E9}\u{1F1F0}",
  "Switzerland": "\u{1F1E8}\u{1F1ED}",
  "Austria": "\u{1F1E6}\u{1F1F9}",
  "Poland": "\u{1F1F5}\u{1F1F1}",
  "Norway": "\u{1F1F3}\u{1F1F4}",
  "Hungary": "\u{1F1ED}\u{1F1FA}",
  "Sweden": "\u{1F1F8}\u{1F1EA}",
  "Czechia": "\u{1F1E8}\u{1F1FF}",
  "Türkiye": "\u{1F1F9}\u{1F1F7}",
  "Wales": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  "Ukraine": "\u{1F1FA}\u{1F1E6}",
  "Scotland": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "Serbia": "\u{1F1F7}\u{1F1F8}",
  "Greece": "\u{1F1EC}\u{1F1F7}",
  "Slovakia": "\u{1F1F8}\u{1F1F0}",
  "Slovenia": "\u{1F1F8}\u{1F1EE}",
  "Republic of Ireland": "\u{1F1EE}\u{1F1EA}",
  "Albania": "\u{1F1E6}\u{1F1F1}",
  "Romania": "\u{1F1F7}\u{1F1F4}",
  "Bosnia and Herzegovina": "\u{1F1E7}\u{1F1E6}",
  "Iceland": "\u{1F1EE}\u{1F1F8}",
  "Finland": "\u{1F1EB}\u{1F1EE}",
  "North Macedonia": "\u{1F1F2}\u{1F1F0}",

  // AFC
  "Japan": "\u{1F1EF}\u{1F1F5}",
  "South Korea": "\u{1F1F0}\u{1F1F7}",
  "Iran": "\u{1F1EE}\u{1F1F7}",
  "Saudi Arabia": "\u{1F1F8}\u{1F1E6}",
  "Australia": "\u{1F1E6}\u{1F1FA}",
  "Qatar": "\u{1F1F6}\u{1F1E6}",
  "Iraq": "\u{1F1EE}\u{1F1F6}",
  "United Arab Emirates": "\u{1F1E6}\u{1F1EA}",
  "Uzbekistan": "\u{1F1FA}\u{1F1FF}",
  "Jordan": "\u{1F1EF}\u{1F1F4}",
  "China": "\u{1F1E8}\u{1F1F3}",

  // CAF
  "Morocco": "\u{1F1F2}\u{1F1E6}",
  "Senegal": "\u{1F1F8}\u{1F1F3}",
  "Egypt": "\u{1F1EA}\u{1F1EC}",
  "Tunisia": "\u{1F1F9}\u{1F1F3}",
  "Algeria": "\u{1F1E9}\u{1F1FF}",
  "Nigeria": "\u{1F1F3}\u{1F1EC}",
  "Cameroon": "\u{1F1E8}\u{1F1F2}",
  "Ghana": "\u{1F1EC}\u{1F1ED}",
  "Ivory Coast": "\u{1F1E8}\u{1F1EE}",
  "South Africa": "\u{1F1FF}\u{1F1E6}",
  "Mali": "\u{1F1F2}\u{1F1F1}",
  "Cape Verde": "\u{1F1E8}\u{1F1FB}",
  "DR Congo": "\u{1F1E8}\u{1F1E9}",

  // OFC
  "New Zealand": "\u{1F1F3}\u{1F1FF}",
};

export function flagFor(team: Wc2026Team | string): string {
  return TABLE[team as Wc2026Team] ?? "\u{1F3F3}\u{FE0F}";
}

/** Host nations of WC 2026, ordered USA -> Canada -> Mexico. */
export const HOST_NATIONS: readonly { team: Wc2026Team; tag: string }[] = [
  { team: "United States", tag: "USA" },
  { team: "Canada", tag: "CAN" },
  { team: "Mexico", tag: "MEX" },
];
