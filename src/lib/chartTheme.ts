/**
 * Shared chart styling. One source for the paper-surface look used by the
 * Recharts views (HUD, TPMR, Asset, Sectors, Offsides, Portfolio, ...) and by
 * the TCTM canvas (ECharts, src/lib/tctm/dashboard.js).
 *
 * Tokens live in src/index.css (--chart-*, --pos-*, --warning). Chart tokens
 * are identical in light and dark on purpose: charts stay on paper.
 */
import type { CSSProperties } from "react";

/** CSS color for a token. Usable in React props and inline styles. */
export function chartColor(token: string, alpha?: number): string {
  return alpha == null ? `hsl(var(${token}))` : `hsl(var(${token}) / ${alpha})`;
}

/**
 * Resolve a token to a concrete hsl() string. ECharts (canvas) cannot read
 * var(), so it needs the computed value. Same contract the TCTM page used.
 */
export function readChartToken(token: string, alpha?: number, root: Element = document.documentElement): string {
  const raw = getComputedStyle(root).getPropertyValue(token).trim();
  if (!raw) return alpha == null ? "rgb(136, 136, 136)" : `rgba(136,136,136,${alpha})`;
  return alpha == null ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/** Recharts <Tooltip contentStyle> on the paper surface. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: chartColor("--chart-surface"),
  border: `1px solid ${chartColor("--chart-grid")}`,
  borderRadius: 2,
  fontSize: 11,
  color: chartColor("--chart-surface-foreground"),
};

/** Recharts <CartesianGrid> props. */
export const CHART_GRID_PROPS = {
  stroke: chartColor("--chart-grid"),
  strokeDasharray: "2 4",
  vertical: false,
} as const;

/** Recharts axis tick style. */
export const CHART_TICK = { fontSize: 10, fill: chartColor("--chart-axis") } as const;

/** Recharts axis line style. */
export const CHART_AXIS_LINE = { stroke: chartColor("--chart-grid") } as const;

/**
 * Contrarian extreme ramp (positioning reads). High percentile = extreme long
 * = red, low = extreme short = green. Used with a text label on the view, as
 * AGENTS.md requires. The midpoint is amber (--warning), so the ramp keeps the
 * red-amber-green reading.
 */
export const CHART_EXTREME = {
  high: chartColor("--chart-band-high"),
  mid: chartColor("--warning"),
  low: chartColor("--chart-band-low"),
} as const;
