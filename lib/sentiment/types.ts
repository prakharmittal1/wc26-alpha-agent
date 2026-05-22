import type { Wc2026Team } from "@/lib/teams";

export type SentimentTone = "positive" | "mixed" | "negative" | "unknown";

export type SentimentSourceId = "news";

export type SentimentSourceStatus = {
  id: SentimentSourceId;
  label: string;
  status: "ok" | "skipped" | "error";
  count: number;
  detail?: string;
};

export type SentimentQuote = {
  text: string;
  source: SentimentSourceId;
  url?: string;
  at?: string;
};

export type SentimentSnapshot = {
  home: Wc2026Team;
  away: Wc2026Team;
  kickoff_iso: string;
  fetched_at: string;
  post_count: number;
  home_tone: SentimentTone;
  away_tone: SentimentTone;
  themes: string[];
  sample_quotes: SentimentQuote[];
  sources: SentimentSourceStatus[];
  /** One plain sentence for the UI. */
  summary_line: string | null;
};

export type RawSentimentItem = {
  source: SentimentSourceId;
  text: string;
  title?: string;
  url?: string;
  score?: number;
  at?: string;
};
