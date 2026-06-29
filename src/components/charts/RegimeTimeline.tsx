/**
 * RegimeTimeline — long-horizon line chart with vertical regime washes
 * painted behind it (Risk-On / Risk-Off / Neutral). The "wow" chart for
 * Overview and RiskCycle.
 */
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Customized,
} from "recharts";
import { mockSeries } from "@/lib/mockSeries";
import { HudTooltip, EndLabelLayer, HudCrosshairCursor, computePercentiles } from "@/components/charts/HudChartPrimitives";

type Regime = "risk-on" | "risk-off" | "neutral";

const REGIME_FILL: Record<Regime, string> = {
  "risk-on": "hsl(var(--chart-band-low) / 0.10)",
  "risk-off": "hsl(var(--chart-band-high) / 0.10)",
  neutral: "hsl(var(--chart-band-mid) / 0.04)",
};
const REGIME_LABEL: Record<Regime, string> = {
  "risk-on": "Risk-On",
  "risk-off": "Risk-Off",
  neutral: "Neutral",
};
const REGIME_INK: Record<Regime, string> = {
  "risk-on": "hsl(var(--chart-band-low))",
  "risk-off": "hsl(var(--chart-band-high))",
  neutral: "hsl(var(--chart-axis))",
};

interface Props {
  /** Title in the eyebrow row */
  title: string;
  subtitle?: string;
  /** Price/composite series seed */
  seed: number;
  /** Regime classifier seed (drives the wash segments) */
  regimeSeed?: number;
  height?: number;
  points?: number;
  min?: number;
  max?: number;
}

export function RegimeTimeline({
  title,
  subtitle,
  seed,
  regimeSeed,
  height = 240,
  points = 156,
  min,
  max,
}: Props) {
  const data = useMemo(
    () => mockSeries({ seed, points, min: min ?? 0, max: max ?? 100, volatility: 0.18, drift: 0.1 }),
    [seed, points, min, max],
  );
  const classifier = useMemo(
    () => mockSeries({ seed: regimeSeed ?? seed + 1000, points, min: 0, max: 100, volatility: 0.22 }),
    [regimeSeed, seed, points],
  );

  // Convert classifier into contiguous regime segments.
  const segments = useMemo(() => {
    const segs: Array<{ start: string; end: string; regime: Regime }> = [];
    let cur: Regime | null = null;
    let startIdx = 0;
    classifier.forEach((p, i) => {
      const r: Regime = p.v > 62 ? "risk-on" : p.v < 38 ? "risk-off" : "neutral";
      if (cur === null) {
        cur = r;
        startIdx = i;
      } else if (r !== cur) {
        segs.push({ start: classifier[startIdx].t, end: classifier[i].t, regime: cur });
        cur = r;
        startIdx = i;
      }
    });
    if (cur !== null) segs.push({ start: classifier[startIdx].t, end: classifier[classifier.length - 1].t, regime: cur });
    return segs;
  }, [classifier]);

  const bands = useMemo(() => computePercentiles(data.map((d) => d.v)), [data]);
  const currentRegime = segments[segments.length - 1]?.regime ?? "neutral";
  const last = data[data.length - 1].v;

  const EndLayer = (p: object) => (
    <EndLabelLayer {...(p as Record<string, unknown>)} data={data} bands={bands} />
  );

  // Count regimes for the meta strip
  const counts = segments.reduce(
    (acc, s) => ({ ...acc, [s.regime]: (acc[s.regime] ?? 0) + 1 }),
    {} as Record<Regime, number>,
  );

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[9px] font-mono">
          {(["risk-on", "neutral", "risk-off"] as Regime[]).map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm border"
                style={{ background: REGIME_FILL[r], borderColor: REGIME_INK[r] + "33" }}
              />
              <span className="uppercase tracking-[0.12em] text-muted-foreground">{REGIME_LABEL[r]}</span>
              <span className="tabular-nums text-surface-foreground">{counts[r] ?? 0}</span>
            </div>
          ))}
          <div className="pl-3 border-l border-border flex items-center gap-1.5">
            <span className="uppercase tracking-[0.12em] text-muted-foreground">Now</span>
            <span
              className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: REGIME_FILL[currentRegime], color: REGIME_INK[currentRegime] }}
            >
              {REGIME_LABEL[currentRegime]}
            </span>
            <span className="tabular-nums text-surface-foreground">{last.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className="hud-chart rounded-none p-1" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
            <defs>
              <linearGradient id={`rt-grad-${seed}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-accent))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--chart-accent))" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }}
              axisLine={{ stroke: "hsl(var(--chart-grid))" }}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              domain={[
                (dataMin: number) => (min ?? dataMin) - Math.abs(((max ?? dataMin + 1) - (min ?? dataMin)) * 0.08),
                (dataMax: number) => (max ?? dataMax) + Math.abs(((max ?? dataMax) - (min ?? dataMax - 1)) * 0.08),
              ]}
              tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />

            {/* Regime washes — painted first, behind everything */}
            {segments.map((s, i) => (
              <ReferenceArea
                key={i}
                x1={s.start}
                x2={s.end}
                fill={REGIME_FILL[s.regime]}
                fillOpacity={1}
                stroke="none"
                ifOverflow="visible"
              />
            ))}
            {/* Median reference */}
            <ReferenceLine
              y={bands.p50}
              stroke="hsl(var(--chart-ink-muted))"
              strokeDasharray="2 3"
              strokeOpacity={0.5}
            />
            <Tooltip content={<HudTooltip data={data} />} cursor={<HudCrosshairCursor />} />
            <Area
              type="monotone"
              dataKey="v"
              stroke="hsl(var(--chart-accent))"
              strokeWidth={1.75}
              fill={`url(#rt-grad-${seed})`}
              isAnimationActive
              animationDuration={750}
              animationEasing="ease-out"
            />
            <Customized component={EndLayer} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
