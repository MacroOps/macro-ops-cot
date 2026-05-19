import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
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
import { AlertTriangle, ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, Newspaper, PanelRightClose, PanelRightOpen, Maximize2 } from "lucide-react";
import { AppShell } from "@/components/hud/AppShell";
import { PercentileGauge } from "@/components/hud/PercentileGauge";
import { computeForwardPerformance, useAssetData, type AssetSeriesPoint } from "@/hooks/useAssetData";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat("en-US");

type WindowKey = "netSpecPct3y" | "netSpecPct6m";

// Positioning chart metric options
type MetricKey =
  | "netSpec"
  | "netSpecPct6m"
  | "netSpecPct3y"
  | "levFundPct6m"
  | "levFundPct"
  | "assetMgrPct6m"
  | "assetMgrPct";

type TimeframeKey = "2y" | "10y" | "all";
const TF_WEEKS: Record<TimeframeKey, number | null> = { "2y": 104, "10y": 520, all: null };

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

function ChartPanel({
  title,
  sub,
  right,
  children,
  height = 200,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="hud-chart flex flex-col">
      <div className="hud-chart-header flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
            {title}
          </span>
          {sub && <span className="text-[10px] font-mono" style={{ color: "hsl(var(--chart-ink-muted))" }}>{sub}</span>}
        </div>
        {right}
      </div>
      <div className="p-1.5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
      </div>
    </div>
  );
}

