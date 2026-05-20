"use client";

import { MatchOutcomeButtons } from "@/app/components/MatchOutcomeButtons";
import { flagFor } from "@/lib/flags";
import { formatKickoffTile, resolveFixtureVenueTile, type Fixture } from "@/lib/fixtures";

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
        const venue = resolveFixtureVenueTile(f);

        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onAnalyze(f)}
            disabled={busy}
            aria-label={`${f.home} vs ${f.away}, ${formatKickoffTile(f.kickoff_iso)}, ${venue}`}
            className={[
              "group relative w-full overflow-hidden rounded-xl border bg-white p-3.5 text-left",
              "transition-all hover:shadow-md",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-magenta)]",
              busy && !active ? "opacity-60" : "",
              active
                ? "border-[var(--brand-magenta)] ring-1 ring-[var(--brand-magenta)]"
                : "border-zinc-200 hover:border-zinc-300",
            ].join(" ")}
          >
            <p className="mb-2.5 truncate font-mono text-[10px] leading-snug text-zinc-600">
              {formatKickoffTile(f.kickoff_iso)}
              <span className="text-zinc-400"> · </span>
              <span className="text-zinc-500">{venue}</span>
            </p>

            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <TeamRow name={f.home} />
                <TeamRow name={f.away} />
              </div>

              <MatchOutcomeButtons
                layout="poly"
                teamA={f.home}
                teamB={f.away}
                teamAPrice={f.market_home_win}
                drawPrice={f.market_draw}
                teamBPrice={f.market_away_win}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TeamRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-50 text-base leading-none ring-1 ring-zinc-200"
      >
        {flagFor(name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold leading-tight text-zinc-950">
        {name}
      </span>
    </div>
  );
}
