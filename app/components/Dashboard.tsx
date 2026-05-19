"use client";

import { useCallback, useState } from "react";

import { AnalysisPanel } from "@/app/components/AnalysisPanel";
import { BrandMark } from "@/app/components/BrandMark";
import { MatchGrid } from "@/app/components/MatchGrid";
import type { AnalyzeResult } from "@/lib/alpha-types";
import type { Fixture, FixtureFeedMeta } from "@/lib/fixtures";
import { fixtureFeedLabel } from "@/lib/ui-copy";

type Props = {
  fixtures: Fixture[];
  fixturesBootstrap?: FixtureFeedMeta;
};

export function Dashboard({ fixtures, fixturesBootstrap }: Props) {
  const [activeId, setActiveId] = useState<string | undefined>();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAnalyzeFixture = useCallback(async (f: Fixture) => {
    setActiveId(f.id);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          home: f.home,
          away: f.away,
          kickoff_iso: f.kickoff_iso,
          competition: f.competition,
          p_market:
            f.market_price_source === "polymarket" ? f.market_home_win : undefined,
          polymarket_market_slug: f.polymarket_market_slug,
        }),
      });
      const data = (await res.json()) as AnalyzeResult | { error?: string };
      if (!res.ok) {
        const msg =
          typeof data === "object" && data && "error" in data
            ? String(data.error)
            : `Something went wrong (${res.status})`;
        throw new Error(msg);
      }
      setResult(data as AnalyzeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this match");
    } finally {
      setLoading(false);
    }
  }, []);

  const onClear = useCallback(() => {
    setActiveId(undefined);
    setResult(null);
    setError(null);
  }, []);

  const feedLabel = fixturesBootstrap
    ? fixtureFeedLabel(fixturesBootstrap.source)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark />
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="brand-marquee text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">
            World Cup 2026
          </span>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-right sm:text-3xl">
            Are the odds wrong?
          </h1>
        </div>
      </header>

      <p className="max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Tap a match to compare{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">our win estimate</span> with{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Polymarket betting odds</span>.
        We blend team strength, past meetings, and an optional AI read — so you can spot matches
        where the market might be off.
      </p>
      {fixturesBootstrap?.detail ? (
        <p className="max-w-3xl text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          {feedLabel}: {fixturesBootstrap.detail}
        </p>
      ) : (
        feedLabel && (
          <p className="max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">{feedLabel}</p>
        )
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <span
              aria-hidden
              className="inline-block size-2 rounded-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-magenta), var(--brand-lime))",
              }}
            />
            Upcoming matches
          </h2>
          <span className="text-xs text-zinc-500">
            {fixtures.length} match{fixtures.length === 1 ? "" : "es"}
          </span>
        </div>
        <MatchGrid
          fixtures={fixtures}
          onAnalyze={onAnalyzeFixture}
          activeId={activeId}
          busy={loading}
        />
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: "var(--brand-lime)" }}
          />
          Match breakdown
        </h2>
        <AnalysisPanel
          result={result}
          loading={loading}
          error={error}
          onDismiss={result || error ? onClear : undefined}
        />
      </section>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
        <span>Team ratings &amp; history</span>
        <span aria-hidden>·</span>
        <span>Polymarket odds</span>
        <span aria-hidden>·</span>
        <span>Live schedules (optional)</span>
        <span aria-hidden>·</span>
        <span>Optional AI commentary</span>
        <span aria-hidden>·</span>
        <span className="opacity-70">
          Kickoff <span className="brand-marquee">11 Jun 2026</span>
        </span>
      </footer>
    </main>
  );
}
