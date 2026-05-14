/**
 * Gemini-powered sentiment classification.
 *
 * Each post gets one polarity label (positive | negative | neutral) and a
 * list of WC 2026 teams it concerns (canonicalized via lib/teams.ts).
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import type { RedditPost } from "@/lib/reddit";
import { canonicalizeMany, WC2026_TEAMS, type Wc2026Team } from "@/lib/teams";

/**
 * Default to gemini-2.0-flash for broad API compatibility (see agent.ts).
 */
const DEFAULT_MODEL = process.env.GEMINI_SENTIMENT_MODEL ?? "gemini-2.0-flash";
const BATCH_SIZE = 25;

export type Classification = {
  post_id: string;
  polarity: "positive" | "negative" | "neutral";
  teams: Wc2026Team[];
};

const ClassificationSchema = z.object({
  results: z.array(
    z.object({
      post_id: z.string(),
      polarity: z.enum(["positive", "negative", "neutral"]),
      teams: z.array(z.string()),
    }),
  ),
});

function buildPrompt(batch: RedditPost[]): string {
  const items = batch
    .map((p, i) => {
      const body = [p.title, p.summary].filter(Boolean).join("\n").slice(0, 1200);
      return `--- POST ${i + 1} (id=${p.id}, subreddit=${p.subreddit}) ---\n${body}`;
    })
    .join("\n\n");

  return [
    "You are a sentiment classifier for World Cup 2026 prediction markets.",
    "For EACH post below, output:",
    "  - polarity: 'positive' if the post expresses bullish sentiment about a national team's chances (good form, strong squad, key player return, momentum, fan optimism); 'negative' if it expresses bearish sentiment (injuries, scandal, poor form, low morale); 'neutral' otherwise (news, fixtures, scoreless discussion, off-topic, unrelated club content).",
    "  - teams: the list of NATIONAL teams the post discusses (men's senior teams competing for WC 2026).",
    "",
    "Rules:",
    "  - Use the canonical English short name (e.g. 'United States', 'South Korea', 'Türkiye', 'Republic of Ireland').",
    "  - Only include teams from this allowlist: " + WC2026_TEAMS.join(", "),
    "  - Empty teams array is fine for club-only or generic football discussion.",
    "  - Do NOT invent teams. Do NOT label a club post as a national-team post.",
    "  - Match the post_id exactly as given.",
    "",
    items,
  ].join("\n");
}

/**
 * Classify a flat list of Reddit posts. Splits into BATCH_SIZE chunks; one
 * Gemini call per chunk. Posts missing from the model's output are dropped.
 */
export async function classifyPosts(posts: RedditPost[]): Promise<Classification[]> {
  if (posts.length === 0) return [];

  const model = google(DEFAULT_MODEL);
  const out: Classification[] = [];

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const chunk = posts.slice(i, i + BATCH_SIZE);
    const { object } = await generateObject({
      model,
      schema: ClassificationSchema,
      prompt: buildPrompt(chunk),
    });

    const byId = new Map(chunk.map((p) => [p.id, p]));
    for (const r of object.results) {
      if (!byId.has(r.post_id)) continue;
      out.push({
        post_id: r.post_id,
        polarity: r.polarity,
        teams: canonicalizeMany(r.teams),
      });
    }
  }

  return out;
}
