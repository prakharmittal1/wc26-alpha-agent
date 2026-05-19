import type { RagHit } from "@/lib/rag-types";
import { clampProbability } from "@/lib/elo-math";
import type { Wc2026Team } from "@/lib/teams";

/** Home win rate implied by RAG rows (home-perspective matches only). */
export function ragHomeWinRateFromHits(
  hits: RagHit[],
  home: Wc2026Team,
  away: Wc2026Team,
): number | null {
  let wins = 0;
  let total = 0;

  for (const h of hits) {
    const m = parseScoreline(h.content, home, away);
    if (!m) continue;
    total += 1;
    if (m.homeWin) wins += 1;
  }

  if (total < 2) return null;
  return wins / total;
}

function parseScoreline(
  content: string,
  home: Wc2026Team,
  away: Wc2026Team,
): { homeWin: boolean } | null {
  const m = new RegExp(
    `:\\s*${escapeReg(home)}\\s+(\\d+)-(\\d+)\\s+${escapeReg(away)}`,
    "i",
  ).exec(content);
  if (m) {
    return { homeWin: Number(m[1]) > Number(m[2]) };
  }
  const m2 = new RegExp(
    `:\\s*${escapeReg(away)}\\s+(\\d+)-(\\d+)\\s+${escapeReg(home)}`,
    "i",
  ).exec(content);
  if (m2) {
    return { homeWin: Number(m2[2]) > Number(m2[1]) };
  }
  return null;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Blend Elo P_model with RAG-implied form when LLM is unavailable.
 * 65% Elo / 35% RAG prior from retrieved rows.
 */
export function blendEloWithRag(
  p_model: number,
  hits: RagHit[],
  home: Wc2026Team,
  away: Wc2026Team,
): number | null {
  const ragRate = ragHomeWinRateFromHits(hits, home, away);
  if (ragRate === null) return null;
  return clampProbability(0.65 * p_model + 0.35 * ragRate);
}
