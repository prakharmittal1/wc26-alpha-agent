import { oddsCellClassName, outcomeOddsStyle, type OutcomeSide } from "@/lib/odds-colors";
import { formatChance } from "@/lib/ui-copy";

type Props = {
  teamA: string;
  teamB: string;
  teamAPrice: number;
  drawPrice?: number | null;
  teamBPrice?: number | null;
  compact?: boolean;
  tile?: boolean;
};

/** Polymarket style win / draw / win display using team names. */
export function ThreeWayOdds({
  teamA,
  teamB,
  teamAPrice,
  drawPrice,
  teamBPrice,
  compact,
  tile,
}: Props) {
  const threeWay =
    drawPrice != null &&
    teamBPrice != null &&
    Number.isFinite(drawPrice) &&
    Number.isFinite(teamBPrice);

  if (!threeWay) {
    const sizeClass = tile ? "text-3xl" : compact ? "text-lg" : "text-2xl";
    const fill = outcomeOddsStyle(teamAPrice, "home");
    return (
      <div
        className={oddsCellClassName(
          tile ? "flex w-full flex-col items-center rounded-lg px-2 py-2.5" : "flex flex-col items-end rounded-lg px-2 py-1.5",
        )}
        style={{
          backgroundColor: fill.backgroundColor,
          color: fill.color,
          borderColor: fill.borderColor,
        }}
      >
        <span className={`font-semibold tabular-nums tracking-tight ${sizeClass}`}>
          {formatChance(teamAPrice)}
        </span>
        <span
          className={
            tile ? "mt-1 text-xs font-semibold uppercase tracking-wider opacity-80" : "text-[10px] font-semibold opacity-80"
          }
        >
          {shortName(teamA)}
        </span>
      </div>
    );
  }

  if (tile) {
    return (
      <div className="grid w-full grid-cols-3 gap-2">
        <OddsCell label={shortName(teamA)} value={teamAPrice} side="home" variant="tile" />
        <OddsCell label="Draw" value={drawPrice} side="draw" variant="tile" />
        <OddsCell label={shortName(teamB)} value={teamBPrice} side="away" variant="tile" />
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "grid grid-cols-3 gap-1 text-center text-[10px]"
          : "grid grid-cols-3 gap-2 text-center text-xs"
      }
    >
      <OddsCell label={shortName(teamA)} value={teamAPrice} side="home" variant={compact ? "compact" : "default"} />
      <OddsCell label="Draw" value={drawPrice} side="draw" variant={compact ? "compact" : "default"} />
      <OddsCell label={shortName(teamB)} value={teamBPrice} side="away" variant={compact ? "compact" : "default"} />
    </div>
  );
}

function shortName(team: string): string {
  const parts = team.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return parts.map((p) => p[0]).join("").slice(0, 3).toUpperCase();
}

function OddsCell({
  label,
  value,
  side,
  variant,
}: {
  label: string;
  value: number;
  side: OutcomeSide;
  variant: "tile" | "compact" | "default";
}) {
  const fill = outcomeOddsStyle(value, side);

  if (variant === "tile") {
    return (
      <div
        className={oddsCellClassName(
          "flex flex-col items-center justify-center rounded-lg px-2 py-2.5",
        )}
        style={{
          backgroundColor: fill.backgroundColor,
          color: fill.color,
          borderColor: fill.borderColor,
        }}
      >
        <div className="text-2xl font-semibold leading-none tabular-nums tracking-tight sm:text-3xl">
          {formatChance(value)}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
      </div>
    );
  }

  const valueClass = variant === "compact" ? "text-sm font-semibold" : "text-base font-semibold";

  return (
    <div
      className={oddsCellClassName("rounded-lg px-1.5 py-1")}
      style={{
        backgroundColor: fill.backgroundColor,
        color: fill.color,
        borderColor: fill.borderColor,
      }}
    >
      <div className={`tabular-nums ${valueClass}`}>{formatChance(value)}</div>
      <div className="mt-0.5 truncate text-[9px] font-medium opacity-80">{label}</div>
    </div>
  );
}
