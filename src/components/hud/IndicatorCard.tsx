import { type ReactNode, useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Brush,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockSeries, lastValue, type MockOptions } from "@/lib/mockSeries";
import { ConstructionPopover } from "@/components/hud/ConstructionPopover";
import type { ComponentSpec } from "@/lib/indicatorSpecs";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { Sparkles } from "lucide-react";

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
  /** Show a range brush below the chart for long series. */
  brush?: boolean;
  /** When provided, the card derives title/scale/thresholds from the spec and adds an info popover. */
  component?: ComponentSpec;
}

export function IndicatorCard({
  title,
  subtitle,
  seed,
  variant = "line",
  height = 160,
  min,
  max,
  drift = 0,
  volatility = 0.2,
  points = 78,
  thresholds,
  unit = "",
  actions,
  mockOverride,
  brush = false,
  component,
}: IndicatorCardProps) {
  // Spec-derived defaults (props still override).
  const resolvedTitle = title ?? component?.title ?? "";
  const resolvedMin = min ?? component?.scale?.min ?? 0;
  const resolvedMax = max ?? component?.scale?.max ?? 100;
  const resolvedThresholds = thresholds ?? component?.thresholds;

  const data = useMemo(
    () =>
      mockSeries({
        seed,
        min: resolvedMin,
        max: resolvedMax,
        drift,
        volatility,
        points,
        ...mockOverride,
      }),
    [seed, resolvedMin, resolvedMax, drift, volatility, points, mockOverride],
  );
  const v = lastValue(data);

  const stroke = "hsl(var(--chart-accent))";
  const strokeSoft = "hsl(var(--chart-accent-2))";
  const grid = "hsl(var(--chart-grid))";
  const axis = "hsl(var(--chart-axis))";
  const tooltipStyle = {
    fontSize: 10,
    padding: "6px 8px",
    background: "hsl(var(--chart-surface))",
    border: "1px solid hsl(var(--chart-grid))",
    borderRadius: 2,
    color: "hsl(var(--chart-surface-foreground))",
    boxShadow: "0 1px 2px hsl(217 33% 15% / 0.06)",
  };
  const cursorStyle = { stroke: "hsl(var(--chart-axis))", strokeWidth: 1, strokeDasharray: "2 3" };

  return (
    <div className="hud-panel flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground truncate">
            {resolvedTitle}
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
          <AskCopilotButton
            title={resolvedTitle}
            subtitle={subtitle}
            seed={seed}
            value={v}
            min={resolvedMin}
            max={resolvedMax}
            unit={unit}
            thresholds={resolvedThresholds}
            recent={data.slice(-12)}
          />
          {actions}
          {component && <ConstructionPopover spec={component} />}
        </div>
      </div>
      <div className="p-1 hud-chart rounded-none" style={{ height: brush ? height + 28 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "bar" ? (
            <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[resolvedMin, resolvedMax]} hide />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--chart-grid) / 0.5)" }}
                labelFormatter={(l) => l as string}
                formatter={(val: number) => [val.toFixed(2) + unit, resolvedTitle]}
              />
              <Bar dataKey="v" fill={stroke} />
              {resolvedThresholds?.hi != null && (
                <ReferenceLine y={resolvedThresholds.hi} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {resolvedThresholds?.lo != null && (
                <ReferenceLine y={resolvedThresholds.lo} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {brush && (
                <Brush dataKey="t" height={20} stroke="hsl(var(--chart-accent))" fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
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
              <YAxis domain={[resolvedMin, resolvedMax]} hide />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={cursorStyle}
                formatter={(val: number) => [val.toFixed(2) + unit, resolvedTitle]}
              />
              <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} fill={`url(#g${seed})`} />
              {resolvedThresholds?.hi != null && (
                <ReferenceLine y={resolvedThresholds.hi} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {resolvedThresholds?.lo != null && (
                <ReferenceLine y={resolvedThresholds.lo} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {brush && (
                <Brush dataKey="t" height={20} stroke="hsl(var(--chart-accent))" fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
              )}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <YAxis domain={[resolvedMin, resolvedMax]} hide />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={cursorStyle}
                formatter={(val: number) => [val.toFixed(2) + unit, resolvedTitle]}
              />
              <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} dot={false} />
              {resolvedThresholds?.hi != null && (
                <ReferenceLine y={resolvedThresholds.hi} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {resolvedThresholds?.lo != null && (
                <ReferenceLine y={resolvedThresholds.lo} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {brush && (
                <Brush dataKey="t" height={20} stroke="hsl(var(--chart-accent))" fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
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

function AskCopilotButton(props: {
  title: string; subtitle?: string; seed: number; value: number;
  min?: number; max?: number; unit?: string;
  thresholds?: { hi?: number; lo?: number };
  recent?: Array<{ t: string; v: number }>;
}) {
  const { openCopilot } = useCopilot();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openCopilot({
          context: {
            title: props.title,
            subtitle: props.subtitle,
            seed: props.seed,
            value: props.value,
            min: props.min,
            max: props.max,
            unit: props.unit,
            thresholdHi: props.thresholds?.hi,
            thresholdLo: props.thresholds?.lo,
            recent: props.recent,
          },
          prompt: `What is ${props.title} telling me right now and what's the historical setup?`,
        });
      }}
      title="Ask Copilot about this chart"
      className="h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
    </button>
  );
}
