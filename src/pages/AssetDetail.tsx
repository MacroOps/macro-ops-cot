import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, Newspaper } from "lucide-react";
import { AppShell } from "@/components/hud/AppShell";
import { PercentileGauge } from "@/components/hud/PercentileGauge";
import { computeForwardPerformance, useAssetData } from "@/hooks/useAssetData";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat("en-US");

function StatBlock({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "long" | "short" | "primary" }) {
  const toneCls =
    tone === "long" ? "text-pos-long"
    : tone === "short" ? "text-pos-short"
    : tone === "primary" ? "text-primary"
    : "text-surface-foreground";
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 border-r border-border last:border-r-0 min-w-[120px]">
      <span className="hud-label">{label}</span>
      <span className={`font-mono text-sm tabular-nums font-semibold ${toneCls}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground font-mono">{sub}</span>}
    </div>
  );
}

function ChartPanel({ title, sub, children, height = 200 }: { title: string; sub?: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="hud-panel flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex flex-col">
          <span className="hud-label">{title}</span>
          {sub && <span className="text-[10px] text-muted-foreground font-mono">{sub}</span>}
        </div>
      </div>
      <div className="p-1.5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AssetDetail() {
  const { symbol = "ES" } = useParams();
  const { data, isLoading, error } = useAssetData(symbol);

  const last = data?.series.at(-1);
  const prev = data?.series.at(-2);
  const wkChg = last && prev ? ((last.price - prev.price) / prev.price) * 100 : 0;
  const netWoW = last && prev ? last.netLevFunds - prev.netLevFunds : 0;

  const forward = useMemo(() => (data ? computeForwardPerformance(data.series) : []), [data]);

  // Slice last 78 weeks (~18m) for charts
  const chartData = useMemo(() => (data ? data.series.slice(-78) : []), [data]);

  const tickColor = "hsl(var(--muted-foreground))";
  const gridColor = "hsl(var(--border))";

  return (
    <AppShell title={`Asset · ${symbol}`}>
      <div className="px-4 py-3 space-y-3">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="text-muted-foreground hover:text-surface-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-mono text-lg font-semibold text-surface-foreground">{symbol}</span>
            <span className="hud-label">{data?.sector ?? "—"}</span>
            <span className="text-xs text-muted-foreground truncate">{data?.name}</span>
            {data?.exchange && (
              <span className="hud-label border border-border px-1.5 py-0.5 rounded-sm">{data.exchange}</span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            CFTC report · {data?.lastReportDate ?? "—"}
          </div>
        </div>

        {/* Stats strip */}
        <div className="hud-panel flex flex-wrap">
          <StatBlock label="Last Price" value={last ? fmt.format(last.price) : "—"} sub={wkChg >= 0 ? `+${wkChg.toFixed(2)}% w/w` : `${wkChg.toFixed(2)}% w/w`} tone={wkChg >= 0 ? "long" : "short"} />
          <StatBlock label="Lev Fund Net" value={last ? fmtInt.format(last.netLevFunds) : "—"} sub={`Δ ${netWoW >= 0 ? "+" : ""}${fmtInt.format(netWoW)}`} tone={last && last.netLevFunds >= 0 ? "long" : "short"} />
          <StatBlock label="Large Spec Net" value={last ? fmtInt.format(last.netLargeSpec) : "—"} tone={last && last.netLargeSpec >= 0 ? "long" : "short"} />
          <StatBlock label="Lev Fund %ile" value={last ? `${last.levFundPct}` : "—"} sub="3y rolling" tone={last && (last.levFundPct >= 85 || last.levFundPct <= 15) ? "primary" : "default"} />
          <StatBlock label="Open Interest" value={last ? fmtInt.format(last.openInterest) : "—"} />
        </div>

        {/* Main grid: charts (2/3) + news (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            {/* Price + Net positioning composite */}
            <ChartPanel title="Price · Lev Fund Net (78w)" sub="Net contracts overlay reveals positioning vs price divergence" height={260}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={50} domain={["auto", "auto"]} />
                <YAxis yAxisId="net" orientation="left" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={56} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }}
                  labelStyle={{ color: "hsl(var(--surface-foreground))", fontFamily: "monospace" }}
                />
                <ReferenceLine yAxisId="net" y={0} stroke={gridColor} />
                <Bar yAxisId="net" dataKey="netLevFunds" name="Lev Fund Net" barSize={3}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.netLevFunds >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))"} fillOpacity={0.55} />
                  ))}
                </Bar>
                <Line yAxisId="price" type="monotone" dataKey="price" name="Price" stroke="hsl(var(--surface-foreground))" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ChartPanel>

            {/* Percentile chart */}
            <ChartPanel title="Positioning Percentile (3y rolling)" sub="Extremes ≥85 long-crowded · ≤15 short-crowded" height={180}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pctFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                <YAxis tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} domain={[0, 100]} width={28} ticks={[0, 15, 50, 85, 100]} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }}
                />
                <ReferenceArea y1={85} y2={100} fill="hsl(var(--pos-long))" fillOpacity={0.08} />
                <ReferenceArea y1={0} y2={15} fill="hsl(var(--pos-short))" fillOpacity={0.08} />
                <ReferenceLine y={85} stroke="hsl(var(--pos-long))" strokeDasharray="2 3" />
                <ReferenceLine y={15} stroke="hsl(var(--pos-short))" strokeDasharray="2 3" />
                <Area type="monotone" dataKey="levFundPct" name="Lev Fund %" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#pctFill)" />
                <Line type="monotone" dataKey="largeSpecPct" name="Large Spec %" stroke="hsl(var(--accent))" strokeWidth={1} dot={false} />
              </AreaChart>
            </ChartPanel>

            {/* Open Interest */}
            <ChartPanel title="Open Interest" height={140}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                <YAxis tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Bar dataKey="openInterest" fill="hsl(var(--muted-foreground))" fillOpacity={0.55} />
              </BarChart>
            </ChartPanel>

            {/* Forward performance backtest */}
            <div className="hud-panel">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex flex-col">
                  <span className="hud-label">Forward Performance · Conditional on current %ile bucket</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Bucket: {Math.max(0, (last?.levFundPct ?? 0) - 10)}–{Math.min(100, (last?.levFundPct ?? 0) + 10)} · 3y window
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
                {forward.map(f => {
                  const pos = f.mean >= 0;
                  return (
                    <div key={f.horizon} className="p-3 flex flex-col gap-1">
                      <span className="hud-label">{f.horizon}w forward</span>
                      <div className={`flex items-center gap-1 font-mono text-base font-semibold tabular-nums ${pos ? "text-pos-long" : "text-pos-short"}`}>
                        {pos ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {pos ? "+" : ""}{f.mean.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Hit {f.hitRate.toFixed(0)}% · n={f.count}
                      </div>
                    </div>
                  );
                })}
                {!forward.length && (
                  <div className="p-3 text-xs text-muted-foreground col-span-4">Insufficient history.</div>
                )}
              </div>
            </div>
          </div>

          {/* News & Divergence sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <div className="hud-panel">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hud-label">News · Divergence Feed</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {data?.news.filter(n => n.is_divergence).length ?? 0} flagged
                </span>
              </div>
              <div className="divide-y divide-border max-h-[640px] overflow-auto">
                {(data?.news ?? []).length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">No recent events.</div>
                )}
                {data?.news.map(n => {
                  const dir = n.expected_direction ?? 0;
                  const obs = n.observed_return_1d ?? 0;
                  return (
                    <div key={n.id} className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-surface-foreground leading-snug">{n.headline}</div>
                        {n.is_divergence && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-primary border border-primary/40 px-1 py-0.5 rounded-sm">
                            <AlertTriangle className="h-2.5 w-2.5" /> Failure
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>{n.source ?? "—"} · {new Date(n.published_at).toISOString().slice(0, 10)}</span>
                        {n.url && (
                          <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex items-center gap-0.5">
                            link <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="text-muted-foreground">
                          Expected: <span className={dir > 0 ? "text-pos-long" : dir < 0 ? "text-pos-short" : ""}>{dir > 0 ? "▲" : dir < 0 ? "▼" : "·"}</span>
                        </span>
                        <span className="text-muted-foreground">
                          1D: <span className={obs >= 0 ? "text-pos-long" : "text-pos-short"}>{obs >= 0 ? "+" : ""}{obs.toFixed(2)}%</span>
                        </span>
                      </div>
                      {n.divergence_note && (
                        <div className="text-[10px] text-muted-foreground italic leading-snug">{n.divergence_note}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current percentile gauges */}
            <div className="hud-panel p-3 space-y-2.5">
              <span className="hud-label">Current Positioning</span>
              {last && (
                <>
                  <PercentileGauge value={last.levFundPct} label="Lev Funds (Disagg)" />
                  <PercentileGauge value={last.largeSpecPct} label="Large Specs (Legacy)" />
                </>
              )}
            </div>
          </div>
        </div>

        {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {error && <div className="text-xs text-destructive">Failed to load asset data.</div>}
        {!isLoading && !data && <div className="text-xs text-muted-foreground">Asset not found.</div>}
      </div>
    </AppShell>
  );
}
