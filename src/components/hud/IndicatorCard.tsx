import { type ReactNode, useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockSeries, lastValue, type MockOptions } from "@/lib/mockSeries";
import { ConstructionPopover } from "@/components/hud/ConstructionPopover";
import type { ComponentSpec } from "@/lib/indicatorSpecs";

type Variant = "line" | "area" | "bar";

interface IndicatorCardProps {
  title?: string;
  subtitle?: string;
  seed: number;
  variant?: Variant;
  height?: number;
  min?: number;
  max?: number;
  drift?: number;
  volatility?: number;
  points?: number;
  thresholds?: { hi?: number; lo?: number };
  unit?: string;
  actions?: ReactNode;
  mockOverride?: MockOptions;
  /** When provided, the card derives title/scale/thresholds from the spec and adds an info popover. */
  component?: ComponentSpec;
}

export function IndicatorCard({
  title,
  subtitle,
  seed,
  variant = "line",
  height = 160,
  min = 0,
  max = 100,
  drift = 0,
  volatility = 0.2,
  points = 78,
  thresholds,
  unit = "",
  actions,
  mockOverride,
}: IndicatorCardProps) {
  const data = useMemo(
    () => mockSeries({ seed, min, max, drift, volatility, points, ...mockOverride }),
    [seed, min, max, drift, volatility, points, mockOverride],
  );
  const v = lastValue(data);

  const stroke = "hsl(var(--primary))";
  const grid = "hsl(var(--chart-grid))";
  const axis = "hsl(var(--chart-axis))";

  return (
    <div className="hud-panel flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono tabular-nums text-xs text-surface-foreground">
            {v.toFixed(1)}
            {unit}
          </span>
          {actions}
        </div>
      </div>
      <div className="p-1 hud-chart rounded-none" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "bar" ? (
            <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[min, max]} hide />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: "4px 8px" }}
                labelFormatter={(l) => l as string}
                formatter={(val: number) => [val.toFixed(2) + unit, title]}
              />
              <Bar dataKey="v" fill={stroke} />
              {thresholds?.hi != null && (
                <ReferenceLine y={thresholds.hi} stroke="hsl(var(--pos-short))" strokeDasharray="3 3" />
              )}
              {thresholds?.lo != null && (
                <ReferenceLine y={thresholds.lo} stroke="hsl(var(--pos-long))" strokeDasharray="3 3" />
              )}
            </BarChart>
          ) : variant === "area" ? (
            <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`g${seed}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={[min, max]} hide />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: "4px 8px" }}
                formatter={(val: number) => [val.toFixed(2) + unit, title]}
              />
              <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.4} fill={`url(#g${seed})`} />
              {thresholds?.hi != null && (
                <ReferenceLine y={thresholds.hi} stroke="hsl(var(--pos-short))" strokeDasharray="3 3" />
              )}
              {thresholds?.lo != null && (
                <ReferenceLine y={thresholds.lo} stroke="hsl(var(--pos-long))" strokeDasharray="3 3" />
              )}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[min, max]} hide />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: "4px 8px" }}
                formatter={(val: number) => [val.toFixed(2) + unit, title]}
              />
              <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.4} dot={false} />
              {thresholds?.hi != null && (
                <ReferenceLine y={thresholds.hi} stroke="hsl(var(--pos-short))" strokeDasharray="3 3" />
              )}
              {thresholds?.lo != null && (
                <ReferenceLine y={thresholds.lo} stroke="hsl(var(--pos-long))" strokeDasharray="3 3" />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CardGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  } as const;
  return <div className={`grid ${map[cols]} gap-3 p-3`}>{children}</div>;
}
