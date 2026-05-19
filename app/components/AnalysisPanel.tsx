"use client";

import { ProbabilityGauge } from "@/app/components/ProbabilityGauge";
import type { AnalyzeResult } from "@/lib/alpha-types";
import { flagFor } from "@/lib/flags";
import { formatKickoff } from "@/lib/fixtures";
import {
  expectedSourceLabel,
  formatChance,
  formatGap,
  formatReturnPerDollar,
  friendlyDataGap,
  friendlyLlmSkip,
  gaugeMarketLabel,
  signalLabel,
  stanceLabel,
} from "@/lib/ui-copy";

type Props = {
  result: AnalyzeResult | null;
  loading: boolean;
  error: string | null;
  onDismiss?: () => void;
};

function signalClass(signal: AnalyzeResult["signal"]): string {
  if (signal === "ALPHA_YES") return "text-[var(--brand-lime)]";
  if (signal === "ALPHA_NO") return "text-[var(--brand-tangerine)]";
  return "text-zinc-500";
}

function stanceClass(stance: NonNullable<AnalyzeResult["llm"]>["stance"]): string {
  if (stance === "agree") return "text-[var(--brand-lime)]";
  if (stance === "disagree") return "text-[var(--brand-tangerine)]";
  return "text-[var(--brand-amber)]";
}

