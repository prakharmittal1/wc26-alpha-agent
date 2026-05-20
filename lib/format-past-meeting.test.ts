import { describe, expect, it } from "vitest";

import { formatPastMeeting } from "@/lib/format-past-meeting";

describe("formatPastMeeting", () => {
  it("shortens standard RAG rows", () => {
    const raw =
      "On 2010-06-11 in FIFA World Cup at Johannesburg, South Africa: South Africa 1-1 Mexico.";
    expect(formatPastMeeting(raw)).toBe(
      "South Africa 1–1 Mexico · 11 Jun 2010 · Johannesburg",
    );
  });

  it("labels qualifying matches", () => {
    const raw =
      "On 2025-09-09 in FIFA World Cup qualification at Bloemfontein, South Africa: South Africa 1-1 Nigeria.";
    expect(formatPastMeeting(raw)).toContain("South Africa 1–1 Nigeria");
    expect(formatPastMeeting(raw)).toContain("qualifying");
    expect(formatPastMeeting(raw)).toContain("Bloemfontein");
  });
});
