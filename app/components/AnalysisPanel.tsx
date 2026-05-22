"use client";

import { ThreeWayOdds } from "@/app/components/ThreeWayOdds";
import type { AnalyzeResult, MatchContext, MismatchVerdict } from "@/lib/alpha-types";
import { formatPastMeeting } from "@/lib/format-past-meeting";
import { formatMatchVenueDisplay } from "@/lib/match-context";
import { flagFor } from "@/lib/flags";
import { formatKickoff } from "@/lib/fixtures";
import { SentimentBuzz } from "@/app/components/SentimentBuzz";
import { SoccerLoadingLine } from "@/app/components/SoccerLoadingLine";
import { polymarketMatchUrl } from "@/lib/external-links";
import {
  formatChance,
  formatGap,
  formatGapBadge,
  friendlyDataGap,
  friendlyLlmSkip,
  stanceLabel,
} from "@/lib/ui-copy";

export function LoadingSpinner() {
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 p-8">
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-[var(--brand-magenta)]"
        aria-hidden
      />
      <SoccerLoadingLine className="max-w-xs text-center text-sm font-medium text-zinc-600" />
    </div>
  );
}

type Props = {
  result: AnalyzeResult | null;
  loading: boolean;
  error: string | null;
  onDismiss?: () => void;
};

function stanceClass(stance: NonNullable<AnalyzeResult["llm"]>["stance"]): string {
  if (stance === "agree") return "text-emerald-700";
  if (stance === "disagree") return "text-amber-700";
  return "text-zinc-500";
}

