import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { useSectorData, type SectorRollup } from "@/hooks/useSectorData";
import { useSectorHistory } from "@/hooks/useSectorHistory";
import { SECTORS } from "@/lib/mockData";
import type { Sector } from "@/lib/mockData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  LineChart, Line, ReferenceArea,
} from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const fmtInt = new Intl.NumberFormat("en-US");

type HistMetric = "avgNetSpecPct3y" | "avgNetSpecPct6m" | "netContracts" | "crowdedLong" | "crowdedShort";
const HIST_METRICS: { k: HistMetric; l: string; pct: boolean }[] = [
  { k: "avgNetSpecPct3y", l: "Avg Net Spec %ile 3Y", pct: true },
  { k: "avgNetSpecPct6m", l: "Avg Net Spec %ile 6M", pct: true },
  { k: "netContracts", l: "Sum Net Contracts", pct: false },
  { k: "crowdedLong", l: "# Crowded Long (≥85)", pct: false },
  { k: "crowdedShort", l: "# Crowded Short (≤15)", pct: false },
];
type HistTF = "2y" | "5y" | "10y" | "all";
const HIST_WEEKS: Record<HistTF, number | null> = { "2y": 104, "5y": 260, "10y": 520, all: null };


function pctColor(p: number): string {
  if (p >= 85) return "hsl(var(--pos-long))";
  if (p >= 65) return "hsl(var(--pos-long) / 0.65)";
  if (p >= 35) return "hsl(var(--chart-ink-muted))";
  if (p >= 15) return "hsl(var(--pos-short) / 0.65)";
  return "hsl(var(--pos-short))";
}

// Continuous heatmap background: cream (neutral 50) → stronger red/green at extremes
function heatBg(p: number): string {
  const v = Math.max(0, Math.min(100, p));
  const intensity = Math.min(1, Math.abs(v - 50) / 50);
  const weight = 10 + intensity * 80; // 10%..90%
  const target = v >= 50 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))";
  return `color-mix(in oklab, hsl(var(--chart-surface)) ${(100 - weight).toFixed(1)}%, ${target} ${weight.toFixed(1)}%)`;
}

type MetricKey = "avgNetSpecPct3y" | "avgNetSpecPct6m" | "netContracts" | "wowChange";

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "avgNetSpecPct3y", label: "Net Spec %ile 3Y" },
  { key: "avgNetSpecPct6m", label: "Net Spec %ile 6M" },
  { key: "netContracts", label: "Net" },
  { key: "wowChange", label: "Δ WoW" },
];

