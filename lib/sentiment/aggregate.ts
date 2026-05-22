import { searchTermsForTeam } from "@/lib/sentiment/query";
import type {
  RawSentimentItem,
  SentimentQuote,
  SentimentSnapshot,
  SentimentSourceStatus,
  SentimentTone,
} from "@/lib/sentiment/types";
import type { Wc2026Team } from "@/lib/teams";

const POSITIVE = /\b(win|wins|winning|strong|favorites?|favourites?|dominat|confident|underrated|solid|clutch|impressive|great form|in form)\b/i;
const NEGATIVE = /\b(lose|loses|losing|weak|overrated|struggle|collapsed?|injur|doubt|out of form|poor|terrible|awful|bottl)\b/i;

const THEME_RULES: { label: string; re: RegExp }[] = [
  { label: "Injuries & fitness", re: /\b(injur|doubt|fitness|ruled out|sidelined|hamstring)\b/i },
  { label: "Lineups & tactics", re: /\b(lineup|line-up|starting xi|formation|tactic|manager)\b/i },
  { label: "Underdog hype", re: /\b(underdog|upset|dark horse|surprise)\b/i },
  { label: "Favorite talk", re: /\b(favorite|favourite|favorites|clear favorite|should win)\b/i },
  { label: "Form & momentum", re: /\b(form|momentum|streak|unbeaten|winless)\b/i },
];

function toneFromText(text: string): SentimentTone {
  const pos = (text.match(POSITIVE) ?? []).length;
  const neg = (text.match(NEGATIVE) ?? []).length;
  if (pos === 0 && neg === 0) return "unknown";
  if (pos > neg * 1.5) return "positive";
  if (neg > pos * 1.5) return "negative";
  return "mixed";
}

function mentionsTeam(text: string, team: Wc2026Team): boolean {
  const lower = text.toLowerCase();
  return searchTermsForTeam(team).some((term) => lower.includes(term.toLowerCase()));
}

function toneForTeam(items: RawSentimentItem[], team: Wc2026Team, other: Wc2026Team): SentimentTone {
  const relevant = items.filter((i) => {
    const t = i.text;
    return mentionsTeam(t, team) && !mentionsTeam(t, other);
  });
  const pool = relevant.length > 0 ? relevant : items.filter((i) => mentionsTeam(i.text, team));
  if (pool.length === 0) return "unknown";

  const tones = pool.map((i) => toneFromText(i.text));
  const pos = tones.filter((t) => t === "positive").length;
  const neg = tones.filter((t) => t === "negative").length;
  if (pos > neg && pos > 0) return "positive";
  if (neg > pos && neg > 0) return "negative";
  if (pos > 0 || neg > 0) return "mixed";
  return "unknown";
}

function detectThemes(items: RawSentimentItem[]): string[] {
  const blob = items.map((i) => i.text).join("\n");
  const themes: string[] = [];
  for (const rule of THEME_RULES) {
    if (rule.re.test(blob)) themes.push(rule.label);
  }
  return themes.slice(0, 4);
}

function pickQuotes(items: RawSentimentItem[], limit = 3): SentimentQuote[] {
  const sorted = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const quotes: SentimentQuote[] = [];
  for (const item of sorted) {
    const text = (item.title ?? item.text).trim();
    if (text.length < 16) continue;
    quotes.push({
      text: text.slice(0, 220),
      source: item.source,
      url: item.url,
      at: item.at,
    });
    if (quotes.length >= limit) break;
  }
  return quotes;
}

function toneLabel(tone: SentimentTone): string {
  switch (tone) {
    case "positive":
      return "mostly positive";
    case "negative":
      return "mostly negative";
    case "mixed":
      return "mixed";
    default:
      return "unclear";
  }
}

function buildSummaryLine(
  home: Wc2026Team,
  away: Wc2026Team,
  postCount: number,
  homeTone: SentimentTone,
  awayTone: SentimentTone,
  themes: string[],
): string | null {
  if (postCount === 0) return null;
  const parts: string[] = [
    `${postCount} recent headlines mention this match.`,
    `Buzz on ${home}: ${toneLabel(homeTone)}; on ${away}: ${toneLabel(awayTone)}.`,
  ];
  if (themes.length > 0) {
    parts.push(`Themes: ${themes.join(", ")}.`);
  }
  return parts.join(" ");
}

export function buildSentimentSnapshot(
  home: Wc2026Team,
  away: Wc2026Team,
  kickoff_iso: string,
  items: RawSentimentItem[],
  sources: SentimentSourceStatus[],
): SentimentSnapshot {
  const home_tone = toneForTeam(items, home, away);
  const away_tone = toneForTeam(items, away, home);
  const themes = detectThemes(items);
  const sample_quotes = pickQuotes(items);

  return {
    home,
    away,
    kickoff_iso,
    fetched_at: new Date().toISOString(),
    post_count: items.length,
    home_tone,
    away_tone,
    themes,
    sample_quotes,
    sources,
    summary_line: buildSummaryLine(home, away, items.length, home_tone, away_tone, themes),
  };
}
