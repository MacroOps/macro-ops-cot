import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { useSectorData, type SectorRollup } from "@/hooks/useSectorData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const fmtInt = new Intl.NumberFormat("en-US");

function pctColor(p: number): string {
  // 0 → short (red), 50 → neutral, 100 → long (green)
  if (p >= 85) return "hsl(var(--pos-long))";
  if (p >= 65) return "hsl(var(--success) / 0.6)";
  if (p >= 35) return "hsl(var(--muted-foreground) / 0.5)";
  if (p >= 15) return "hsl(var(--destructive) / 0.6)";
  return "hsl(var(--pos-short))";
}

const SectorAggregates = () => {
  const { rollups, isLoading, error, reportDate } = useSectorData();
  const [metric, setMetric] = useState<"avgLevPct" | "avgSpecPct" | "netContracts" | "wowChange">("avgLevPct");

  const chartData = useMemo(
    () => rollups.map(r => ({ sector: r.sector, value: r[metric] as number })),
    [rollups, metric]
  );

  const totals = useMemo(() => {
    const t = rollups.reduce(
      (a, r) => ({
        markets: a.markets + r.count,
        long: a.long + r.crowdedLong,
        short: a.short + r.crowdedShort,
        net: a.net + r.netContracts,
      }),
      { markets: 0, long: 0, short: 0, net: 0 }
    );
    return t;
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
        {/* Comparison bar chart */}
        <div className="hud-panel p-3 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="hud-label">Sector Comparison</div>
            <div className="flex items-center gap-1">
              {([
                ["avgLevPct", "Lev Pct"],
                ["avgSpecPct", "Spec Pct"],
                ["netContracts", "Net"],
                ["wowChange", "Δ WoW"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMetric(k)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                    metric === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-surface-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="sector" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11, borderRadius: 2 }}
                  labelStyle={{ color: "hsl(var(--surface-foreground))" }}
                  formatter={(v: number) =>
                    metric.includes("Pct") || metric === "avgLevPct" || metric === "avgSpecPct"
                      ? `${v}`
                      : fmtInt.format(v)
                  }
                />
                {(metric === "netContracts" || metric === "wowChange") && (
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                )}
                <Bar dataKey="value">
                  {chartData.map((d, i) => {
                    let fill = "hsl(var(--primary))";
                    if (metric === "avgLevPct" || metric === "avgSpecPct") fill = pctColor(d.value);
                    else fill = d.value >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))";
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector summary list */}
        <div className="hud-panel p-3">
          <div className="hud-label mb-2">Sector Summary</div>
          <div className="flex flex-col divide-y divide-border">
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted/40" />
                ))
              : rollups.map(r => (
                  <SectorSummaryRow key={r.sector} r={r} />
                ))}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="hud-panel m-px p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="hud-label">Positioning Heatmap · Leveraged Funds Percentile</div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <Legend swatch="hsl(var(--pos-short))" label="≤15 Short" />
            <Legend swatch="hsl(var(--muted-foreground) / 0.5)" label="Neutral" />
            <Legend swatch="hsl(var(--pos-long))" label="≥85 Long" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted/40 rounded-sm" />
              ))
            : rollups.map(r => (
                <SectorHeatmapRow key={r.sector} r={r} />
              ))}
        </div>
      </div>

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        Report {reportDate ?? "—"} · Sector aggregates derived from latest disaggregated COT.
      </div>
    </AppShell>
  );
};

function SectorSummaryRow({ r }: { r: SectorRollup }) {
  const up = r.avgWeekChangePct >= 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-surface-foreground">{r.sector}</div>
        <div className="text-[10px] text-muted-foreground">{r.count} markets</div>
      </div>
      <div className="text-right">
        <div className="hud-label">Avg Lev</div>
        <div
          className="font-mono text-xs tabular-nums"
          style={{ color: pctColor(r.avgLevPct) }}
        >
          {r.avgLevPct}
        </div>
      </div>
      <div className={`flex items-center gap-0.5 text-[10px] font-mono tabular-nums ${up ? "text-success" : "text-destructive"}`}>
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {up ? "+" : ""}{r.avgWeekChangePct.toFixed(2)}%
      </div>
    </div>
  );
}

function SectorHeatmapRow({ r }: { r: SectorRollup }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
      <div>
        <div className="text-xs font-semibold text-surface-foreground">{r.sector}</div>
        <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
          Net {r.netContracts >= 0 ? "+" : ""}{fmtInt.format(r.netContracts)}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-1">
        {r.markets.map(m => (
          <Link
            key={m.symbol}
            to={`/asset/${m.symbol}`}
            className="group relative border border-border rounded-sm px-1.5 py-1 text-center hover:border-primary transition-colors"
            style={{ background: pctColor(m.leveragedFundPercentile) + "33" }}
            title={`${m.name} · Lev Pct ${m.leveragedFundPercentile}`}
          >
            <div className="font-mono text-[10px] font-semibold text-surface-foreground">{m.symbol}</div>
            <div
              className="font-mono text-[10px] tabular-nums"
              style={{ color: pctColor(m.leveragedFundPercentile) }}
            >
              {m.leveragedFundPercentile}
            </div>
          </Link>
        ))}
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
      <div className="h-2.5 w-2.5 rounded-sm border border-border" style={{ background: swatch }} />
      <span>{label}</span>
    </div>
  );
}

export default SectorAggregates;
