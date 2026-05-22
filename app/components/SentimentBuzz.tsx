import type { SentimentSnapshot, SentimentTone } from "@/lib/sentiment/types";
import { sentimentSourceLabel, sentimentToneLabel } from "@/lib/ui-copy";

type Props = {
  sentiment: SentimentSnapshot;
  home: string;
  away: string;
};

function toneClass(tone: SentimentTone): string {
  switch (tone) {
    case "positive":
      return "text-emerald-700";
    case "negative":
      return "text-rose-700";
    case "mixed":
      return "text-amber-700";
    default:
      return "text-zinc-500";
  }
}

export function SentimentBuzz({ sentiment, home, away }: Props) {
  if (sentiment.post_count === 0) return null;

  const activeSources = sentiment.sources.filter((s) => s.status === "ok" && s.count > 0);

  return (
    <section className="rounded-xl border border-sky-100 bg-sky-50/80 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-sky-900">News headlines</h3>
        <span className="font-mono text-[10px] text-sky-700/80">
          {sentiment.post_count} article{sentiment.post_count === 1 ? "" : "s"}
        </span>
      </div>

      {sentiment.summary_line && (
        <p className="mt-2 text-sm leading-relaxed text-sky-950">{sentiment.summary_line}</p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/80 bg-white/70 px-2 py-1.5">
          <span className="text-zinc-500">{home}</span>
          <p className={`font-medium ${toneClass(sentiment.home_tone)}`}>
            {sentimentToneLabel(sentiment.home_tone)}
          </p>
        </div>
        <div className="rounded-lg border border-white/80 bg-white/70 px-2 py-1.5">
          <span className="text-zinc-500">{away}</span>
          <p className={`font-medium ${toneClass(sentiment.away_tone)}`}>
            {sentimentToneLabel(sentiment.away_tone)}
          </p>
        </div>
      </div>

      {sentiment.themes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {sentiment.themes.map((theme) => (
            <li
              key={theme}
              className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-sky-900 ring-1 ring-sky-100"
            >
              {theme}
            </li>
          ))}
        </ul>
      )}

      {sentiment.sample_quotes.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-sky-100/80 pt-2">
          {sentiment.sample_quotes.map((q, i) => (
            <li key={i} className="text-xs leading-snug text-sky-950">
              {q.url ? (
                <a
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-sky-300/60 underline-offset-2 hover:text-sky-800"
                >
                  {q.text}
                </a>
              ) : (
                q.text
              )}
              <span className="ml-1 text-[10px] text-sky-700/70">
                · {sentimentSourceLabel(q.source)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {activeSources.length > 0 && (
        <p className="mt-2 text-[10px] text-sky-800/70">
          Sources:{" "}
          {activeSources.map((s) => `${s.label} (${s.count})`).join(" · ")}
        </p>
      )}
    </section>
  );
}
