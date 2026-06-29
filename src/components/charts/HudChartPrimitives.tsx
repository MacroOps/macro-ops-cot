/**
 * HUD Chart Primitives
 * --------------------
 * Shared building blocks that give every chart in the app the same
 * "research terminal" look: percentile bands, sticky end-of-series
 * label, tabular tooltip, halo end-dot, animated stroke draw-in.
 *
 * Designed to drop into Recharts via <Customized />, or to be used
 * directly as overlays/replacements for the default Tooltip.
 */
import { useMemo } from "react";
import type { TooltipProps } from "recharts";

/* ------------------------------------------------------------------ *
 * Tooltip — tabular, fixed-width, with Δ vs prior point.
 * ------------------------------------------------------------------ */
export interface HudTooltipProps extends TooltipProps<number, string> {
  unit?: string;
  /** Full dataset (so we can compute Δ vs prior point). */
  data?: { t: string; v: number }[];
  /** Optional secondary value formatter. */
  format?: (v: number) => string;
}

export function HudTooltip({ active, payload, label, unit = "", data, format }: HudTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const v = typeof point.value === "number" ? point.value : Number(point.value ?? 0);
  const name = point.name ?? point.dataKey ?? "value";

  let delta: number | null = null;
  if (data && typeof label === "string") {
    const idx = data.findIndex((d) => d.t === label);
    if (idx > 0) delta = v - data[idx - 1].v;
  }

  const fmt = format ?? ((x: number) => x.toFixed(2));
  const deltaTone =
    delta == null ? "text-muted-foreground" : delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div
      className="rounded-sm border border-chart-grid bg-chart-surface shadow-md font-mono text-[10px] min-w-[140px]"
      style={{ color: "hsl(var(--chart-surface-foreground))" }}
    >
      <div
        className="px-2 py-1 border-b border-chart-grid text-[9px] uppercase tracking-[0.14em]"
        style={{ color: "hsl(var(--chart-axis))" }}
      >
        {String(label)}
      </div>
      <div className="px-2 py-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate" style={{ color: "hsl(var(--chart-axis))" }}>{String(name)}</span>
        <span className="tabular-nums font-semibold">{fmt(v)}{unit}</span>
      </div>
      {delta != null && (
        <div className="px-2 pb-1.5 flex items-baseline justify-between gap-3 -mt-1">
          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "hsl(var(--chart-axis))" }}>Δ</span>
          <span className={`tabular-nums ${deltaTone}`}>
            {delta > 0 ? "+" : ""}{fmt(delta)}{unit}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Percentile bands — paints horizontal bands across the plot area
 * showing 0–25 / 25–75 / 75–100 percentile ranges of the series.
 *
 * Use as a Recharts <Customized component={PercentileBandsLayer} ... />
 * or render the SVG directly through ReferenceArea-style props.
 * ------------------------------------------------------------------ */
export function computePercentiles(values: number[]) {
  if (!values.length) return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, min: 0, max: 1 };
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.max(0, Math.min(s.length - 1, Math.floor(q * (s.length - 1))))];
  return { p10: at(0.1), p25: at(0.25), p50: at(0.5), p75: at(0.75), p90: at(0.9), min: s[0], max: s[s.length - 1] };
}

interface PercentileBandsLayerProps {
  // injected by Recharts <Customized />
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  xAxisMap?: Record<string, { scale: (v: unknown) => number; x: number; width: number }>;
  offset?: { top: number; left: number; width: number; height: number };
  // ours — extremity thresholds (10th/90th percentile)
  p10: number;
  p90: number;
}