export function AnalysisPanel({
  result,
  loading,
  error,
  onDismiss,
}: Props) {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-semibold">Could not analyze this match</p>
        <p className="mt-1 text-xs">{error}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-rose-50"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center">
        <p className="text-sm text-zinc-500">Tap a match above to compare our estimate with betting odds.</p>
      </div>
    );
  }

  const { match, p_model, p_market, edge, breakdown, match_context } = result;
  const team = match.home;
  const opponent = match.away;
  const polymarketUrl = result.market.slug ? polymarketMatchUrl(result.market.slug) : null;
  const city = match_context.city;

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2">
      <header className="border-b border-zinc-100 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xl font-bold text-zinc-900">
          <span>{flagFor(team)}</span>
          <span>{team}</span>
          <span className="font-normal text-zinc-400">vs</span>
          <span>{flagFor(opponent)}</span>
          <span>{opponent}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {formatKickoff(match.kickoff_iso)}
          {city && (
            <>
              <span className="text-zinc-300"> · </span>
              {city}
            </>
          )}
        </p>
      </header>

      <VerdictCard verdict={result.verdict} />

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Our estimate" value={formatChance(result.p_expected)} tone="our" />
        <Stat label="Market odds" value={formatChance(p_market)} tone="market" />
        <Stat label="Difference" value={formatGap(edge)} tone="gap" />
      </div>

      {result.sentiment && result.sentiment.post_count > 0 && (
        <SentimentBuzz sentiment={result.sentiment} home={team} away={opponent} />
      )}

      {(result.market.draw != null || result.market.away_win != null) && (
        <section className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-700">Betting odds</p>
            {polymarketUrl && (
              <a
                href={polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[var(--brand-sky)] underline decoration-[var(--brand-sky)]/30 underline-offset-2"
              >
                Open on Polymarket
              </a>
            )}
          </div>
          <ThreeWayOdds
            teamA={team}
            teamB={opponent}
            teamAPrice={result.market.home_win ?? p_market ?? 0.5}
            drawPrice={result.market.draw}
            teamBPrice={result.market.away_win}
          />
        </section>
      )}

      {polymarketUrl && result.market.draw == null && result.market.away_win == null && p_market != null && (
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--brand-sky)] underline decoration-[var(--brand-sky)]/30 underline-offset-2"
        >
          Open live odds on Polymarket
        </a>
      )}

      <details className="rounded-xl border border-zinc-100 bg-white shadow-sm">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-zinc-700">
          More about this match
        </summary>
        <div className="space-y-3 border-t border-zinc-100 px-3 py-3 text-sm text-zinc-600">
          <p className="text-xs text-zinc-500">
            Team strength alone: {formatChance(p_model)} for {team}
          </p>
          <MatchConditionsSection context={match_context} />
          {result.rag.hits.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-700">
                Past meetings ({result.rag.hits.length})
              </p>
              <ul className="mt-1 max-h-28 space-y-1 overflow-auto text-xs text-zinc-600">
                {result.rag.hits.map((h) => (
                  <li key={h.id}>{formatPastMeeting(h.content)}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="space-y-1 text-xs">
            <li>
              Strength {breakdown.elo_home.toFixed(0)} vs {breakdown.elo_away.toFixed(0)}
            </li>
            <li>History adjustment {formatGap(breakdown.h2h_adjustment)}</li>
          </ul>
          {result.data_gaps.length > 0 && (
            <ul className="space-y-0.5 text-xs text-amber-800">
              {result.data_gaps.map((g, i) => (
                <li key={i}>{friendlyDataGap(g)}</li>
              ))}
            </ul>
          )}
          <LlmSection llm={result.llm} skipReason={result.llm_skip_reason} team={team} />
        </div>
      </details>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function verdictStyles(alignment: MismatchVerdict["alignment"]) {
  switch (alignment) {
    case "we_higher":
      return {
        border: "border-emerald-300",
        bg: "bg-emerald-50",
        title: "text-emerald-900",
        badge: "bg-white text-emerald-800 ring-emerald-200",
      };
    case "market_higher":
      return {
        border: "border-amber-300",
        bg: "bg-amber-50",
        title: "text-amber-950",
        badge: "bg-white text-amber-900 ring-amber-200",
      };
    case "no_market":
      return {
        border: "border-zinc-200",
        bg: "bg-zinc-50",
        title: "text-zinc-800",
        badge: "bg-white text-zinc-700 ring-zinc-200",
      };
    default:
      return {
        border: "border-zinc-200",
        bg: "bg-zinc-50",
        title: "text-zinc-900",
        badge: "bg-white text-zinc-700 ring-zinc-200",
      };
  }
}

function VerdictCard({ verdict }: { verdict: MismatchVerdict }) {
  const styles = verdictStyles(verdict.alignment);
  const gapLabel = formatGapBadge(verdict.gap_pp);

  return (
    <section
      className={`rounded-xl border px-4 py-3 shadow-sm ${styles.border} ${styles.bg}`}
      aria-label="Summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`text-base font-bold leading-snug ${styles.title}`}>{verdict.headline}</h3>
        {gapLabel && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-sm font-bold tabular-nums ring-1 ${styles.badge}`}
          >
            {gapLabel}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">{verdict.comparison_line}</p>
    </section>
  );
}

function MatchConditionsSection({ context }: { context: MatchContext }) {
  const { title, detail } = formatMatchVenueDisplay(context);
  const notes = [...context.venue_notes, ...context.travel_notes];
  if (!title && !detail && notes.length === 0) return null;

  return (
    <div className="text-xs text-zinc-600">
      {title && <p className="font-medium text-zinc-700">{title}</p>}
      {detail && <p>{detail}</p>}
      {notes.length > 0 && <p className="mt-1">{notes[0]}</p>}
    </div>
  );
}

function LlmSection({
  llm,
  skipReason,
  team,
}: {
  llm: AnalyzeResult["llm"];
  skipReason?: string;
  team: string;
}) {
  if (llm) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5">
        <p className={`text-xs font-medium ${stanceClass(llm.stance)}`}>
          Note · {stanceLabel(llm.stance)}
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">{llm.headline}</p>
        <p className="mt-1 text-xs text-zinc-600">
          {team} {formatChance(llm.p_expected_home_win)}. {llm.summary}
        </p>
        {llm.trade_idea && <p className="mt-1 text-xs text-zinc-700">{llm.trade_idea}</p>}
      </div>
    );
  }

  const friendly = friendlyLlmSkip(skipReason);
  if (friendly) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {friendly}
      </p>
    );
  }

  return null;
}

const STAT_STYLES = {
  our: {
    box: "border-emerald-200 bg-emerald-50",
    value: "text-emerald-600",
  },
  market: {
    box: "border-fuchsia-200 bg-fuchsia-50",
    value: "text-[var(--brand-magenta)]",
  },
  gap: {
    box: "border-amber-200 bg-amber-50",
    value: "text-amber-700",
  },
  neutral: {
    box: "border-zinc-200 bg-white",
    value: "text-zinc-900",
  },
} as const;

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "our" | "market" | "gap" | "neutral";
}) {
  const s = STAT_STYLES[tone];

  return (
    <div className={`rounded-xl border px-2.5 py-3 text-center shadow-sm ${s.box}`}>
      <div className="text-[11px] font-medium text-zinc-600">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums leading-none ${s.value}`}>{value}</div>
    </div>
  );
}
