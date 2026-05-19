import type { Wc2026Team } from "@/lib/teams";

export type PlaybookChunk = {
  id: string;
  content: string;
  date: string;
  home: Wc2026Team;
  away: Wc2026Team;
  tournament: string;
  home_score: number;
  away_score: number;
  neutral: boolean;
};

export type PlaybookStore = {
  built_at: string;
  source: string;
  chunk_count: number;
  chunks: PlaybookChunk[];
};

export type RagHit = {
  id: string;
  content: string;
  date: string;
  tournament: string;
  score: number;
};

export type RagContext = {
  built_at: string;
  hits: RagHit[];
};
