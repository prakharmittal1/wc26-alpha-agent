"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AnalysisPanel } from "@/app/components/AnalysisPanel";
import { BrandMark } from "@/app/components/BrandMark";
import { MatchGrid } from "@/app/components/MatchGrid";
import type { AnalyzeResult } from "@/lib/alpha-types";
import { FIFA_WC_2026_FIXTURES_URL, POLYMARKET_WC_GAMES_URL } from "@/lib/external-links";
import type { Fixture } from "@/lib/fixtures";

type Props = {
  fixtures: Fixture[];
};

export function Dashboard({ fixtures }: Props) {
  const [activeId, setActiveId] = useState<string | undefined>();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const breakdownRef = useRef<HTMLElement>(null);
  const pendingFocusRef = useRef(false);

  const focusBreakdown = useCallback(() => {
    const el = breakdownRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!pendingFocusRef.current || loading) return;
    pendingFocusRef.current = false;
    requestAnimationFrame(() => focusBreakdown());
  }, [loading, result, error, focusBreakdown]);

  const onAnalyzeFixture = useCallback(
    async (f: Fixture) => {
      setActiveId(f.id);
      setLoading(true);
      setError(null);
      setResult(null);
      pendingFocusRef.current = true;
      requestAnimationFrame(() => focusBreakdown());

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
            market_draw: f.market_draw ?? undefined,
            market_away_win: f.market_away_win ?? undefined,
            polymarket_event_slug:
              f.polymarket_event_slug ?? f.polymarket_market_slug ?? undefined,
            polymarket_market_slug: f.polymarket_market_slug,
            venue: f.venue,
            is_world_cup: f.is_world_cup ?? true,
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
    },
    [focusBreakdown],
  );

  const onClear = useCallback(() => {
    setActiveId(undefined);
    setResult(null);
    setError(null);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark />
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="brand-marquee font-mono text-[10px] font-bold uppercase tracking-[0.32em]">
            Live · 2026 cycle
          </span>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-right sm:text-3xl">
            Beat the market odds <br className="hidden sm:block" />
            <span className="brand-marquee">before they catch up.</span>
          </h1>
        </div>
      </header>

      <p className="max-w-3xl text-sm text-zinc-600">
        Tap a match to see how our win estimate compares to betting odds. Full schedule on{" "}
        <a
          href={FIFA_WC_2026_FIXTURES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline decoration-[var(--brand-sky)]/40 underline-offset-2"
          style={{ color: "var(--brand-sky)" }}
        >
          FIFA.com
        </a>
        .
      </p>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
            <span
              aria-hidden
              className="inline-block size-2 rounded-sm"
              style={{
                background: "linear-gradient(135deg, var(--brand-magenta), var(--brand-lime))",
              }}
            />
            World Cup 2026 · Upcoming matches
          </h2>
          <span className="font-mono text-[10px] text-zinc-500">
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

      <section
        ref={breakdownRef}
        id="match-breakdown"
        tabIndex={-1}
        aria-labelledby="match-breakdown-heading"
        className="scroll-mt-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-magenta)]"
      >
        <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-zinc-100 bg-gradient-to-b from-white to-zinc-50/80 shadow-sm">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
            <span
              id="match-breakdown-heading"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
            >
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ background: "var(--brand-magenta)" }}
              />
              Match breakdown
            </span>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <AnalysisPanel
              result={result}
              loading={loading}
              error={error}
              onDismiss={result || error ? onClear : undefined}
            />
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-400">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: "var(--brand-magenta)" }}
          />
          Team strength, past results, and notes
        </span>
        <span aria-hidden>·</span>
        <a
          href={POLYMARKET_WC_GAMES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[var(--brand-sky)]/40 underline-offset-2"
          style={{ color: "var(--brand-sky)" }}
        >
          Betting odds on Polymarket
        </a>
        <span aria-hidden>·</span>
        <span className="opacity-70">
          Kickoff <span className="brand-marquee">11 Jun 2026</span>
        </span>
      </footer>
    </main>
  );
}
