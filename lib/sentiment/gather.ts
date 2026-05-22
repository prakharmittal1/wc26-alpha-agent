import "server-only";

import { buildSentimentSnapshot } from "@/lib/sentiment/aggregate";
import {
  readFileSentimentCache,
  readMemorySentimentCache,
  writeSentimentCache,
} from "@/lib/sentiment/cache";
import { fetchNewsSentiment, isNewsConfigured } from "@/lib/sentiment/news";
import type { RawSentimentItem, SentimentSnapshot, SentimentSourceStatus } from "@/lib/sentiment/types";
import type { Wc2026Team } from "@/lib/teams";

export function isSentimentConfigured(): boolean {
  return isNewsConfigured();
}

export type GatherSentimentOptions = {
  useCache?: boolean;
};

export async function gatherMatchSentiment(
  home: Wc2026Team,
  away: Wc2026Team,
  kickoff_iso: string,
  options: GatherSentimentOptions = {},
): Promise<SentimentSnapshot | null> {
  if (!isSentimentConfigured()) return null;

  const useCache = options.useCache !== false;
  if (useCache) {
    const mem = readMemorySentimentCache(home, away, kickoff_iso);
    if (mem) return mem;
    const file = await readFileSentimentCache(home, away, kickoff_iso);
    if (file) return file;
  }

  const news = await fetchNewsSentiment(home, away);

  const sources: SentimentSourceStatus[] = [sourceStatus("news", "News", news)];

  const snapshot = buildSentimentSnapshot(
    home,
    away,
    kickoff_iso,
    dedupeItems(news.items),
    sources,
  );

  if (useCache) {
    await writeSentimentCache(snapshot);
  }

  return snapshot;
}

function sourceStatus(
  id: SentimentSourceStatus["id"],
  label: string,
  result: { items: RawSentimentItem[]; error?: string },
): SentimentSourceStatus {
  if (result.error === "skipped") {
    return { id, label, status: "skipped", count: 0, detail: "No API key" };
  }
  if (result.error) {
    return { id, label, status: "error", count: 0, detail: result.error };
  }
  return { id, label, status: "ok", count: result.items.length };
}

function dedupeItems(items: RawSentimentItem[]): RawSentimentItem[] {
  const seen = new Set<string>();
  const out: RawSentimentItem[] = [];
  for (const item of items) {
    const key = `${item.source}:${(item.url ?? item.text).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
