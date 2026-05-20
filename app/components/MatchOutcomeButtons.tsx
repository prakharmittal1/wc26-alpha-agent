import {
  oddsCellClassName,
  outcomeOddsStyle,
  polyPillStyle,
  type OutcomeSide,
} from "@/lib/odds-colors";
import { formatChance, formatMarketCents } from "@/lib/ui-copy";

type Props = {
  teamA: string;
  teamB: string;
  teamAPrice: number;
  drawPrice?: number | null;
  teamBPrice?: number | null;
  layout?: "list" | "grid" | "poly";
  /** Tile grid: full team names + percent. */
  tileDisplay?: "percent" | "cents";
};

function abbrev(team: string): string {
  const parts = team.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return parts.map((p) => p[0]).join("").slice(0, 3).toUpperCase();
}

export function MatchOutcomeButtons({
  teamA,
  teamB,
  teamAPrice,
  drawPrice,
  teamBPrice,
  layout = "list",
  tileDisplay = "percent",
}: Props) {
  const threeWay =
    drawPrice != null &&
    teamBPrice != null &&
    Number.isFinite(drawPrice) &&
    Number.isFinite(teamBPrice);

  if (layout === "poly") {
    if (!threeWay) {
      return (
        <div className="flex shrink-0 gap-1.5">
          <OutcomeButton
            label={abbrev(teamA)}
            priceValue={teamAPrice}
            variant="home"
            poly
          />
        </div>
      );
    }
    return (
      <div className="flex shrink-0 gap-1.5">
        <OutcomeButton label={abbrev(teamA)} priceValue={teamAPrice} variant="home" poly />
        <OutcomeButton label="DRAW" priceValue={drawPrice} variant="draw" poly />
        <OutcomeButton label={abbrev(teamB)} priceValue={teamBPrice} variant="away" poly />
      </div>
    );
  }

  const formatPrice =
    layout === "grid" && tileDisplay === "percent" ? formatChance : formatMarketCents;

  if (!threeWay) {
    return (
      <div className={layout === "grid" ? "w-full" : "flex w-[6.75rem] shrink-0 flex-col justify-center"}>
        <OutcomeButton
          label={teamA.trim()}
          price={formatPrice(teamAPrice)}
          priceValue={teamAPrice}
          variant="home"
          tile={layout === "grid"}
        />
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid w-full grid-cols-3 gap-1.5">
        <OutcomeButton label={teamA.trim()} price={formatPrice(teamAPrice)} priceValue={teamAPrice} variant="home" tile />
        <OutcomeButton label="Draw" price={formatPrice(drawPrice)} priceValue={drawPrice} variant="draw" tile />
        <OutcomeButton label={teamB.trim()} price={formatPrice(teamBPrice)} priceValue={teamBPrice} variant="away" tile />
      </div>
    );
  }

  return (
    <div className="flex w-[6.75rem] shrink-0 flex-col gap-1.5">
      <OutcomeButton label={abbrev(teamA)} price={formatMarketCents(teamAPrice)} priceValue={teamAPrice} variant="home" />
      <OutcomeButton label="DRAW" price={formatMarketCents(drawPrice)} priceValue={drawPrice} variant="draw" />
      <OutcomeButton label={abbrev(teamB)} price={formatMarketCents(teamBPrice)} priceValue={teamBPrice} variant="away" />
    </div>
  );
}

function PolyCents({
  value,
  draw,
  textColor,
}: {
  value: number;
  draw?: boolean;
  textColor?: string;
}) {
  const cents = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span
      className="inline-flex items-baseline gap-px font-bold leading-none"
      style={{ color: draw ? "#18181b" : textColor }}
    >
      <span className="text-base tabular-nums">{cents}</span>
      <span className="text-sm font-semibold">¢</span>
    </span>
  );
}

function OutcomeButton({
  label,
  price,
  priceValue,
  variant,
  tile,
  poly,
}: {
  label: string;
  price?: string;
  priceValue?: number;
  variant: OutcomeSide;
  tile?: boolean;
  poly?: boolean;
}) {
  if (poly && priceValue != null && Number.isFinite(priceValue)) {
    const isDraw = variant === "draw";
    const fill = polyPillStyle(priceValue, variant);
    return (
      <span
        className="flex h-[3.25rem] w-[3.1rem] flex-col items-center justify-center gap-0 rounded-xl tabular-nums ring-1 ring-black/5"
        style={{
          backgroundColor: fill.backgroundColor,
          color: fill.color,
          boxShadow: fill.boxShadow,
          borderColor: fill.borderColor,
        }}
      >
        <span
          className={[
            "text-[9px] font-semibold uppercase leading-none tracking-wide",
            isDraw ? "text-zinc-500" : "opacity-90",
          ].join(" ")}
          style={isDraw ? undefined : { color: fill.color }}
        >
          {label}
        </span>
        <PolyCents value={priceValue} draw={isDraw} textColor={fill.color} />
      </span>
    );
  }

  const fill =
    priceValue != null && Number.isFinite(priceValue)
      ? outcomeOddsStyle(priceValue, variant)
      : outcomeOddsStyle(0.5, variant);

  if (tile) {
    return (
      <span
        className={oddsCellClassName(
          "flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-md px-1.5 py-2 tabular-nums",
        )}
        style={{
          backgroundColor: fill.backgroundColor,
          color: fill.color,
          borderColor: fill.borderColor,
        }}
      >
        <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight">{label}</span>
        <span className="text-base font-bold leading-none">{price}</span>
      </span>
    );
  }

  return (
    <span
      className={oddsCellClassName(
        "flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium tabular-nums",
      )}
      style={{
        backgroundColor: fill.backgroundColor,
        color: fill.color,
        borderColor: fill.borderColor,
      }}
    >
      <span className="text-[10px] font-semibold tracking-wide opacity-80">{label}</span>
      <span>{price}</span>
    </span>
  );
}