export function AnalysisPanel({ result, loading, error, onDismiss }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <span
          className="inline-block size-2 animate-pulse rounded-full"
          style={{ background: "var(--brand-amber)" }}
        />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Checking odds and past results…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="font-semibold">Could not analyze this match</p>
        <p className="mt-1 text-xs">{error}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 rounded border border-rose-300 px-3 py-1 text-xs font-medium"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick a match above to see{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            our win chance
          </span>{" "}
          next to{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            what the betting market thinks
          </span>
          .
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          We use team strength, head-to-head history, and optional AI — then compare
          to Polymarket.
        </p>
      </div>
    );
  }

  const { match, p_model, p_market, edge, signal, ev_per_unit, breakdown } = result;
  const homeWinsBet = `Will ${match.home} win?`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            <span>{flagFor(match.home)}</span>
            <span>{match.home}</span>
            <span className="text-zinc-400">vs</span>
            <span>{flagFor(match.away)}</span>
            <span>{match.away}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {match.competition} · {formatKickoff(match.kickoff_iso)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{homeWinsBet}</p>
        </div>
        <ProbabilityGauge
          value={p_market ?? result.p_expected}
          label={gaugeMarketLabel(p_market !== null ? "market" : "expected")}
          size={72}
        />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Our estimate"
          sublabel="Home team wins"
          value={formatChance(result.p_expected)}
          accent="lime"
          hint={expectedSourceLabel(result.p_expected_source)}
        />
        <Stat
          label="From ratings"
          sublabel="Stats-only baseline"
          value={formatChance(p_model)}
          accent="sky"
        />
        <Stat
          label="Market odds"
          sublabel="Polymarket"
          value={formatChance(p_market)}
          accent="magenta"
        />
        <Stat
          label="Gap"
          sublabel="Us vs market"
          value={formatGap(edge)}
          accent="amber"
        />
        <Stat
          label="Per $1 bet"
          sublabel="Expected return"
          value={formatReturnPerDollar(ev_per_unit)}
          accent="sky"
        />
      </div>

      <p className={`text-sm font-semibold leading-snug ${signalClass(signal)}`}>
        {signalLabel(signal)}
      </p>

      {result.rag.hits.length > 0 && (
        <details className="rounded border border-zinc-100 dark:border-zinc-800" open>
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Past meetings ({result.rag.hits.length})
          </summary>
          <ul className="max-h-40 space-y-2 overflow-auto border-t border-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            {result.rag.hits.map((h) => (
              <li key={h.id} className="border-b border-zinc-50 pb-2 last:border-0 dark:border-zinc-900">
                <span className="text-[11px] text-zinc-400">
                  {h.date} · {h.tournament}
                </span>
                <p className="mt-0.5">{h.content}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded border border-zinc-100 dark:border-zinc-800">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          How we calculated this
        </summary>
        <ul className="space-y-1.5 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <li>
            <span className="text-zinc-500">Home strength score:</span>{" "}
            {breakdown.elo_home.toFixed(0)}{" "}
            <span className="text-zinc-400">
              (includes +{breakdown.home_advantage} home-field boost)
            </span>
          </li>
          <li>
            <span className="text-zinc-500">Away strength score:</span>{" "}
            {breakdown.elo_away.toFixed(0)}
          </li>
          <li>
            <span className="text-zinc-500">Ratings-only home win chance:</span>{" "}
            {formatChance(breakdown.base_p_home)}
          </li>
          <li>
            <span className="text-zinc-500">Head-to-head adjustment:</span>{" "}
            {breakdown.h2h_adjustment >= 0 ? "+" : ""}
            {formatGap(breakdown.h2h_adjustment)}
          </li>
        </ul>
      </details>

      {result.data_gaps.length > 0 && (
        <ul className="space-y-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          {result.data_gaps.map((g, i) => (
            <li key={i}>• {friendlyDataGap(g)}</li>
          ))}
        </ul>
      )}

      <details className="rounded border border-zinc-100 dark:border-zinc-800">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-500">
          Technical notes (optional)
        </summary>
        <pre className="max-h-40 overflow-auto border-t border-zinc-100 p-3 font-mono text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
          {result.summary}
        </pre>
      </details>

      <LlmSection llm={result.llm} skipReason={result.llm_skip_reason} homeTeam={match.home} />

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="self-start rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function LlmSection({
  llm,
  skipReason,
  homeTeam,
}: {
  llm: AnalyzeResult["llm"];
  skipReason?: string;
  homeTeam: string;
}) {
  if (llm) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-gradient-to-b from-white to-zinc-50/80 p-4 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/50">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--brand-magenta)" }}
          >
            AI second opinion
          </span>
          <span className={`text-xs font-medium ${stanceClass(llm.stance)}`}>
            {stanceLabel(llm.stance)}
          </span>
        </header>

        <p className="text-base font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
          {llm.headline}
        </p>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          AI thinks <span className="font-semibold text-zinc-900 dark:text-zinc-100">{homeTeam}</span>{" "}
          wins{" "}
          <span className="font-semibold" style={{ color: "var(--brand-lime)" }}>
            {formatChance(llm.p_expected_home_win)}
          </span>{" "}
          of the time.
        </p>

        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500">Reasoning</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {llm.thinking_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {llm.summary}
        </p>

        {llm.trade_idea && (
          <p className="mt-3 rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            <span className="font-medium text-zinc-500">Suggestion · </span>
            {llm.trade_idea}
          </p>
        )}

        <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {llm.risks.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--brand-amber)]">!</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const friendly = friendlyLlmSkip(skipReason);
  if (friendly) {
    return (
      <p className="rounded border border-dashed border-zinc-300 px-3 py-2 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700">
        {friendly}
      </p>
    );
  }

  return null;
}

function Stat({
  label,
  sublabel,
  value,
  accent,
  hint,
}: {
  label: string;
  sublabel?: string;
  value: string;
  accent: "lime" | "magenta" | "amber" | "sky";
  hint?: string;
}) {
  const color =
    accent === "lime"
      ? "var(--brand-lime)"
      : accent === "magenta"
        ? "var(--brand-magenta)"
        : accent === "amber"
          ? "var(--brand-amber)"
          : "var(--brand-sky)";
  return (
    <div className="rounded border border-zinc-100 px-2 py-2 dark:border-zinc-800">
      <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{label}</div>
      {sublabel && (
        <div className="text-[10px] text-zinc-400">{sublabel}</div>
      )}
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-400">{hint}</div>}
    </div>
  );
}
