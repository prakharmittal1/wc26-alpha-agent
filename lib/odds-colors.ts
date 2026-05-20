/** Shared home / draw / away styling for odds UI (tiles + breakdown). */

export type OutcomeSide = "home" | "draw" | "away";

export type OddsFillStyle = {
  backgroundColor: string;
  color: string;
  boxShadow?: string;
  borderColor?: string;
};

function clampProbability(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1, Math.max(0, p));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixRgb(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): string {
  const r = Math.round(lerp(from[0], to[0], t));
  const g = Math.round(lerp(from[1], to[1], t));
  const b = Math.round(lerp(from[2], to[2], t));
  return `rgb(${r} ${g} ${b})`;
}

/** 0 = faint, 1 = deep — follows implied win probability. */
export function oddsColorIntensity(probability: number): number {
  return clampProbability(probability);
}

const GREEN_BG_LIGHT: [number, number, number] = [187, 247, 208];
const GREEN_BG_DARK: [number, number, number] = [21, 128, 61];
const GREEN_SHADOW_LIGHT: [number, number, number] = [134, 239, 172];
const GREEN_SHADOW_DARK: [number, number, number] = [20, 83, 45];

const RED_BG_LIGHT: [number, number, number] = [254, 202, 202];
const RED_BG_DARK: [number, number, number] = [185, 28, 28];
const RED_SHADOW_LIGHT: [number, number, number] = [248, 113, 113];
const RED_SHADOW_DARK: [number, number, number] = [127, 29, 29];

const GREEN_TEXT_DARK: [number, number, number] = [20, 83, 45];
const RED_TEXT_DARK: [number, number, number] = [127, 29, 29];

function textOnIntensity(t: number, dark: readonly [number, number, number]): string {
  return t >= 0.52 ? "#ffffff" : mixRgb(dark, [255, 255, 255], t * 0.35);
}

/** Polymarket-style pills on match tiles (green / white / red). */
export function polyPillStyle(probability: number, variant: OutcomeSide): OddsFillStyle {
  const t = oddsColorIntensity(probability);

  if (variant === "draw") {
    return {
      backgroundColor: "#ffffff",
      color: "#18181b",
      boxShadow: "0 3px 0 #d4d4d8",
      borderColor: "#e4e4e7",
    };
  }

  if (variant === "home") {
    const backgroundColor = mixRgb(GREEN_BG_LIGHT, GREEN_BG_DARK, t);
    const shadow = mixRgb(GREEN_SHADOW_LIGHT, GREEN_SHADOW_DARK, t);
    return {
      backgroundColor,
      color: textOnIntensity(t, GREEN_TEXT_DARK),
      boxShadow: `0 3px 0 ${shadow}`,
    };
  }

  const backgroundColor = mixRgb(RED_BG_LIGHT, RED_BG_DARK, t);
  const shadow = mixRgb(RED_SHADOW_LIGHT, RED_SHADOW_DARK, t);
  return {
    backgroundColor,
    color: textOnIntensity(t, RED_TEXT_DARK),
    boxShadow: `0 3px 0 ${shadow}`,
  };
}

/** Softer cells in the breakdown panel. */
export function outcomeOddsStyle(probability: number, variant: OutcomeSide): OddsFillStyle {
  const t = oddsColorIntensity(probability);

  if (variant === "draw") {
    const gray = Math.round(lerp(250, 228, t));
    return {
      backgroundColor: `rgb(${gray} ${gray} ${gray + 2})`,
      color: "#3f3f46",
      borderColor: `rgb(${Math.round(lerp(228, 212, t))} ${Math.round(lerp(228, 212, t))} ${Math.round(lerp(231, 214, t))})`,
    };
  }

  if (variant === "home") {
    const backgroundColor = mixRgb([240, 253, 244], GREEN_BG_DARK, t);
    return {
      backgroundColor,
      color: textOnIntensity(t * 0.85, GREEN_TEXT_DARK),
      borderColor: mixRgb(GREEN_SHADOW_LIGHT, GREEN_SHADOW_DARK, t * 0.9),
    };
  }

  const backgroundColor = mixRgb([254, 242, 242], RED_BG_DARK, t);
  return {
    backgroundColor,
    color: textOnIntensity(t * 0.85, RED_TEXT_DARK),
    borderColor: mixRgb(RED_SHADOW_LIGHT, RED_SHADOW_DARK, t * 0.9),
  };
}

/** @deprecated Use polyPillStyle() — fixed colors, no weighting. */
export const POLY_PILL_CLASSES: Record<OutcomeSide, string> = {
  home: "bg-[#22c55e] text-white shadow-[0_3px_0_#16a34a]",
  draw: "bg-white text-zinc-900 shadow-[0_3px_0_#d4d4d8] ring-1 ring-zinc-200",
  away: "bg-[#ef4444] text-white shadow-[0_3px_0_#dc2626]",
};

/** @deprecated Use outcomeOddsStyle() — fixed pastel tokens. */
export const OUTCOME_ODDS_CLASSES: Record<OutcomeSide, string> = {
  home: "bg-[var(--tile-odds-home-bg)] text-[var(--tile-odds-home-text)] ring-1 ring-[var(--tile-odds-home-ring)]",
  draw: "bg-[var(--tile-odds-draw-bg)] text-[var(--tile-odds-draw-text)] ring-1 ring-[var(--tile-odds-draw-ring)]",
  away: "bg-[var(--tile-odds-away-bg)] text-[var(--tile-odds-away-text)] ring-1 ring-[var(--tile-odds-away-ring)]",
};

export function oddsCellClassName(extra?: string): string {
  return ["ring-1", extra].filter(Boolean).join(" ");
}
