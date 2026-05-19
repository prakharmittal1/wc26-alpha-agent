import { describe, expect, it } from "vitest";

import { searchPlaybookChunks } from "@/lib/rag-search";
import type { PlaybookChunk } from "@/lib/rag-types";

const CHUNKS: PlaybookChunk[] = [
  {
    id: "1",
    content: "Mexico beat USA 2-1 in a friendly.",
    date: "2024-03-01",
    home: "Mexico",
    away: "United States",
    tournament: "Friendly",
    home_score: 2,
    away_score: 1,
    neutral: false,
  },
  {
    id: "2",
    content: "Brazil won the World Cup final.",
    date: "2022-12-18",
    home: "Argentina",
    away: "France",
    tournament: "FIFA World Cup",
    home_score: 3,
    away_score: 3,
    neutral: true,
  },
];

describe("searchPlaybookChunks", () => {
  it("ranks direct H2H highest", () => {
    const hits = searchPlaybookChunks(CHUNKS, "Mexico", "United States", 2);
    expect(hits[0]?.id).toBe("1");
  });
});
