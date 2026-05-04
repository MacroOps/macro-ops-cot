import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAssetData } from "@/hooks/useAssetData";
import { runBacktest, type BtDirection, type BtWindow } from "@/hooks/useBacktest";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Hash, Percent } from "lucide-react";

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtInt = new Intl.NumberFormat("en-US");

const Backtests = () => {
  const { data: dash } = useDashboardData();
  const markets = dash?.markets ?? [];
  const [symbol, setSymbol] = useState<string>("");
  const activeSymbol = symbol || markets[0]?.symbol || "ES";

  const [direction, setDirection] = useState<BtDirection>("long");
  const [windowKey, setWindowKey] = useState<BtWindow>("netSpecPct3y");
  const [threshold, setThreshold] = useState<number>(85);
  const [horizon, setHorizon] = useState<number>(4);

  const { data: asset, isLoading } = useAssetData(activeSymbol);

  const result = useMemo(() => {
    if (!asset?.series) return null;
    return runBacktest(asset.series, { direction, threshold, horizonWeeks: horizon, windowKey });
  }, [asset, direction, threshold, horizon, windowKey]);

  // Sync threshold default when direction flips
  const flipDirection = (d: BtDirection) => {
    setDirection(d);
    if (d === "long" && threshold < 50) setThreshold(85);
    if (d === "short" && threshold >= 50) setThreshold(15);
  };

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
              {markets.map(m => (
                <option key={m.symbol} value={m.symbol}>
                  {m.symbol} — {m.name}
                </option>
              ))}
            </select>
          </Section>

          <Section label="Signal Window">
            <Toggle
              options={[
                { k: "netSpecPct3y", l: "3Y" },
                { k: "netSpecPct6m", l: "6M" },
              ]}
              value={windowKey}
              onChange={(v) => setWindowKey(v as BtWindow)}
            />
          </Section>

          <Section label="Direction">
            <Toggle
              options={[
                { k: "long", l: "Long ≥" },
                { k: "short", l: "Short ≤" },
              ]}
              value={direction}
              onChange={(v) => flipDirection(v as BtDirection)}
            />
          </Section>

          <Section label={`Percentile Threshold · ${threshold}`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-chart-ink"
            />
            <div className="flex justify-between text-[9px] text-chart-axis font-mono">
              <span>0</span><span>50</span><span>100</span>
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
            Signal: enter <span className="font-semibold text-chart-surface-foreground">{direction.toUpperCase()}</span>{" "}
            whenever Net Speculator percentile ({windowKey === "netSpecPct3y" ? "3Y" : "6M"}){" "}
            {direction === "long" ? "≥" : "≤"} {threshold}. Hold {horizon} week{horizon > 1 ? "s" : ""}. Non-overlapping trades.
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-chart-grid">
          <KPI icon={<Hash className="h-3 w-3" />} label="Trades" value={result?.count.toString() ?? "—"} />
          <KPI
            icon={<Target className="h-3 w-3" />}
            label="Hit Rate"
            value={result ? `${result.hitRate.toFixed(0)}%` : "—"}
            tone={result && result.hitRate >= 55 ? "long" : result && result.hitRate <= 45 ? "short" : undefined}
          />
          <KPI
            icon={<Percent className="h-3 w-3" />}
            label="Mean / Trade"
            value={result ? fmtPct(result.meanReturn) : "—"}
            tone={result && result.meanReturn >= 0 ? "long" : "short"}
          />
          <KPI
            icon={<TrendingUp className="h-3 w-3" />}
            label="Cumulative"
            value={result ? fmtPct(result.totalReturn) : "—"}
            tone={result && result.totalReturn >= 0 ? "long" : "short"}
            big
          />
          <KPI label="Median" value={result ? fmtPct(result.medianReturn) : "—"} />
          <KPI label="Best" value={result ? fmtPct(result.bestReturn) : "—"} tone="long" />
          <KPI label="Worst" value={result ? fmtPct(result.worstReturn) : "—"} tone="short" />
          <KPI label="Avg Hold" value={`${horizon}w`} />
        </div>
      </div>

      {/* Equity curve */}
      <div className="hud-chart m-px p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis">
            Equity Curve · $100 base · {activeSymbol}
          </div>
          <div className="text-[10px] font-mono text-chart-axis">
            {result?.count ?? 0} trades · {result ? fmtPct(result.totalReturn) : "—"}
          </div>
        </div>
        <div className="h-72">
          {isLoading ? (
            <div className="h-full w-full animate-pulse bg-chart-grid/40" />
          ) : result && result.equityCurve.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.equityCurve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} width={50} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--chart-surface))",
                    border: "1px solid hsl(var(--chart-grid))",
                    fontSize: 11, borderRadius: 2, color: "hsl(var(--chart-surface-foreground))",
                  }}
                  formatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <ReferenceLine y={100} stroke="hsl(var(--chart-grid))" />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="hsl(var(--chart-ink))"
                  strokeWidth={1.75}
                  dot={false}
                />
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
            Return Distribution · per trade
          </div>
          <div className="h-64">
            {result && result.histogram.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.histogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  <ReferenceLine x={0} stroke="hsl(var(--chart-grid))" />
                  <Bar dataKey="count">
                    {result.histogram.map((b, i) => (
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
            Trade Log · {result?.count ?? 0}
          </div>
          <div className="overflow-auto max-h-64 -mx-3 px-3">
            <table className="w-full text-[11px] font-mono tabular-nums">
              <thead className="text-[9px] uppercase tracking-wider text-chart-axis sticky top-0 bg-chart-surface">
                <tr className="border-b border-chart-grid">
                  <th className="text-left py-1.5 font-medium">Entry</th>
                  <th className="text-right font-medium">%ile</th>
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
                      <td className="text-right text-chart-axis">{t.entryPct}</td>
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
                  <tr><td colSpan={4} className="py-6 text-center text-chart-axis text-[10px] uppercase tracking-wider">No trades match these parameters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        {fmtInt.format(asset?.series.length ?? 0)} weekly bars · synthetic 3y rolling history per market.
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

function KPI({ icon, label, value, tone, big }: {
  icon?: React.ReactNode; label: string; value: string;
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
      <div className={`mt-1 ${big ? "text-2xl" : "text-base"} font-semibold tabular-nums ${color}`}>
        {value}
      </div>
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
