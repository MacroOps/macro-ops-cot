import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { ComponentSpec } from "@/lib/indicatorSpecs";
import { ConstructionPopover } from "@/components/hud/ConstructionPopover";
import { useBreadthSeries, type BreadthField } from "@/hooks/tp/useBreadthSeries";
import type { TpBreadthRow } from "@/lib/tp/types";
import { Loader2 } from "lucide-react";

interface LiveBreadthCardProps {
  component?: ComponentSpec;
  title?: string;
  subtitle?: string;
  field: BreadthField;
  /** Optional derive function: e.g. NH - NL */
  transform?: (row: TpBreadthRow) => number | null;
  height?: number;
  min?: number;
  max?: number;
  thresholds?: { hi?: number; lo?: number };
  unit?: string;
  /** Days of history to load */
  rangeDays?: number;
  /** Show SPX (sector close) overlay in background */
  showOverlay?: boolean;
}

export function LiveBreadthCard({
  component,
  title,
  subtitle,
  field,
  transform,
  height = 160,
  min,
  max,
  thresholds,
  unit = "",
  rangeDays = 365,
  showOverlay = true,
}: LiveBreadthCardProps) {
  const { data, isLoading, error, sector } = useBreadthSeries(field, { rangeDays, transform });
  const [hoverT, setHoverT] = useState<string | null>(null);

  const resolvedTitle = title ?? component?.title ?? String(field);
  const resolvedMin = min ?? component?.scale?.min ?? 0;
  const resolvedMax = max ?? component?.scale?.max ?? 100;
  const resolvedThresholds = thresholds ?? component?.thresholds;

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const hoverPoint = hoverT ? data.find((d) => d.t === hoverT) ?? null : null;
  const headerVal = hoverPoint?.v ?? last?.v ?? 0;
  const wow = useMemo(() => (last && prev ? last.v - prev.v : 0), [last, prev]);
  const wowTone = wow > 0 ? "text-success" : wow < 0 ? "text-destructive" : "text-muted-foreground";

  const yPad = (resolvedMax - resolvedMin) * 0.08;
  const yDomain: [number, number] = [resolvedMin - yPad, resolvedMax + yPad];

  return (
    <div className="hud-panel flex flex-col relative">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground truncate flex items-center gap-1.5">
            {resolvedTitle}
            <span className="text-[9px] font-mono px-1 py-0 rounded-sm bg-success/15 text-success border border-success/30">
              LIVE · {sector}
            </span>
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
            {hoverPoint ? `@ ${hoverPoint.t}` : subtitle}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-mono tabular-nums text-xs ${hoverPoint ? "text-primary" : "text-surface-foreground"}`}>
              {headerVal.toFixed(2)}{unit}
            </span>
            {!hoverPoint && (
              <span className={`font-mono tabular-nums text-[9px] ${wowTone}`}>
                {wow > 0 ? "▲" : wow < 0 ? "▼" : "·"}{Math.abs(wow).toFixed(2)}
              </span>
            )}
          </div>
          {component && <ConstructionPopover spec={component} />}
        </div>
      </div>
      <div style={{ height }} className="p-1">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-[10px] text-destructive px-2 text-center">
            {(error as Error).message}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
              onMouseMove={(s) => {
                const t = (s as { activeLabel?: string | number } | null)?.activeLabel;
                if (typeof t === "string") setHoverT(t);
              }}
              onMouseLeave={() => setHoverT(null)}
            >
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" strokeOpacity={0.3} vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis yAxisId="left" domain={yDomain} hide />
              <YAxis yAxisId="right" orientation="right" domain={["dataMin", "dataMax"]} hide />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload as { v: number; spx: number } | undefined;
                  if (!p) return null;
                  return (
                    <div className="bg-popover border border-border rounded-sm px-2 py-1.5 text-[10px] font-mono space-y-0.5 shadow-lg">
                      <div className="text-muted-foreground">{String(label)}</div>
                      <div><span className="text-muted-foreground">val </span><span className="text-surface-foreground">{p.v.toFixed(2)}{unit}</span></div>
                      <div><span className="text-muted-foreground">{sector} </span><span className="text-surface-foreground">{p.spx.toFixed(2)}</span></div>
                    </div>
                  );
                }}
                cursor={{ stroke: "hsl(var(--chart-halo))", strokeDasharray: "2 3", strokeOpacity: 0.6 }}
              />

              {showOverlay && (
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="spx"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.06}
                  isAnimationActive={false}
                />
              )}

              {resolvedThresholds?.hi != null && (
                <ReferenceLine yAxisId="left" y={resolvedThresholds.hi} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}
              {resolvedThresholds?.lo != null && (
                <ReferenceLine yAxisId="left" y={resolvedThresholds.lo} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
              )}

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="v"
                stroke="hsl(var(--chart-accent))"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
