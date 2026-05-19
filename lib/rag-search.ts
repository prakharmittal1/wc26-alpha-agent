import type { PlaybookChunk, RagHit } from "@/lib/rag-types";
import type { Wc2026Team } from "@/lib/teams";

const STOP = new Set([
  "the",
  "a",
  "an",
  "vs",
  "and",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Keyword + recency search (no embeddings). */
export function searchPlaybookChunks(
  chunks: PlaybookChunk[],
  home: Wc2026Team,
  away: Wc2026Team,
  limit = 6,
): RagHit[] {
  const queryTokens = new Set([
    ...tokens(home),
    ...tokens(away),
    "world",
    "cup",
    "fifa",
  ]);

  const now = Date.now();
  const scored: RagHit[] = [];

  for (const c of chunks) {
    const involves =
      (c.home === home && c.away === away) ||
      (c.home === away && c.away === home) ||
      c.home === home ||
      c.away === home ||
      c.home === away ||
      c.away === away;

    if (!involves) continue;

    let score = 0;
    if (c.home === home && c.away === away) score += 40;
    else if (c.home === away && c.away === home) score += 28;
    else score += 12;

    const t = c.tournament.toLowerCase();
    if (t.includes("world cup") || t.includes("fifa")) score += 15;

    const chunkTokens = tokens(c.content);
    for (const tok of chunkTokens) {
      if (queryTokens.has(tok)) score += 2;
    }

    const ageMs = now - Date.parse(c.date);
    if (Number.isFinite(ageMs) && ageMs > 0) {
      const years = ageMs / (365.25 * 24 * 3600 * 1000);
      score += Math.max(0, 8 - years * 1.5);
    }

    scored.push({
      id: c.id,
      content: c.content,
      date: c.date,
      tournament: c.tournament,
      score: Number(score.toFixed(2)),
    });
  }

  scored.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  return scored.slice(0, limit);
}