export function PercentileBandsLayer({ yAxisMap, offset, p10, p90 }: PercentileBandsLayerProps) {
  if (!yAxisMap || !offset) return null;
  const yAxis = Object.values(yAxisMap)[0];
  if (!yAxis?.scale) return null;
  const yHi = yAxis.scale(p90);
  const yLo = yAxis.scale(p10);
  const top = Math.min(yHi, yLo);
  const bot = Math.max(yHi, yLo);
  const { left, width, top: ot, height: oh } = offset;
  return (
    <g pointerEvents="none">
      {/* Hot extremity — above p90 only */}
      <rect x={left} y={ot} width={width} height={Math.max(0, top - ot)} fill="hsl(var(--chart-band-high) / 0.10)" />
      {/* Cool extremity — below p10 only */}
      <rect x={left} y={bot} width={width} height={Math.max(0, ot + oh - bot)} fill="hsl(var(--chart-band-low) / 0.10)" />
      {/* Hairline guides at p10 / p90 */}
      <line x1={left} x2={left + width} y1={top} y2={top} stroke="hsl(var(--chart-band-high) / 0.4)" strokeDasharray="2 3" strokeWidth={0.75} />
      <line x1={left} x2={left + width} y1={bot} y2={bot} stroke="hsl(var(--chart-band-low) / 0.4)" strokeDasharray="2 3" strokeWidth={0.75} />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * End-of-series label + halo dot.
 *
 * Renders a small filled dot at the last point with the latest value
 * inline to the right. Replaces the floating legend on most charts.
 * ------------------------------------------------------------------ */
interface EndLabelLayerProps {
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  xAxisMap?: Record<string, { scale: (v: unknown) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
  data: { t: string; v: number }[];
  unit?: string;
  /** Highlight the dot when value is outside [p10, p90] extremities. */
  bands?: { p10: number; p90: number };
  format?: (v: number) => string;
}

export function EndLabelLayer({ yAxisMap, xAxisMap, offset, data, unit = "", bands, format }: EndLabelLayerProps) {
  if (!yAxisMap || !xAxisMap || !offset || !data.length) return null;
  const yAxis = Object.values(yAxisMap)[0];
  const xAxis = Object.values(xAxisMap)[0];
  if (!yAxis?.scale || !xAxis?.scale) return null;
  const last = data[data.length - 1];
  const x = xAxis.scale(last.t);
  const y = yAxis.scale(last.v);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const isExtreme = bands ? last.v > bands.p90 || last.v < bands.p10 : false;
  const tone = !bands
    ? "hsl(var(--chart-halo))"
    : last.v > bands.p90
      ? "hsl(var(--chart-band-high))"
      : last.v < bands.p10
        ? "hsl(var(--chart-band-low))"
        : "hsl(var(--chart-halo))";

  const fmt = format ?? ((v: number) => v.toFixed(2));
  const label = `${fmt(last.v)}${unit}`;
  const labelW = Math.max(34, label.length * 6 + 8);
  const right = offset.left + offset.width;
  const labelX = Math.min(right - labelW - 2, x + 8);

  return (
    <g pointerEvents="none">
      {/* Halo */}
      <circle cx={x} cy={y} r={isExtreme ? 5 : 3.5} fill={tone} fillOpacity={0.18} />
      <circle cx={x} cy={y} r={isExtreme ? 3 : 2.25} fill={tone}>
        {isExtreme && (
          <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Label chip */}
      <g transform={`translate(${labelX}, ${y - 8})`}>
        <rect x={0} y={0} width={labelW} height={16} rx={2} ry={2} fill="hsl(var(--chart-surface))" stroke={tone} strokeOpacity={0.6} />
        <text x={labelW / 2} y={11} textAnchor="middle" fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace" fill={tone} fontWeight={600}>
          {label}
        </text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * useBands — convenience hook to compute bands from a series.
 * ------------------------------------------------------------------ */
export function useBands(data: { v: number }[]) {
  return useMemo(() => computePercentiles(data.map((d) => d.v)), [data]);
}

/* ------------------------------------------------------------------ *
 * Hover crosshair chip — small axis-anchored value chip rendered when
 * the user is hovering. Optional, called from the shell.
 * ------------------------------------------------------------------ */
interface HoverAxisChipProps {
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  xAxisMap?: Record<string, { scale: (v: unknown) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
  hoverT: string | null;
  data: { t: string; v: number }[];
  unit?: string;
}
export function HoverAxisChipLayer({ yAxisMap, xAxisMap, offset, hoverT, data, unit = "" }: HoverAxisChipProps) {
  if (!yAxisMap || !xAxisMap || !offset || !hoverT) return null;
  const point = data.find((d) => d.t === hoverT);
  if (!point) return null;
  const yAxis = Object.values(yAxisMap)[0];
  const xAxis = Object.values(xAxisMap)[0];
  if (!yAxis?.scale || !xAxis?.scale) return null;
  const x = xAxis.scale(point.t);
  const y = yAxis.scale(point.v);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const label = `${point.v.toFixed(2)}${unit}`;
  const w = Math.max(36, label.length * 6 + 8);
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={3} fill="hsl(var(--chart-halo))" />
      <circle cx={x} cy={y} r={6} fill="hsl(var(--chart-halo) / 0.15)" />
      <g transform={`translate(${Math.max(offset.left + 2, x - w / 2)}, ${offset.top + offset.height + 2})`}>
        <rect width={w} height={14} rx={2} fill="hsl(var(--chart-halo))" />
        <text x={w / 2} y={10} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono, ui-monospace, monospace" fill="white" fontWeight={600}>
          {point.t}
        </text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * HudCrosshairCursor — Recharts <Tooltip cursor={...} /> element that
 * paints BOTH a vertical and horizontal dashed hairline through the
 * hovered point, instead of the default vertical-only cursor.
 * ------------------------------------------------------------------ */
interface HudCrosshairCursorProps {
  // Recharts spreads the plot-area `offset` (top/left/width/height) directly
  // onto the cursor element, then spreads `restProps`:
  //   - Line / Area / Composed → `{ points: [{x,y},{x,y}] }` (vertical span)
  //   - BarChart only          → `{ x, y, width, height }` (the band rect,
  //     which OVERRIDES the offset width/height)
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  payloadIndex?: number;
  stroke?: string;
  strokeOpacity?: number;
}
export function HudCrosshairCursor(props: HudCrosshairCursorProps) {
  const {
    top, left, width, height,
    points,
    x: rectX, y: rectY,
    payload,
    stroke = "hsl(var(--chart-halo))",
    strokeOpacity = 0.55,
  } = props;

  // Vertical line x:
  //  - Line/Area/Composed cursor: points[0].x === points[1].x → use that.
  //  - Bar rect: center of rect.
  let cx: number | undefined;
  if (points && points.length >= 1 && Number.isFinite(points[0].x)) {
    cx = points[0].x;
  } else if (Number.isFinite(rectX) && Number.isFinite(props.width)) {
    cx = (rectX as number) + (props.width as number) / 2;
  }

  // Plot-area top/height for the vertical line span.
  let vyTop: number | undefined;
  let vyH: number | undefined;
  if (points && points.length >= 2) {
    vyTop = Math.min(points[0].y, points[1].y);
    vyH = Math.abs(points[1].y - points[0].y);
  } else if (top != null && height != null) {
    vyTop = top;
    vyH = height;
  } else if (rectY != null && props.height != null) {
    vyTop = rectY;
    vyH = props.height;
  }

  // Horizontal line x-span = plot area (offset.left/width). For BarChart the
  // x/width are the band, but offset's left/width are still spread on (rect
  // overrides only x/y/width/height after offset's left/top do too — but
  // `left`/`top` survive because they aren't overridden by rect props).
  // Fall back to deriving from points if needed.
  let hxLeft: number | undefined = left;
  let hxW: number | undefined;
  if (left != null && width != null && !Number.isFinite(rectX)) {
    hxW = width;
  } else if (left != null && rectX == null) {
    hxW = width;
  } else if (left != null) {
    // BarChart case: width prop was overwritten by rect width. Use a wide
    // fallback that extends from offset.left across a reasonable span.
    hxW = (props.width as number) ?? 0;
  }

  if (cx == null || vyTop == null || vyH == null) return null;

  // Horizontal hairline y: prefer the active payload's plotted y if we can
  // get it via points. For category cursors, points are the vertical line
  // top/bottom — no horizontal anchor — so use the midpoint as a visual
  // guide. This matches the prior behavior on line/area charts.
  const cy =
    points && points.length >= 2
      ? // line cursor has no horizontal anchor: use midpoint of vertical span
        (points[0].y + points[1].y) / 2
      : rectY != null && props.height != null
        ? rectY + props.height / 2
        : vyTop + vyH / 2;

  return (
    <g pointerEvents="none">
      <line
        x1={cx} x2={cx}
        y1={vyTop} y2={vyTop + vyH}
        stroke={stroke} strokeOpacity={strokeOpacity}
        strokeDasharray="2 3" strokeWidth={1}
      />
      {hxLeft != null && hxW != null && hxW > 0 && (
        <line
          x1={hxLeft} x2={hxLeft + hxW}
          y1={cy} y2={cy}
          stroke={stroke} strokeOpacity={strokeOpacity * 0.7}
          strokeDasharray="2 3" strokeWidth={1}
        />
      )}
    </g>
  );
}
