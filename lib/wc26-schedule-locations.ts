/** Map fixturedownload.com Location strings → tile city labels. */
export const WC26_LOCATION_TO_CITY: Record<string, string> = {
  "Atlanta Stadium": "Atlanta",
  "BC Place Vancouver": "Vancouver",
  "Boston Stadium": "Boston",
  "Dallas Stadium": "Dallas",
  "Guadalajara Stadium": "Guadalajara",
  "Houston Stadium": "Houston",
  "Kansas City Stadium": "Kansas City",
  "Los Angeles Stadium": "Los Angeles",
  "Mexico City Stadium": "Mexico City",
  "Miami Stadium": "Miami",
  "Monterrey Stadium": "Monterrey",
  "New York/New Jersey Stadium": "New York / New Jersey",
  "Philadelphia Stadium": "Philadelphia",
  "San Francisco Bay Area Stadium": "San Francisco Bay Area",
  "Seattle Stadium": "Seattle",
  "Toronto Stadium": "Toronto",
};

export function cityFromScheduleLocation(location: string): string | null {
  const trimmed = location.trim();
  return WC26_LOCATION_TO_CITY[trimmed] ?? null;
}
