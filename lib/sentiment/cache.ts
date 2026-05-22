import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SentimentSnapshot } from "@/lib/sentiment/types";
import { kickoffDateUtc } from "@/lib/wc26-schedule";

const memory = new Map<string, { at: number; snapshot: SentimentSnapshot }>();

function cacheTtlMs(): number {
  const raw = process.env.SENTIMENT_CACHE_TTL_MS?.trim();
  const n = raw ? Number(raw) : 6 * 60 * 60 * 1000;
  return Number.isFinite(n) && n > 0 ? n : 6 * 60 * 60 * 1000;
}

function cacheKey(home: string, away: string, kickoff_iso: string): string {
  const date = kickoffDateUtc(kickoff_iso) ?? kickoff_iso.slice(0, 10);
  return `${home}|${away}|${date}`;
}

function cacheDir(): string {
  return path.join(process.cwd(), "data", "processed", "sentiment-cache");
}

function cacheFilePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9|_-]/g, "_");
  return path.join(cacheDir(), `${safe}.json`);
}

export function readMemorySentimentCache(
  home: string,
  away: string,
  kickoff_iso: string,
): SentimentSnapshot | null {
  const key = cacheKey(home, away, kickoff_iso);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > cacheTtlMs()) {
    memory.delete(key);
    return null;
  }
  return hit.snapshot;
}

export async function readFileSentimentCache(
  home: string,
  away: string,
  kickoff_iso: string,
): Promise<SentimentSnapshot | null> {
  const key = cacheKey(home, away, kickoff_iso);
  try {
    const raw = await readFile(cacheFilePath(key), "utf8");
    const parsed = JSON.parse(raw) as { at: number; snapshot: SentimentSnapshot };
    if (Date.now() - parsed.at > cacheTtlMs()) return null;
    memory.set(key, parsed);
    return parsed.snapshot;
  } catch {
    return null;
  }
}

export async function writeSentimentCache(snapshot: SentimentSnapshot): Promise<void> {
  const key = cacheKey(snapshot.home, snapshot.away, snapshot.kickoff_iso);
  const entry = { at: Date.now(), snapshot };
  memory.set(key, entry);

  try {
    await mkdir(cacheDir(), { recursive: true });
    await writeFile(cacheFilePath(key), JSON.stringify(entry, null, 2), "utf8");
  } catch {
    // Read-only FS (e.g. serverless) — memory cache only
  }
}
