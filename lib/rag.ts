import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { RagContext } from "@/lib/rag-types";
import { searchPlaybookChunks } from "@/lib/rag-search";
import type { PlaybookStore } from "@/lib/rag-types";
import type { Wc2026Team } from "@/lib/teams";

let cached: PlaybookStore | null = null;

function loadStore(): PlaybookStore | null {
  if (cached) return cached;
  try {
    const raw = readFileSync(
      join(process.cwd(), "data", "processed", "playbook-chunks.json"),
      "utf8",
    );
    cached = JSON.parse(raw) as PlaybookStore;
    return cached;
  } catch {
    return null;
  }
}

export function searchRagForMatch(
  home: Wc2026Team,
  away: Wc2026Team,
  limit = 6,
): RagContext {
  const store = loadStore();
  if (!store || store.chunks.length === 0) {
    return { built_at: "missing", hits: [] };
  }
  return {
    built_at: store.built_at,
    hits: searchPlaybookChunks(store.chunks, home, away, limit),
  };
}

export function isRagAvailable(): boolean {
  const store = loadStore();
  return Boolean(store && store.chunks.length > 0);
}
