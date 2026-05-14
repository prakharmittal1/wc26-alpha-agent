/**
 * Minimal SVG semicircle gauge for a probability in [0, 1].
 *
 * Pure server-renderable - no client state - so it can live inside the
 * server-rendered MatchGrid.
 */

type Props = {
  /** Value in [0, 1]. */
  value: number;
  /** Label under the value (e.g. "P(home win)"). */
  label?: string;
  /** Reference value to compare against (renders a thin tick). */
  reference?: number;
  size?: number;
};

export function ProbabilityGauge({
  value,
  label,
  reference,
  size = 96,
}: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const startAngle = Math.PI;
  const endAngle = 0;
  const arc = (t: number) => {
    const a = startAngle + (endAngle - startAngle) * t;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  const start = arc(0);
  const end = arc(clamped);
  const largeArc = clamped > 0.5 ? 1 : 0;
  const path = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  const bgEnd = arc(1);
  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  const refTick = reference != null ? arc(Math.max(0, Math.min(1, reference))) : null;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 12}
        viewBox={`0 0 ${size} ${size / 2 + 12}`}
        role="img"
        aria-label={`${label ?? "probability"}: ${(clamped * 100).toFixed(1)}%`}
      >
        <defs>
          <linearGradient id={`gauge-grad-${size}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-magenta)" />
            <stop offset="55%" stopColor="var(--brand-tangerine)" />
            <stop offset="100%" stopColor="var(--brand-lime)" />
          </linearGradient>
        </defs>
        <path
          d={bgPath}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <path
          d={path}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          stroke={`url(#gauge-grad-${size})`}
        />
        {refTick && (
          <line
            x1={refTick.x - Math.cos(Math.PI + (Math.PI * (reference ?? 0))) * 4}
            y1={refTick.y - Math.sin(Math.PI + (Math.PI * (reference ?? 0))) * 4}
            x2={refTick.x + Math.cos(Math.PI + (Math.PI * (reference ?? 0))) * 4}
            y2={refTick.y + Math.sin(Math.PI + (Math.PI * (reference ?? 0))) * 4}
            strokeWidth={2}
            stroke="var(--brand-sky)"
          />
        )}
      </svg>
      <div className="mt-[-8px] flex flex-col items-center leading-tight">
        <span className="font-mono text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {(clamped * 100).toFixed(0)}%
        </span>
        {label && (
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
