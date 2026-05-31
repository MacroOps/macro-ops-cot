import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAssetData } from "@/hooks/useAssetData";
import { runBacktest, INDICATOR_OPTIONS, type BtCondition, type BtIndicator } from "@/hooks/useBacktest";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Hash, Percent, Zap } from "lucide-react";

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtInt = new Intl.NumberFormat("en-US");

const SECTOR_ORDER = ["Equities", "Rates", "FX", "Energy", "Metals", "Ags", "Softs", "Crypto"];

const Backtests = () => {
  const { data: dash } = useDashboardData();
  const markets = dash?.markets ?? [];
  const [symbol, setSymbol] = useState<string>("");
  const activeSymbol = symbol || markets[0]?.symbol || "ES";

  const [condition, setCondition] = useState<BtCondition>("gte");
  const [indicator, setIndicator] = useState<BtIndicator>("netSpecPct3y");
  const [threshold, setThreshold] = useState<number>(85);
  const [horizon, setHorizon] = useState<number>(12);

  const indicatorMeta = INDICATOR_OPTIONS.find(o => o.key === indicator)!;
  const [thMin, thMax] = indicatorMeta.range;

  const { data: asset, isLoading } = useAssetData(activeSymbol);

  const result = useMemo(() => {
    if (!asset?.series) return null;
    return runBacktest(asset.series, { condition, threshold, horizonWeeks: horizon, indicator });
  }, [asset, condition, threshold, horizon, indicator]);

  // Group + sort markets by sector
  const groupedMarkets = useMemo(() => {
    const groups = new Map<string, typeof markets>();
    for (const m of markets) {
      const arr = groups.get(m.sector) ?? [];
      arr.push(m);
      groups.set(m.sector, arr);
    }
    const ordered: { sector: string; items: typeof markets }[] = [];
    for (const s of SECTOR_ORDER) {
      const g = groups.get(s);
      if (g) ordered.push({ sector: s, items: [...g].sort((a, b) => a.symbol.localeCompare(b.symbol)) });
    }
    for (const [s, g] of groups) {
      if (!SECTOR_ORDER.includes(s)) ordered.push({ sector: s, items: [...g].sort((a, b) => a.symbol.localeCompare(b.symbol)) });
    }
    return ordered;
  }, [markets]);

  const indicatorGroups = useMemo(() => {
    const g = new Map<string, typeof INDICATOR_OPTIONS>();
    for (const o of INDICATOR_OPTIONS) {
      const arr = g.get(o.group) ?? [];
      arr.push(o);
      g.set(o.group, arr);
    }
    return Array.from(g.entries());
  }, []);

  const flipCondition = (c: BtCondition) => {
    setCondition(c);
    const pct = c === "gte" ? 0.85 : 0.15;
    setThreshold(Math.round(thMin + (thMax - thMin) * pct));
  };

  const changeIndicator = (k: BtIndicator) => {
    const meta = INDICATOR_OPTIONS.find(o => o.key === k)!;
    const [lo, hi] = meta.range;
    const pct = condition === "gte" ? 0.85 : 0.15;
    setThreshold(Math.round(lo + (hi - lo) * pct));
    setIndicator(k);
  };

  // Histogram from returns
  const histogram = useMemo(() => {
    if (!result?.trades.length) return [];
    const returns = result.trades.map(t => t.returnPct);
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const span = Math.max(1, max - min);
    const buckets = 10;
    return Array.from({ length: buckets }, (_, b) => {
      const lo = min + (span * b) / buckets;
      const hi = min + (span * (b + 1)) / buckets;
      const count = returns.filter(r => r >= lo && (b === buckets - 1 ? r <= hi : r < hi)).length;
      return { bucket: `${lo.toFixed(1)}–${hi.toFixed(1)}`, count, lo, hi };
    });
  }, [result]);

  const condSym = condition === "gte" ? "≥" : "≤";
  const sig = result && Math.abs(result.zScore) > 2;

  return (
    <AppShell title="Backtests Lab">
      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-px bg-border p-px">
        <div className="hud-chart p-3 space-y-4">
          <Section label="Market">
            <select
              value={activeSymbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full text-xs font-mono bg-chart-surface border border-chart-grid rounded-sm px-2 py-1.5 text-chart-surface-foreground focus:outline-none focus:border-chart-ink"
            >
              {groupedMarkets.map(g => (
                <optgroup key={g.sector} label={g.sector}>
                  {g.items.map(m => (
                    <option key={m.symbol} value={m.symbol}>
                      {m.symbol} — {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Section>

          <Section label="CoT Indicator">
            <select
              value={indicator}
              onChange={(e) => changeIndicator(e.target.value as BtIndicator)}
              className="w-full text-xs font-mono bg-chart-surface border border-chart-grid rounded-sm px-2 py-1.5 text-chart-surface-foreground focus:outline-none focus:border-chart-ink"
            >
              {indicatorGroups.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Section>

          <Section label="Threshold Condition">
            <Toggle
              options={[
                { k: "gte", l: "Indicator ≥" },
                { k: "lte", l: "Indicator ≤" },
              ]}
              value={condition}
              onChange={(v) => flipCondition(v as BtCondition)}
            />
          </Section>

          <Section label={`Threshold · ${threshold}`}>
            <input
              type="range"
              min={thMin}
              max={thMax}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-chart-ink"
            />
            <div className="flex justify-between text-[9px] text-chart-axis font-mono">
              <span>{thMin}</span><span>{Math.round((thMin + thMax) / 2)}</span><span>{thMax}</span>
            </div>
          </Section>

          <Section label={`Forward Horizon · ${horizon}w`}>
            <input
              type="range"
              min={1}
              max={26}
              step={1}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full accent-chart-ink"
            />
            <div className="flex justify-between text-[9px] text-chart-axis font-mono">
              <span>1w</span><span>13w</span><span>26w</span>
            </div>
          </Section>

          <div className="border-t border-chart-grid pt-3 text-[10px] leading-relaxed text-chart-axis">
            When <span className="font-semibold text-chart-surface-foreground">{indicatorMeta.label}</span>{" "}
            {condSym} <span className="font-semibold text-chart-surface-foreground">{threshold}</span>, observe
            what <span className="font-semibold text-chart-surface-foreground">{activeSymbol}</span> did over the
            next {horizon} week{horizon > 1 ? "s" : ""}. Baseline = all rolling {horizon}w windows in the series.
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-chart-grid">
          <KPI icon={<Hash className="h-3 w-3" />} label="Samples" value={result?.count.toString() ?? "—"}
               sub={result ? `baseline ${fmtInt.format(result.baseline.count)}` : undefined} />
          <KPI
            icon={<Target className="h-3 w-3" />}
            label="% Positive"
            value={result ? `${result.pctPositive.toFixed(0)}%` : "—"}
            sub={result ? `baseline ${result.baseline.pctPositive.toFixed(0)}%` : undefined}
            tone={result && result.pctPositive > result.baseline.pctPositive ? "long"
                : result && result.pctPositive < result.baseline.pctPositive ? "short" : undefined}
          />
          <KPI
            icon={<Percent className="h-3 w-3" />}
            label="Mean Return"
            value={result ? fmtPct(result.meanReturn) : "—"}
            sub={result ? `baseline ${fmtPct(result.baseline.meanReturn)}` : undefined}
            tone={result && result.meanReturn >= 0 ? "long" : "short"}
          />
          <KPI
            icon={<TrendingUp className="h-3 w-3" />}
            label="Median Return"
            value={result ? fmtPct(result.medianReturn) : "—"}
            sub={result ? `baseline ${fmtPct(result.baseline.medianReturn)}` : undefined}
            tone={result && result.medianReturn >= 0 ? "long" : "short"}
          />
          <KPI label="Best" value={result ? fmtPct(result.bestReturn) : "—"} tone="long" />
          <KPI label="Worst" value={result ? fmtPct(result.worstReturn) : "—"} tone="short" />
          <KPI label="Horizon" value={`${horizon}w`} />
          <KPI
            icon={<Zap className="h-3 w-3" />}
            label="Edge vs Baseline"
            value={result ? `${fmtPct(result.edgeMean)}` : "—"}
            sub={result ? `z ${result.zScore >= 0 ? "+" : ""}${result.zScore.toFixed(2)}${sig ? " · sig" : ""}` : undefined}
            tone={result && result.edgeMean >= 0 ? "long" : "short"}
            big
          />
        </div>
      </div>

      {/* Spaghetti forward returns */}
      <div className="hud-chart m-px p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis">
            Forward Returns · {activeSymbol} · each line = one past instance
          </div>
          <div className="text-[10px] font-mono text-chart-axis flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-px bg-chart-ink" /> Median
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-px" style={{ background: "hsl(var(--chart-axis))", opacity: 0.6 }} /> Mean
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 border-t border-dotted border-chart-axis" /> Baseline drift
            </span>
            {result?.current && (
              <span className="flex items-center gap-1" style={{ color: "hsl(var(--pos-short))" }}>
                <span className="inline-block w-3 h-px" style={{ background: "hsl(var(--pos-short))" }} />
                Current signal · entry {result.current.entryDate} @ {result.current.entryValue.toFixed(1)} ·{" "}
                {result.current.weeksElapsed === 0 ? "triggered this week" : `${result.current.weeksElapsed}w in`}
              </span>
            )}
            <span>{result?.count ?? 0} paths</span>
          </div>
        </div>
        <div className="h-[28rem]">
          {isLoading ? (
            <div className="h-full w-full animate-pulse bg-chart-grid/40" />
          ) : result && result.paths.length > 1 && result.trades.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.paths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  tickLine={false}
                  label={{ value: "Weeks forward", position: "insideBottom", offset: -2, fontSize: 9, fill: "hsl(var(--chart-axis))" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--chart-surface))",
                    border: "1px solid hsl(var(--chart-grid))",
                    fontSize: 11, borderRadius: 2, color: "hsl(var(--chart-surface-foreground))",
                  }}
                  formatter={(v: number, name: string) => {
                    if (name === "median" || name === "mean" || name === "baseline" || name === "current") return [`${fmtPct(v)}`, name];
                    return null;
                  }}
                  labelFormatter={(l) => `Week ${l}`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--chart-grid))" />
                {result.trades.map((_, idx) => (
                  <Line
                    key={`t${idx}`}
                    type="monotone"
                    dataKey={`t${idx}`}
                    stroke="hsl(var(--chart-ink))"
                    strokeWidth={0.6}
                    strokeOpacity={0.18}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={false}
                  />
                ))}
                <Line type="monotone" dataKey="baseline" stroke="hsl(var(--chart-axis))" strokeWidth={1} strokeDasharray="1 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="mean" stroke="hsl(var(--chart-axis))" strokeWidth={1.25} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="median" stroke="hsl(var(--chart-ink))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {result.current && (
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="hsl(var(--pos-short))"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: "hsl(var(--pos-short))", stroke: "hsl(var(--pos-short))" }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Histogram + Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-px bg-border p-px">
        <div className="hud-chart p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis mb-2">
            Return Distribution · final ({horizon}w)
          </div>
          <div className="h-64">
            {histogram.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--chart-surface))",
                      border: "1px solid hsl(var(--chart-grid))",
                      fontSize: 11, borderRadius: 2, color: "hsl(var(--chart-surface-foreground))",
                    }}
                  />
                  <Bar dataKey="count">
                    {histogram.map((b, i) => (
                      <Cell key={i} fill={b.lo >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        <div className="hud-chart p-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis mb-2">
            Sample Log · {result?.count ?? 0}
          </div>
          <div className="overflow-auto max-h-64 -mx-3 px-3">
            <table className="w-full text-[11px] font-mono tabular-nums">
              <thead className="text-[9px] uppercase tracking-wider text-chart-axis sticky top-0 bg-chart-surface">
                <tr className="border-b border-chart-grid">
                  <th className="text-left py-1.5 font-medium">Entry</th>
                  <th className="text-right font-medium">Signal</th>
                  <th className="text-right font-medium">Exit</th>
                  <th className="text-right font-medium">Return</th>
                </tr>
              </thead>
              <tbody>
                {result?.trades.slice().reverse().map((t, i) => {
                  const up = t.returnPct >= 0;
                  return (
                    <tr key={i} className="border-b border-chart-grid/60">
                      <td className="py-1.5 text-chart-surface-foreground">{t.entryDate}</td>
                      <td className="text-right text-chart-axis">{t.entryValue}</td>
                      <td className="text-right text-chart-axis">{t.exitDate}</td>
                      <td
                        className="text-right font-semibold"
                        style={{ color: up ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
                      >
                        <span className="inline-flex items-center gap-0.5 justify-end">
                          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {fmtPct(t.returnPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!result?.trades.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-chart-axis text-[10px] uppercase tracking-wider">No samples match these parameters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        {fmtInt.format(asset?.series.length ?? 0)} weekly bars available for {activeSymbol}.
      </div>
    </AppShell>
  );
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] font-medium text-chart-axis">{label}</div>
      {children}
    </div>
  );
}

function Toggle<T extends string>({ options, value, onChange }: {
  options: { k: T; l: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map(o => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          className={`flex-1 text-[10px] uppercase tracking-wider px-2 py-1.5 rounded-sm border transition-colors ${
            value === o.k
              ? "border-chart-ink bg-chart-ink text-chart-surface"
              : "border-chart-grid text-chart-axis hover:text-chart-ink"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function KPI({ icon, label, value, sub, tone, big }: {
  icon?: React.ReactNode; label: string; value: string; sub?: string;
  tone?: "long" | "short"; big?: boolean;
}) {
  const color =
    tone === "long" ? "text-pos-long"
    : tone === "short" ? "text-pos-short"
    : "text-chart-surface-foreground";
  return (
    <div className="bg-chart-surface px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] font-medium text-chart-axis">
        {icon}{label}
      </div>
      <div className={`mt-1 ${big ? "text-2xl" : "text-base"} font-semibold tabular-nums ${color} truncate`}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] font-mono text-chart-axis mt-0.5 truncate">{sub}</div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full w-full flex items-center justify-center text-[10px] uppercase tracking-wider text-chart-axis">
      No data
    </div>
  );
}

export default Backtests;