function SegToggle({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { k: string; l: string; disabled?: boolean }[];
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map(o => (
        <button
          key={o.k}
          onClick={() => !o.disabled && onChange(o.k)}
          disabled={o.disabled}
          className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
            value === o.k
              ? "border-chart-ink bg-chart-ink text-chart-surface"
              : o.disabled
                ? "border-chart-grid text-chart-ink-muted opacity-40 cursor-not-allowed"
                : "border-chart-grid text-chart-axis hover:text-chart-ink"
          }`}
          title={o.disabled ? "Not available for this market" : undefined}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// Vertical gradient: top (bullish-extreme) deep red → middle yellow → bottom (bearish-extreme) dark green.
// Uses userSpaceOnUse so colors map to actual chart Y-pixels rather than the path's own bounding box.
// `plotTop`/`plotBottom` should match the chart's plot area in SVG coords (margin top + plot height).
const PCT_GRADIENT_ID = "pctLineGradient";
const PCT_FILL_GRADIENT_ID = "pctFillGradient";
function PctGradients({ plotTop = 8, plotBottom = 232 }: { plotTop?: number; plotBottom?: number }) {
  return (
    <defs>
      <linearGradient id={PCT_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1={plotTop} x2="0" y2={plotBottom}>
        <stop offset="0%" stopColor="#7a2818" />
        <stop offset="15%" stopColor="#a8391f" />
        <stop offset="30%" stopColor="#c0542e" />
        <stop offset="45%" stopColor="#c98a3a" />
        <stop offset="55%" stopColor="#b89048" />
        <stop offset="70%" stopColor="#8a8a3e" />
        <stop offset="85%" stopColor="#5e7536" />
        <stop offset="100%" stopColor="#3f5a2a" />
      </linearGradient>
      <linearGradient id={PCT_FILL_GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1={plotTop} x2="0" y2={plotBottom}>
        <stop offset="0%" stopColor="#a8391f" stopOpacity={0.22} />
        <stop offset="50%" stopColor="#c98a3a" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#5e7536" stopOpacity={0.22} />
      </linearGradient>
    </defs>
  );
}

const METRIC_LABEL: Record<MetricKey, string> = {
  netSpec: "Net Speculators (nominal)",
  netSpecPct6m: "Net Spec %ile · 6M",
  netSpecPct3y: "Net Spec %ile · 3Y",
  levFundPct6m: "Lev Funds %ile · 6M",
  levFundPct: "Lev Funds %ile · 3Y",
  assetMgrPct6m: "Asset Mgrs %ile · 6M",
  assetMgrPct: "Asset Mgrs %ile · 3Y",
};

function isPercentileMetric(m: MetricKey) {
  return m !== "netSpec";
}

export default function AssetDetail() {
  const { symbol = "ES" } = useParams();
  const { data, isLoading, error } = useAssetData(symbol);

  const [pctWindow, setPctWindow] = useState<WindowKey>("netSpecPct3y");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("2y");
  const [metric, setMetric] = useState<MetricKey>("netSpecPct3y");
  const [showNews, setShowNews] = useState(true);
  const [disagg, setDisagg] = useState<{ large: boolean; small: boolean; commercial: boolean }>({
    large: true, small: true, commercial: true,
  });

  const last = data?.series.at(-1);
  const prev = data?.series.at(-2);
  const wkChg = last && prev ? ((last.price - prev.price) / prev.price) * 100 : 0;
  const netWoW = last && prev ? last.netSpec - prev.netSpec : 0;

  const hasLev = !!last?.hasLev;
  const hasAssetMgr = !!last?.hasAssetMgr;

  const forward = useMemo(
    () => (data ? computeForwardPerformance(data.series, [1, 4, 12, 26], pctWindow) : []),
    [data, pctWindow]
  );

  const chartData: AssetSeriesPoint[] = useMemo(() => {
    if (!data) return [];
    const w = TF_WEEKS[timeframe];
    return w == null ? data.series : data.series.slice(-w);
  }, [data, timeframe]);

  const priceChartData = useMemo(() => {
    const ps = data?.priceSeries ?? [];
    if (!ps.length) return [];
    // Compute SMAs over the full series, then slice to the visible window.
    const sma = (period: number) => {
      const out: (number | null)[] = new Array(ps.length).fill(null);
      let sum = 0;
      for (let i = 0; i < ps.length; i++) {
        sum += ps[i].price;
        if (i >= period) sum -= ps[i - period].price;
        if (i >= period - 1) out[i] = sum / period;
      }
      return out;
    };
    const s50 = sma(50);
    const s200 = sma(200);
    const enriched = ps.map((p, i) => ({ date: p.date, price: p.price, sma50: s50[i], sma200: s200[i] }));
    const w = TF_WEEKS[timeframe];
    const days = w == null ? null : w * 5;
    return days == null ? enriched : enriched.slice(-days);
  }, [data, timeframe]);

  const tickColor = "hsl(var(--chart-axis))";
  const gridColor = "hsl(var(--chart-grid))";
  const inkColor = "hsl(var(--chart-ink))";

  const currentPct = last ? (pctWindow === "netSpecPct3y" ? last.netSpecPct3y : last.netSpecPct6m) : 0;
  const windowLabel = pctWindow === "netSpecPct3y" ? "3Y" : "6M";

  const tfOptions = [
    { k: "2y" as const, l: "2Y" },
    { k: "10y" as const, l: "10Y" },
    { k: "all" as const, l: "All" },
  ];

  const metricOptions: { k: MetricKey; l: string; disabled?: boolean }[] = [
    { k: "netSpec", l: "Net Spec" },
    { k: "netSpecPct6m", l: "Spec 6M" },
    { k: "netSpecPct3y", l: "Spec 3Y" },
    { k: "levFundPct6m", l: "Lev 6M", disabled: !hasLev },
    { k: "levFundPct", l: "Lev 3Y", disabled: !hasLev },
    { k: "assetMgrPct6m", l: "AM 6M", disabled: !hasAssetMgr },
    { k: "assetMgrPct", l: "AM 3Y", disabled: !hasAssetMgr },
  ];

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
          <div className="flex items-center gap-3 flex-wrap">
            <SegToggle value={timeframe} onChange={(v) => setTimeframe(v as TimeframeKey)} options={tfOptions} />
            <button
              onClick={() => setShowNews(s => !s)}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-surface-foreground"
              title={showNews ? "Hide news panel" : "Show news panel"}
            >
              {showNews ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
              <span className="hidden sm:inline">{showNews ? "Hide news" : "Show news"}</span>
            </button>
            {(() => {
              const d = data?.lastReportDate;
              const ageDays = d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400_000) : null;
              const tone = ageDays == null ? "text-muted-foreground"
                : ageDays <= 10 ? "text-pos-long"
                : ageDays <= 21 ? "text-amber-500"
                : "text-pos-short";
              return (
                <div className={`text-[10px] uppercase tracking-wider font-mono ${tone}`} title={d ? `CoT data last updated ${d} (${ageDays}d ago)` : "No CoT data yet"}>
                  <span className="text-muted-foreground">CoT updated · </span>
                  {d ?? "—"}
                  {ageDays != null && <span className="ml-1 opacity-70">({ageDays}d)</span>}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Stats strip */}
        <div className="hud-panel flex flex-wrap">
          <StatBlock label="Last Price" value={last ? fmt.format(last.price) : "—"} sub={wkChg >= 0 ? `+${wkChg.toFixed(2)}% w/w` : `${wkChg.toFixed(2)}% w/w`} tone={wkChg >= 0 ? "long" : "short"} />
          <StatBlock label="Net Specs" value={last ? fmtInt.format(last.netSpec) : "—"} sub={`Δ ${netWoW >= 0 ? "+" : ""}${fmtInt.format(netWoW)}`} tone={last && last.netSpec >= 0 ? "long" : "short"} />
          <StatBlock label={`Net Spec %ile ${windowLabel}`} value={last ? `${currentPct}` : "—"} sub="primary signal" tone={currentPct >= 85 || currentPct <= 15 ? "primary" : "default"} />
          <StatBlock label="Lev Fund Net" value={last && hasLev ? fmtInt.format(last.netLevFunds) : "—"} tone={last && last.netLevFunds >= 0 ? "long" : "short"} />
          {hasAssetMgr && (
            <StatBlock label="Asset Mgr Net" value={last ? fmtInt.format(last.netAssetMgr) : "—"} tone={last && last.netAssetMgr >= 0 ? "long" : "short"} />
          )}
          <StatBlock label="Open Interest" value={last ? fmtInt.format(last.openInterest) : "—"} />
        </div>

        {/* Main grid: charts (2/3) + news (1/3) */}
        <div className={`grid grid-cols-1 gap-3 ${showNews ? "lg:grid-cols-3" : ""}`}>
          <div className={showNews ? "lg:col-span-2 space-y-0" : "space-y-0"}>
            {/* Price chart (top) */}
            <ChartPanel title={`${symbol} Price`} sub="Underlying spot/futures · log scale" height={340}>
              <ComposedChart data={priceChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} syncId="assetDetail">
                <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                <YAxis orientation="right" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={56} scale="log" domain={["auto", "auto"]} allowDataOverflow tickFormatter={(v) => fmt.format(v)} />
                <Tooltip contentStyle={{ background: "hsl(var(--chart-surface))", border: `1px solid ${gridColor}`, borderRadius: 2, fontSize: 11 }} />
                <Line type="monotone" dataKey="price" name="Price" stroke={inkColor} strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="sma50" name="SMA 50" stroke="hsl(var(--primary))" strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls strokeOpacity={0.85} />
                <Line type="monotone" dataKey="sma200" name="SMA 200" stroke="hsl(var(--pos-short))" strokeWidth={1.25} dot={false} isAnimationActive={false} connectNulls strokeOpacity={0.85} />
              </ComposedChart>
            </ChartPanel>

            {/* Positioning chart with metric toggle */}
            <div className="mt-3" />
            <ChartPanel
              title={`Positioning · ${METRIC_LABEL[metric]}`}
              sub={isPercentileMetric(metric) ? "Color: green = bearish-extreme · red = bullish-extreme" : "Bars: net contracts (weekly)"}
              right={<SegToggle value={metric} onChange={(v) => setMetric(v as MetricKey)} options={metricOptions} />}
              height={360}
            >
              {isPercentileMetric(metric) ? (
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} syncId="assetDetail">
                  <defs>
                    <linearGradient id={PCT_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7a2818" />
                      <stop offset="15%" stopColor="#a8391f" />
                      <stop offset="35%" stopColor="#c0542e" />
                      <stop offset="50%" stopColor="#c98a3a" />
                      <stop offset="65%" stopColor="#8a8a3e" />
                      <stop offset="85%" stopColor="#5e7536" />
                      <stop offset="100%" stopColor="#3f5a2a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                  <YAxis tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} domain={[0, 100]} width={56} ticks={[0, 15, 50, 85, 100]} orientation="right" />
                  <Tooltip contentStyle={{ background: "hsl(var(--chart-surface))", border: `1px solid ${gridColor}`, borderRadius: 2, fontSize: 11 }} />
                  <ReferenceArea y1={85} y2={100} fill="#a8391f" fillOpacity={0.08} />
                  <ReferenceArea y1={0} y2={15} fill="#5e7536" fillOpacity={0.08} />
                  <ReferenceLine y={85} stroke="#a8391f" strokeDasharray="2 3" strokeOpacity={0.55} />
                  <ReferenceLine y={15} stroke="#5e7536" strokeDasharray="2 3" strokeOpacity={0.55} />
                  <Line type="monotone" dataKey={metric} name={METRIC_LABEL[metric]} stroke={`url(#${PCT_GRADIENT_ID})`} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} syncId="assetDetail">
                  <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                  <YAxis orientation="right" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={56} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--chart-surface))", border: `1px solid ${gridColor}`, borderRadius: 2, fontSize: 11 }} />
                  <ReferenceLine y={0} stroke={gridColor} />
                  <Bar dataKey="netSpec" name="Net Specs" barSize={timeframe === "all" ? 1 : timeframe === "10y" ? 1.5 : 3} isAnimationActive={false}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.netSpec >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))"} fillOpacity={0.6} />
                    ))}
                  </Bar>
                </ComposedChart>
              )}
            </ChartPanel>



            {/* Disaggregated trader categories */}
            <div className="mt-3" />
            <ChartPanel
              title="Disaggregated Net Positioning"
              sub="Legacy report · Large Specs (non-comm) · Small Specs (non-rpt) · Commercials"
              right={
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
                  {([
                    { k: "large" as const, l: "Large Specs", c: "hsl(152 85% 32%)" },
                    { k: "small" as const, l: "Small Specs", c: "hsl(38 95% 50%)" },
                    { k: "commercial" as const, l: "Commercials", c: "hsl(354 82% 48%)" },
                  ]).map(o => (
                    <label key={o.k} className="flex items-center gap-1.5 cursor-pointer select-none" style={{ color: "hsl(var(--chart-axis))" }}>
                      <input
                        type="checkbox"
                        checked={disagg[o.k]}
                        onChange={(e) => setDisagg(s => ({ ...s, [o.k]: e.target.checked }))}
                        className="accent-current h-3 w-3"
                      />
                      <span className="inline-block h-1.5 w-3" style={{ background: o.c }} />
                      {o.l}
                    </label>
                  ))}
                </div>
              }
              height={300}
            >
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} syncId="assetDetail" barCategoryGap={1} barGap={0}>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} minTickGap={32} />
                <YAxis orientation="right" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={{ stroke: gridColor }} width={56} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--chart-surface))", border: `1px solid ${gridColor}`, borderRadius: 2, fontSize: 11 }} />
                <ReferenceLine y={0} stroke="hsl(var(--chart-axis))" strokeWidth={1} />
                {disagg.large && <Bar dataKey="netLargeSpec" name="Large Specs" fill="hsl(152 85% 32%)" stroke="hsl(152 90% 22%)" strokeWidth={0.5} fillOpacity={0.95} isAnimationActive={false} />}
                {disagg.small && <Bar dataKey="netSmallSpec" name="Small Specs" fill="hsl(38 95% 50%)" stroke="hsl(28 95% 38%)" strokeWidth={0.5} fillOpacity={0.95} isAnimationActive={false} />}
                {disagg.commercial && <Bar dataKey="netCommercial" name="Commercials" fill="hsl(354 82% 48%)" stroke="hsl(354 88% 35%)" strokeWidth={0.5} fillOpacity={0.95} isAnimationActive={false} />}
              </ComposedChart>
            </ChartPanel>

          </div>

          {/* News & Divergence sidebar */}
          {showNews && (
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
                          Expected:{" "}
                          <span style={{ color: dir > 0 ? "hsl(var(--pos-long))" : dir < 0 ? "hsl(var(--pos-short))" : undefined }}>
                            {dir > 0 ? "▲" : dir < 0 ? "▼" : "·"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          1D:{" "}
                          <span style={{ color: obs >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}>
                            {obs >= 0 ? "+" : ""}{obs.toFixed(2)}%
                          </span>
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
            <div className="hud-chart p-3 space-y-2.5">
              <span className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
                Current Positioning
              </span>
              {last && (
                <>
                  <PercentileGauge value={last.netSpecPct3y} label="Net Specs · 3Y" emphasize />
                  <PercentileGauge value={last.netSpecPct6m} label="Net Specs · 6M" />
                  {hasLev && <PercentileGauge value={last.levFundPct} label="Lev Funds · 3Y" />}
                  {hasLev && <PercentileGauge value={last.levFundPct6m} label="Lev Funds · 6M" />}
                  {hasAssetMgr && <PercentileGauge value={last.assetMgrPct} label="Asset Mgrs · 3Y" />}
                  {hasAssetMgr && <PercentileGauge value={last.assetMgrPct6m} label="Asset Mgrs · 6M" />}
                  <PercentileGauge value={last.largeSpecPct} label="Large Specs · 3Y (ref)" />
                </>
              )}
            </div>

            {/* Forward performance backtest */}
            <div className="hud-chart">
              <div className="hud-chart-header flex items-start justify-between gap-2 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
                    Forward Performance
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "hsl(var(--chart-ink-muted))" }}>
                    Bucket {Math.max(0, currentPct - 10)}–{Math.min(100, currentPct + 10)} · {windowLabel}
                  </span>
                </div>
                <SegToggle
                  value={pctWindow}
                  onChange={(v) => setPctWindow(v as WindowKey)}
                  options={[
                    { k: "netSpecPct6m" as const, l: "6M" },
                    { k: "netSpecPct3y" as const, l: "3Y" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-chart-grid">
                {forward.map(f => {
                  const pos = f.mean >= 0;
                  return (
                    <div key={f.horizon} className="p-2.5 flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--chart-axis))" }}>
                        {f.horizon}w forward
                      </span>
                      <div
                        className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums"
                        style={{ color: pos ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
                      >
                        {pos ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {pos ? "+" : ""}{f.mean.toFixed(2)}%
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: "hsl(var(--chart-ink-muted))" }}>
                        Hit {f.hitRate.toFixed(0)}% · n={f.count}
                      </div>
                    </div>
                  );
                })}
                {!forward.length && (
                  <div className="p-3 text-xs text-muted-foreground col-span-2">Insufficient history.</div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {error && <div className="text-xs text-destructive">Failed to load asset data.</div>}
        {!isLoading && !data && <div className="text-xs text-muted-foreground">Asset not found.</div>}
      </div>
    </AppShell>
  );
}
