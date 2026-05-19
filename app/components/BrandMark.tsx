import { flagFor, HOST_NATIONS } from "@/lib/flags";

/**
 * Stylized WC26 mark: a trophy silhouette in front of a "26" set in a
 * vibrant gradient. Host nation flags stack beside.
 *
 * Pure SVG, server-renderable, no client JS.
 */
export function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 64 64"
        width={56}
        height={56}
        aria-label="World Cup 2026 mark"
        role="img"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="wc26grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-magenta)" />
            <stop offset="45%" stopColor="var(--brand-tangerine)" />
            <stop offset="75%" stopColor="var(--brand-amber)" />
            <stop offset="100%" stopColor="var(--brand-lime)" />
          </linearGradient>
        </defs>

        <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#wc26grad)" />

        {/* Stylised trophy + 26 mark in negative space. */}
        <g fill="currentColor" className="text-zinc-50">
          {/* trophy cup */}
          <path d="M22 14h20v6c0 5-3 9-7 10v6h4v4H25v-4h4v-6c-4-1-7-5-7-10v-6z" opacity="0.92" />
          {/* trophy base */}
          <rect x="21" y="44" width="22" height="3" rx="1.2" opacity="0.92" />
          {/* "26" */}
          <text
            x="32"
            y="36"
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontWeight="800"
            fontSize="11"
            letterSpacing="-0.5"
            fill="var(--brand-magenta)"
          >
            26
          </text>
        </g>
      </svg>

      <div className="flex flex-col leading-tight">
        <span className="brand-marquee font-mono text-[11px] font-bold uppercase tracking-[0.32em]">
          FIFA World Cup 26
        </span>
        <span className="text-base font-semibold text-zinc-950 dark:text-zinc-50 sm:text-lg">
          Match Picks
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          {HOST_NATIONS.map((h) => (
            <span key={h.tag} className="flex items-center gap-0.5">
              <span aria-hidden className="text-sm leading-none">{flagFor(h.team)}</span>
              <span>{h.tag}</span>
            </span>
          ))}
          <span className="ml-1 opacity-50">· hosts</span>
        </span>
      </div>
    </div>
  );
}
