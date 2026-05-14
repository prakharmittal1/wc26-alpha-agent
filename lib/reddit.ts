/**
 * Reddit RSS fetcher.
 *
 * Reddit's RSS feeds are still public in 2026 but throttled hard for
 * unauthenticated clients. To stay within etiquette we:
 *  - hit `old.reddit.com` (more lenient than the redesign).
 *  - send a descriptive User-Agent per Reddit policy.
 *  - sleep `INTER_REQUEST_MS` between calls.
 *  - retry once on 403/429/5xx after a longer backoff.
 */

import { XMLParser } from "fast-xml-parser";

const USER_AGENT = "wc26-alpha-agent/0.1 (https://github.com/anonymous/wc26-alpha-agent)";
const INTER_REQUEST_MS = 1500;
const RETRY_BACKOFF_MS = 5000;
const REQUEST_TIMEOUT_MS = 15_000;

export type RedditPost = {
  /** Reddit fullname, e.g. "t3_abc123". Stable post id. */
  id: string;
  subreddit: string;
  title: string;
  /** Plain-text summary (HTML stripped). May be empty for link posts. */
  summary: string;
  /** Permalink to the post on reddit.com. */
  url: string;
  posted_at: Date;
};

type FetchOptions = {
  /** Max posts to return from this feed (Reddit caps RSS around 100). */
  limit?: number;
  /** AbortSignal for the underlying fetch. */
  signal?: AbortSignal;
};

let lastFetchAt = 0;

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function paceRequest(signal?: AbortSignal): Promise<void> {
  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < INTER_REQUEST_MS) {
    await sleep(INTER_REQUEST_MS - elapsed, signal);
  }
  lastFetchAt = Date.now();
}

function stripHtml(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

type AtomEntry = {
  id?: string;
  title?: string | { "#text"?: string };
  link?: { "@_href"?: string } | Array<{ "@_href"?: string }>;
  content?: string | { "#text"?: string };
  updated?: string;
  published?: string;
  category?: { "@_term"?: string } | Array<{ "@_term"?: string }>;
};

function pickText(node: string | { "#text"?: string } | undefined): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  return node["#text"] ?? "";
}

function pickHref(node: AtomEntry["link"]): string {
  if (!node) return "";
  if (Array.isArray(node)) return node[0]?.["@_href"] ?? "";
  return node["@_href"] ?? "";
}

/**
 * Parse a Reddit RSS payload (Atom format) into typed posts.
 *
 * Exported separately so callers (and tests) can parse fixture XML
 * without hitting the network.
 */
export function parseRedditAtom(xml: string, subreddit: string): RedditPost[] {
  const parsed = parser.parse(xml) as { feed?: { entry?: AtomEntry | AtomEntry[] } };
  const entries = parsed.feed?.entry;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];

  const out: RedditPost[] = [];
  for (const e of list) {
    // Reddit atom ids look like "t3_abc123" or "tag:reddit.com,2008:/r/.../comments/t3_abc123".
    const rawId = e.id ?? "";
    const match = rawId.match(/t3_[a-z0-9]+/i);
    const id = match ? match[0] : rawId;
    if (!id) continue;

    const title = pickText(e.title);
    const summary = stripHtml(pickText(e.content));
    const url = pickHref(e.link);
    const isoDate = e.published ?? e.updated;
    if (!isoDate) continue;
    const posted_at = new Date(isoDate);
    if (Number.isNaN(posted_at.getTime())) continue;

    out.push({ id, subreddit, title, summary, url, posted_at });
  }
  return out;
}

/**
 * Fetch one subreddit's new-posts RSS feed.
 *
 * Returns a deduped, chronologically-newest-first array of posts.
 */
export async function fetchSubredditRss(
  subreddit: string,
  options: FetchOptions = {},
): Promise<RedditPost[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const url = `https://old.reddit.com/r/${encodeURIComponent(subreddit)}/new/.rss?limit=${limit}`;

  let attempt = 0;
  // First call is real, second is the retry. No more.
  while (attempt < 2) {
    await paceRequest(options.signal);

    let res: Response;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const signal = options.signal ? mergeSignals(options.signal, ctrl.signal) : ctrl.signal;
      try {
        res = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/atom+xml, application/xml; q=0.9",
          },
          signal,
        });
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      if (attempt === 0) {
        attempt += 1;
        await sleep(RETRY_BACKOFF_MS, options.signal);
        continue;
      }
      throw new Error(`reddit fetch failed for r/${subreddit}: ${(err as Error).message}`);
    }

    if (res.ok) {
      const xml = await res.text();
      return parseRedditAtom(xml, subreddit);
    }

    // Retryable: 403 (rate-limit "bot-block" mode), 429, 5xx.
    if ((res.status === 403 || res.status === 429 || res.status >= 500) && attempt === 0) {
      attempt += 1;
      await sleep(RETRY_BACKOFF_MS, options.signal);
      continue;
    }

    throw new Error(
      `reddit fetch failed for r/${subreddit}: HTTP ${res.status} ${res.statusText}`,
    );
  }

  // Unreachable, but keeps TS happy.
  return [];
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onA = () => ctrl.abort();
  const onB = () => ctrl.abort();
  a.addEventListener("abort", onA, { once: true });
  b.addEventListener("abort", onB, { once: true });
  return ctrl.signal;
}
