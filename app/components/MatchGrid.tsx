"use client";

import { ProbabilityGauge } from "@/app/components/ProbabilityGauge";
import { flagFor } from "@/lib/flags";
import { formatKickoff, type Fixture } from "@/lib/fixtures";
import { gaugeMarketLabel } from "@/lib/ui-copy";

type Props = {
  fixtures: Fixture[];
  onAnalyze: (f: Fixture) => void;
  activeId?: string;
  busy?: boolean;
};

export function MatchGrid({ fixtures, onAnalyze, activeId, busy }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fixtures.map((f) => {
        const active = f.id === activeId;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onAnalyze(f)}
            disabled={busy}
            className={[
              busy ? "opacity-60" : "",
              "group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-white p-4 text-left",
              "transition-all hover:-translate-y-0.5 hover:shadow-lg",
              "dark:bg-zinc-950",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-magenta)]",
              active
                ? "border-[var(--brand-magenta)] ring-1 ring-[var(--brand-magenta)] brand-ring"
                : "border-zinc-200 hover:border-[var(--brand-magenta)] dark:border-zinc-800 dark:hover:border-[var(--brand-magenta)]",
            ].join(" ")}
          >
            {/* Top accent bar */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5"
              style={{
                background:
                  "linear-gradient(90deg, var(--brand-magenta) 0%, var(--brand-tangerine) 40%, var(--brand-amber) 70%, var(--brand-lime) 100%)",
                opacity: active ? 1 : 0.5,
              }}
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: "var(--brand-tangerine)" }}
                  />
                  {f.is_world_cup && (
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-bold text-white"
                      style={{ background: "var(--brand-sky)" }}
                    >
                      World Cup
                    </span>
                  )}
                  {f.competition}
                </div>

                <div className="mt-2 flex flex-col gap-1">
                  <TeamLine name={f.home} side="home" />
                  <div className="ml-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    vs
                  </div>
                  <TeamLine name={f.away} side="away" />
                </div>

                <div className="mt-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {formatKickoff(f.kickoff_iso)}
                </div>
              </div>
              <ProbabilityGauge
                value={f.market_home_win}
                label={gaugeMarketLabel(
                  f.market_price_source === "polymarket" ? "polymarket" : "neutral",
                )}
                size={68}
              />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 dark:text-zinc-400">See full breakdown</span>
              <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-magenta)]">
                →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TeamLine({ name, side }: { name: string; side: "home" | "away" }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="text-lg leading-none"
        title={`flag of ${name}`}
      >
        {flagFor(name)}
      </span>
      <span className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {name}
      </span>
      <span className="ml-auto text-[9px] text-zinc-400 dark:text-zinc-500">
        {side === "home" ? "Home" : "Away"}
      </span>
    </div>
  );
}