const SectorAggregates = () => {
  const { rollups, isLoading, error, reportDate } = useSectorData();
  const [metric, setMetric] = useState<MetricKey>("avgNetSpecPct3y");
  const [heatWindow, setHeatWindow] = useState<"netSpecPct3y" | "netSpecPct6m">("netSpecPct3y");
  const [histSector, setHistSector] = useState<Sector>("Equities");
  const [histMetric, setHistMetric] = useState<HistMetric>("avgNetSpecPct3y");
  const [histTF, setHistTF] = useState<HistTF>("5y");
  const { data: history, isLoading: histLoading } = useSectorHistory(histSector);
  const histMeta = HIST_METRICS.find(m => m.k === histMetric)!;
  const histData = useMemo(() => {
    const h = history ?? [];
    const w = HIST_WEEKS[histTF];
    return w == null ? h : h.slice(-w);
  }, [history, histTF]);

  const isPctMetric = metric === "avgNetSpecPct3y" || metric === "avgNetSpecPct6m";

  const chartData = useMemo(
    () => rollups.map(r => ({ sector: r.sector, value: r[metric] as number })),
    [rollups, metric]
  );

  const totals = useMemo(() => {
    return rollups.reduce(
      (a, r) => ({
        markets: a.markets + r.count,
        long: a.long + r.crowdedLong,
        short: a.short + r.crowdedShort,
        net: a.net + r.netContracts,
      }),
      { markets: 0, long: 0, short: 0, net: 0 }
    );
  }, [rollups]);

  return (
    <AppShell title="Sector Aggregates">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border bg-surface/30">
        <Stat label="Sectors" value={rollups.length.toString()} />
        <Stat label="Markets" value={totals.markets.toString()} />
        <Stat label="Crowded Long" value={totals.long.toString()} accent="long" />
        <Stat label="Crowded Short" value={totals.short.toString()} accent="short" />
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          Failed to load: {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border p-px">
        {/* Comparison bar chart — white surface */}
        <div className="hud-chart lg:col-span-2 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
              Sector Comparison · Net Speculators (Large + Small)
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {METRIC_OPTIONS.map(o => (
                <button
                  key={o.key}
                  onClick={() => setMetric(o.key)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    metric === o.key
                      ? "border-chart-ink bg-chart-ink text-chart-surface"
                      : "border-chart-grid text-chart-axis hover:text-chart-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="sector"
                  tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  tickLine={false}
                  width={60}
                  domain={isPctMetric ? [0, 100] : ["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--chart-surface))",
                    border: "1px solid hsl(var(--chart-grid))",
                    fontSize: 11,
                    borderRadius: 2,
                    color: "hsl(var(--chart-surface-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--chart-surface-foreground))" }}
                  formatter={(v: number) => (isPctMetric ? `${v}` : fmtInt.format(v))}
                />
                {!isPctMetric && <ReferenceLine y={0} stroke="hsl(var(--chart-grid))" />}
                {isPctMetric && (
                  <>
                    <ReferenceLine y={85} stroke="hsl(var(--pos-long))" strokeDasharray="2 3" strokeOpacity={0.55} />
                    <ReferenceLine y={15} stroke="hsl(var(--pos-short))" strokeDasharray="2 3" strokeOpacity={0.55} />
                  </>
                )}
                <Bar dataKey="value">
                  {chartData.map((d, i) => {
                    // Match the Spec 6M / 3Y %ile line-chart palette:
                    // ≥85 crowded long  → #a8391f (brick)
                    // ≤15 crowded short → #5e7536 (olive)
                    let fill: string;
                    if (isPctMetric) {
                      const v = d.value;
                      if (v >= 85) fill = "#a8391f";
                      else if (v >= 65) fill = "#a8391f";
                      else if (v > 35) fill = "hsl(var(--chart-ink-muted))";
                      else if (v > 15) fill = "#5e7536";
                      else fill = "#5e7536";
                      // Soften the mid-extreme bands so the true extremes pop
                      if (v < 85 && v >= 65) fill = "color-mix(in oklab, #a8391f 65%, hsl(var(--chart-surface)) 35%)";
                      if (v > 15 && v <= 35) fill = "color-mix(in oklab, #5e7536 65%, hsl(var(--chart-surface)) 35%)";
                    } else {
                      fill = d.value >= 0 ? "#a8391f" : "#5e7536";
                    }
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector summary list — white surface table */}
        <div className="hud-chart p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium mb-2" style={{ color: "hsl(var(--chart-axis))" }}>
            Sector Summary
          </div>
          <div className="flex flex-col divide-y divide-chart-grid">
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-chart-grid/40" />
                ))
              : rollups.map(r => <SectorSummaryRow key={r.sector} r={r} />)}
          </div>
        </div>
      </div>

      {/* Historical sector positioning */}
      <div className="hud-chart m-px p-3">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
            Historical Sector Positioning · {histSector} · {histMeta.l}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {SECTORS.map(s => (
                <button
                  key={s}
                  onClick={() => setHistSector(s)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    histSector === s
                      ? "border-chart-ink bg-chart-ink text-chart-surface"
                      : "border-chart-grid text-chart-axis hover:text-chart-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {HIST_METRICS.map(o => (
                <button
                  key={o.k}
                  onClick={() => setHistMetric(o.k)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    histMetric === o.k
                      ? "border-chart-ink bg-chart-ink text-chart-surface"
                      : "border-chart-grid text-chart-axis hover:text-chart-ink"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(["2y", "5y", "10y", "all"] as HistTF[]).map(tf => (
                <button
                  key={tf}
                  onClick={() => setHistTF(tf)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    histTF === tf
                      ? "border-chart-ink bg-chart-ink text-chart-surface"
                      : "border-chart-grid text-chart-axis hover:text-chart-ink"
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-80">
          {histLoading ? (
            <div className="h-full animate-pulse bg-chart-grid/30 rounded-sm" />
          ) : histData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No historical data for this sector.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={histData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--chart-grid))" }} minTickGap={40} />
                <YAxis
                  orientation="right"
                  tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  width={60}
                  domain={histMeta.pct ? [0, 100] : ["auto", "auto"]}
                  ticks={histMeta.pct ? [0, 15, 50, 85, 100] : undefined}
                  tickFormatter={(v: number) => histMeta.pct ? `${v}` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--chart-surface))",
                    border: "1px solid hsl(var(--chart-grid))",
                    fontSize: 11,
                    borderRadius: 2,
                    color: "hsl(var(--chart-surface-foreground))",
                  }}
                  formatter={(v: number) => histMeta.pct ? `${v}` : fmtInt.format(v)}
                />
                {histMeta.pct ? (
                  <>
                    <ReferenceArea y1={85} y2={100} fill="#a8391f" fillOpacity={0.08} />
                    <ReferenceArea y1={0} y2={15} fill="#5e7536" fillOpacity={0.08} />
                    <ReferenceLine y={85} stroke="#a8391f" strokeDasharray="2 3" strokeOpacity={0.55} />
                    <ReferenceLine y={15} stroke="#5e7536" strokeDasharray="2 3" strokeOpacity={0.55} />
                  </>
                ) : (
                  <ReferenceLine y={0} stroke="hsl(var(--chart-grid))" />
                )}
                <Line
                  type="monotone"
                  dataKey={histMetric}
                  stroke="hsl(var(--chart-ink))"
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-2 text-[10px] font-mono" style={{ color: "hsl(var(--chart-ink-muted))" }}>
          {histData.length ? `${histData.length} weekly observations · ${histData[0].date} → ${histData[histData.length - 1].date}` : ""}
        </div>
      </div>

      {/* Heatmap on white surface */}
      <div className="hud-chart m-px p-3">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
            Positioning Heatmap · Net Speculators
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {[
                { k: "netSpecPct3y", l: "3Y" },
                { k: "netSpecPct6m", l: "6M" },
              ].map(o => (
                <button
                  key={o.k}
                  onClick={() => setHeatWindow(o.k as any)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    heatWindow === o.k
                      ? "border-chart-ink bg-chart-ink text-chart-surface"
                      : "border-chart-grid text-chart-axis hover:text-chart-ink"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: "hsl(var(--chart-axis))" }}>
              <Legend swatch="hsl(var(--pos-short))" label="≤15 Short" />
              <Legend swatch="hsl(var(--chart-ink-muted))" label="Neutral" />
              <Legend swatch="hsl(var(--pos-long))" label="≥85 Long" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-chart-grid/40 rounded-sm" />
              ))
            : rollups.map(r => <SectorHeatmapRow key={r.sector} r={r} windowKey={heatWindow} />)}
        </div>
      </div>

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        Report {reportDate ?? "—"} · Default metric: Net Speculators (Large + Small) percentile.
      </div>
    </AppShell>
  );
};

function SectorSummaryRow({ r }: { r: SectorRollup }) {
  const up = r.avgWeekChangePct >= 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold" style={{ color: "hsl(var(--chart-surface-foreground))" }}>{r.sector}</div>
        <div className="text-[10px]" style={{ color: "hsl(var(--chart-axis))" }}>{r.count} markets</div>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(var(--chart-axis))" }}>3Y</div>
        <div className="font-mono text-xs tabular-nums" style={{ color: pctColor(r.avgNetSpecPct3y) }}>
          {r.avgNetSpecPct3y}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(var(--chart-axis))" }}>6M</div>
        <div className="font-mono text-xs tabular-nums" style={{ color: pctColor(r.avgNetSpecPct6m) }}>
          {r.avgNetSpecPct6m}
        </div>
      </div>
      <div
        className="flex items-center gap-0.5 text-[10px] font-mono tabular-nums"
        style={{ color: up ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
      >
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {up ? "+" : ""}{r.avgWeekChangePct.toFixed(2)}%
      </div>
    </div>
  );
}

function SectorHeatmapRow({ r, windowKey }: { r: SectorRollup; windowKey: "netSpecPct3y" | "netSpecPct6m" }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
      <div>
        <div className="text-xs font-semibold" style={{ color: "hsl(var(--chart-surface-foreground))" }}>{r.sector}</div>
        <div className="text-[10px] font-mono tabular-nums" style={{ color: "hsl(var(--chart-axis))" }}>
          Net {r.netContracts >= 0 ? "+" : ""}{fmtInt.format(r.netContracts)}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-1">
        {[...r.markets]
          .sort((a, b) => (b[windowKey] as number) - (a[windowKey] as number))
          .map(m => {
            const v = m[windowKey] as number;
            const bg = heatBg(v);
            const fg = v >= 70 || v <= 30 ? "#f5f0e6" : "hsl(var(--chart-surface-foreground))";
            return (
              <Link
                key={m.symbol}
                to={`/asset/${m.symbol}`}
                className="group relative rounded-sm px-1.5 py-1 text-center transition-colors"
                style={{
                  background: bg,
                  border: "1px solid hsl(var(--chart-grid))",
                }}
                title={`${m.name} · Net Spec ${windowKey === "netSpecPct3y" ? "3Y" : "6M"} ${v}`}
              >
                <div className="font-mono text-[10px] font-semibold" style={{ color: fg }}>
                  {m.symbol}
                </div>
                <div className="font-mono text-[10px] tabular-nums" style={{ color: fg }}>
                  {v}
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "long" | "short" }) {
  const color =
    accent === "long" ? "text-pos-long" : accent === "short" ? "text-pos-short" : "text-surface-foreground";
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch, border: "1px solid hsl(var(--chart-grid))" }} />
      <span>{label}</span>
    </div>
  );
}

export default SectorAggregates;
