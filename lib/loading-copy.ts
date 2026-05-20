/** Rotating lines shown while a match is analyzed. */
export const SOCCER_LOADING_MESSAGES = [
  "Checking form and past meetings…",
  "Reading venue, travel, and altitude…",
  "Comparing our pick to market odds…",
  "Digging into head-to-head history…",
  "Factoring in home advantage…",
  "Sizing up this World Cup matchup…",
  "Warming up the win probabilities…",
  "Checking win, draw, and loss prices…",
  "Looking for where the odds look off…",
  "Running the numbers on both squads…",
] as const;

export function pickSoccerLoadingMessage(): string {
  const i = Math.floor(Math.random() * SOCCER_LOADING_MESSAGES.length);
  return SOCCER_LOADING_MESSAGES[i]!;
}
