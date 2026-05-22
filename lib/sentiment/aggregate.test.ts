import { describe, expect, it } from "vitest";

import { buildSentimentSnapshot } from "@/lib/sentiment/aggregate";
import type { RawSentimentItem, SentimentSourceStatus } from "@/lib/sentiment/types";

const sources: SentimentSourceStatus[] = [
  { id: "news", label: "News", status: "ok", count: 2 },
];

describe("buildSentimentSnapshot", () => {
  it("detects positive home tone from headlines", () => {
    const items: RawSentimentItem[] = [
      {
        source: "news",
        text: "Netherlands look strong and should win against Japan at World Cup 2026",
        title: "Netherlands favored",
      },
      {
        source: "news",
        text: "Japan struggle with injuries ahead of World Cup clash",
        title: "Japan injury doubts",
      },
    ];
    const snap = buildSentimentSnapshot(
      "Netherlands",
      "Japan",
      "2026-06-14T18:00:00Z",
      items,
      sources,
    );
    expect(snap.post_count).toBe(2);
    expect(snap.home_tone).toBe("positive");
    expect(snap.sample_quotes.length).toBeGreaterThan(0);
    expect(snap.summary_line).toMatch(/headlines/);
  });

  it("returns empty summary when no items", () => {
    const snap = buildSentimentSnapshot(
      "Brazil",
      "France",
      "2026-07-01T20:00:00Z",
      [],
      [],
    );
    expect(snap.post_count).toBe(0);
    expect(snap.summary_line).toBeNull();
  });
});
