import "server-only";

import { newsSearchQuery } from "@/lib/sentiment/query";
import { fetchJson } from "@/lib/sentiment/http";
import type { RawSentimentItem } from "@/lib/sentiment/types";
import type { Wc2026Team } from "@/lib/teams";

type GNewsResponse = {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
  }>;
};

type NewsApiResponse = {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
  }>;
};

export function isGNewsConfigured(): boolean {
  return Boolean(process.env.GNEWS_API_KEY?.trim());
}

export function isNewsApiConfigured(): boolean {
  return Boolean(process.env.NEWS_API_KEY?.trim());
}

export function isNewsConfigured(): boolean {
  return isGNewsConfigured() || isNewsApiConfigured();
}

async function fetchGNews(
  home: Wc2026Team,
  away: Wc2026Team,
): Promise<{ items: RawSentimentItem[]; error?: string }> {
  const key = process.env.GNEWS_API_KEY?.trim();
  if (!key) return { items: [], error: "skipped" };

  const q = newsSearchQuery(home, away);
  const params = new URLSearchParams({
    q,
    lang: "en",
    max: "12",
    apikey: key,
  });

  const result = await fetchJson<GNewsResponse>(
    `https://gnews.io/api/v4/search?${params}`,
  );

  if (!result.ok) {
    return { items: [], error: `GNews failed (${result.status})` };
  }

  const items: RawSentimentItem[] = [];
  for (const a of result.data.articles ?? []) {
    const title = a.title?.trim() ?? "";
    const desc = a.description?.trim() ?? "";
    const text = [title, desc].filter(Boolean).join(" — ");
    if (text.length < 12) continue;
    items.push({
      source: "news",
      text: text.slice(0, 500),
      title,
      url: a.url,
      at: a.publishedAt,
    });
  }
  return { items };
}

async function fetchNewsApi(
  home: Wc2026Team,
  away: Wc2026Team,
): Promise<{ items: RawSentimentItem[]; error?: string }> {
  const key = process.env.NEWS_API_KEY?.trim();
  if (!key) return { items: [], error: "skipped" };

  const q = newsSearchQuery(home, away);
  const params = new URLSearchParams({
    q,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "12",
    apiKey: key,
  });

  const result = await fetchJson<NewsApiResponse>(
    `https://newsapi.org/v2/everything?${params}`,
  );

  if (!result.ok) {
    return { items: [], error: `NewsAPI failed (${result.status})` };
  }

  const items: RawSentimentItem[] = [];
  for (const a of result.data.articles ?? []) {
    const title = a.title?.trim() ?? "";
    const desc = a.description?.trim() ?? "";
    const text = [title, desc].filter(Boolean).join(" — ");
    if (text.length < 12) continue;
    items.push({
      source: "news",
      text: text.slice(0, 500),
      title,
      url: a.url,
      at: a.publishedAt,
    });
  }
  return { items };
}

export async function fetchNewsSentiment(
  home: Wc2026Team,
  away: Wc2026Team,
): Promise<{ items: RawSentimentItem[]; error?: string }> {
  if (!isNewsConfigured()) {
    return { items: [], error: "skipped" };
  }

  if (isGNewsConfigured()) {
    const g = await fetchGNews(home, away);
    if (g.items.length > 0 || !isNewsApiConfigured()) return g;
    const n = await fetchNewsApi(home, away);
    return { items: [...g.items, ...n.items], error: n.error };
  }

  return fetchNewsApi(home, away);
}
