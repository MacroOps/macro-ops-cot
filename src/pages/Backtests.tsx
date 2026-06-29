import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAssetData } from "@/hooks/useAssetData";
import { runBacktest, INDICATOR_OPTIONS, type BtCondition, type BtIndicator } from "@/hooks/useBacktest";
import { REGISTRY, REGISTRY_BY_KEY, buildIndicatorSeries, CATEGORIES, type RegistryIndicator } from "@/lib/backtest/registry";
import { runGenericBacktest, type GenericBtResult } from "@/lib/backtest/generic";
import { persistRun, listRuns, deleteRun, type BtRunRow } from "@/lib/backtest/persistence";
import { useAuth } from "@/hooks/useAuth";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { HudCrosshairCursor, HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";
import { ArrowUpRight, ArrowDownRight, Target, TrendingUp, Hash, Percent, Zap, Save, Trash2, History, GitCompare, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtInt = new Intl.NumberFormat("en-US");
const SECTOR_ORDER = ["Equities", "Rates", "FX", "Energy", "Metals", "Ags", "Softs", "Crypto"];

type Mode = "cot" | "indicator";
type Tab = "run" | "history" | "compare";

const Backtests = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const { user } = useAuth();
  const { data: dash } = useDashboardData();
  const markets = dash?.markets ?? [];

  // ── shared controls ────────────────────────────────────────────────
  const initialMode: Mode = params.get("indicator") && REGISTRY_BY_KEY[params.get("indicator")!] ? "indicator" : "cot";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [tab, setTab] = useState<Tab>(((params.get("tab") as Tab) === "history" || params.get("tab") === "compare") ? params.get("tab") as Tab : "run");

  // CoT mode state
  const [symbol, setSymbol] = useState<string>(params.get("symbol") ?? "");
  const activeSymbol = symbol || markets[0]?.symbol || "ES";
  const [cotIndicator, setCotIndicator] = useState<BtIndicator>(
    (params.get("cot") as BtIndicator) || "netSpecPct3y",
  );
  const cotMeta = INDICATOR_OPTIONS.find((o) => o.key === cotIndicator)!;
  const [cotThMin, cotThMax] = cotMeta.range;

  // Indicator (registry) mode state
  const [indKey, setIndKey] = useState<string>(
    params.get("indicator") ?? REGISTRY[0].key,
  );
  const ind = REGISTRY_BY_KEY[indKey] ?? REGISTRY[0];

  // Run params
  const [condition, setCondition] = useState<BtCondition>(
    (params.get("cond") as BtCondition) || "gte",
  );
  const [threshold, setThreshold] = useState<number>(
    params.get("th") ? Number(params.get("th")) : (mode === "cot" ? 85 : (ind.thresholdHi ?? Math.round((ind.min + ind.max) * 0.75))),
  );
  const [horizon, setHorizon] = useState<number>(
    params.get("h") ? Number(params.get("h")) : 12,
  );

  // Regime filter (simple toggle UI; applied to indicator-mode trades)
  const [regimeFilter, setRegimeFilter] = useState<"any" | "high-liq" | "low-liq">("any");

  // ── compute ─────────────────────────────────────────────────────────
  const { data: asset, isLoading: cotLoading } = useAssetData(activeSymbol);

  const cotResult = useMemo(() => {
    if (mode !== "cot" || !asset?.series) return null;
    return runBacktest(asset.series, { condition, threshold, horizonWeeks: horizon, indicator: cotIndicator });
  }, [mode, asset, condition, threshold, horizon, cotIndicator]);

  const indSeries = useMemo(() => mode === "indicator" ? buildIndicatorSeries(ind) : [], [mode, ind]);
  const filteredIndSeries = useMemo(() => {
    if (regimeFilter === "any") return indSeries;
    // Synthetic regime filter: keep every other quarter based on flag
    return indSeries.filter((_, i) => {
      const quarter = Math.floor(i / 13);
      return regimeFilter === "high-liq" ? quarter % 2 === 0 : quarter % 2 === 1;
    });
  }, [indSeries, regimeFilter]);
  const indResult = useMemo<GenericBtResult | null>(() => {
    if (mode !== "indicator") return null;
    return runGenericBacktest(filteredIndSeries, { condition, threshold, horizonBars: horizon });
  }, [mode, filteredIndSeries, condition, threshold, horizon]);

  // Reset threshold when switching indicator/mode (only if user hasn't deep-linked one)
  useEffect(() => {
    if (params.get("th")) return;
    if (mode === "cot") {
      const pct = condition === "gte" ? 0.85 : 0.15;
      setThreshold(Math.round(cotThMin + (cotThMax - cotThMin) * pct));
    } else {
      const pct = condition === "gte" ? 0.75 : 0.25;
      setThreshold(Math.round(ind.min + (ind.max - ind.min) * pct));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cotIndicator, indKey, condition]);

  // Update URL whenever params change (shareable links)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (mode === "cot") {
      sp.set("symbol", activeSymbol);
      sp.set("cot", cotIndicator);
    } else {
      sp.set("indicator", indKey);
    }
    sp.set("cond", condition);
    sp.set("th", String(threshold));
    sp.set("h", String(horizon));
    if (tab !== "run") sp.set("tab", tab);
    nav({ pathname: "/backtests", search: sp.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeSymbol, cotIndicator, indKey, condition, threshold, horizon, tab]);

  // ── unified result accessor ────────────────────────────────────────
  const unified = useMemo(() => {
    if (mode === "cot" && cotResult) {
      return {
        count: cotResult.count,
        baselineCount: cotResult.baseline.count,
        pctPositive: cotResult.pctPositive,
        baselinePct: cotResult.baseline.pctPositive,
        meanReturn: cotResult.meanReturn,
        baselineMean: cotResult.baseline.meanReturn,
        medianReturn: cotResult.medianReturn,
        baselineMedian: cotResult.baseline.medianReturn,
        bestReturn: cotResult.bestReturn,
        worstReturn: cotResult.worstReturn,
        edgeMean: cotResult.edgeMean,
        zScore: cotResult.zScore,
        paths: cotResult.paths,
        tradesCount: cotResult.trades.length,
        trades: cotResult.trades.map((t) => ({ entryDate: t.entryDate, exitDate: t.exitDate, entryValue: t.entryValue, returnPct: t.returnPct })),
        current: cotResult.current ? { entryDate: cotResult.current.entryDate, entryValue: cotResult.current.entryValue, barsElapsed: cotResult.current.weeksElapsed } : null,
        weekKey: "week",
      };
    }
    if (mode === "indicator" && indResult) {
      return {
        count: indResult.count,
        baselineCount: indResult.baseline.count,
        pctPositive: indResult.pctPositive,
        baselinePct: indResult.baseline.pctPositive,
        meanReturn: indResult.meanReturn,
        baselineMean: indResult.baseline.meanReturn,
        medianReturn: indResult.medianReturn,
        baselineMedian: indResult.baseline.medianReturn,
        bestReturn: indResult.bestReturn,
        worstReturn: indResult.worstReturn,
        edgeMean: indResult.edgeMean,
        zScore: indResult.zScore,
        paths: indResult.paths,
        tradesCount: indResult.trades.length,
        trades: indResult.trades.map((t) => ({ entryDate: t.entryDate, exitDate: t.exitDate, entryValue: t.entryValue, returnPct: t.returnPct })),
        current: indResult.current ? { entryDate: indResult.current.entryDate, entryValue: indResult.current.entryValue, barsElapsed: indResult.current.barsElapsed } : null,
        weekKey: "bar",
      };
    }
    return null;
  }, [mode, cotResult, indResult]);

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

  const cotIndicatorGroups = useMemo(() => {
    const g = new Map<string, typeof INDICATOR_OPTIONS>();
    for (const o of INDICATOR_OPTIONS) {
      const arr = g.get(o.group) ?? [];
      arr.push(o);
      g.set(o.group, arr);
    }
    return Array.from(g.entries());
  }, []);

  const indByCategory = useMemo(() => {
    const m = new Map<string, RegistryIndicator[]>();
    for (const c of CATEGORIES) m.set(c, []);
    for (const r of REGISTRY) (m.get(r.category) ?? []).push(r);
    return Array.from(m.entries()).filter(([, items]) => items.length);
  }, []);

  const histogram = useMemo(() => {
    if (!unified || !unified.tradesCount) return [];
    const returns = unified.trades.map((t) => t.returnPct);
    const lo = Math.min(...returns);
    const hi = Math.max(...returns);
    const span = Math.max(1, hi - lo);
    const buckets = 10;
    return Array.from({ length: buckets }, (_, b) => {
      const a = lo + (span * b) / buckets;
      const z = lo + (span * (b + 1)) / buckets;
      const count = returns.filter((r) => r >= a && (b === buckets - 1 ? r <= z : r < z)).length;
      return { bucket: `${a.toFixed(1)}–${z.toFixed(1)}`, count, lo: a, hi: z };
    });
  }, [unified]);

  const sig = unified && Math.abs(unified.zScore) > 2;
  const condSym = condition === "gte" ? "≥" : "≤";

  // ── persistence ─────────────────────────────────────────────────────
  async function saveRun() {
    if (!unified) return;
    if (!user) {
      toast({ title: "Sign in to save", description: "Backtest runs are saved per-user." });
      return;
    }
    const indicatorKey = mode === "cot" ? `cot:${cotIndicator}` : ind.key;
    const symbolForRow = mode === "cot" ? activeSymbol : ind.underlying;
    const row = await persistRun({
      source: "lab",
      indicatorKey,
      symbol: symbolForRow,
      params: { mode, condition, threshold, horizon, regimeFilter: mode === "indicator" ? regimeFilter : undefined },
      stats: {
        count: unified.count,
        pctPositive: unified.pctPositive,
        meanReturn: unified.meanReturn,
        medianReturn: unified.medianReturn,
        edgeMean: unified.edgeMean,
        zScore: unified.zScore,
        bestReturn: unified.bestReturn,
        worstReturn: unified.worstReturn,
      },
      label: mode === "cot"
        ? `${cotMeta.label} ${condSym} ${threshold} · ${activeSymbol} · ${horizon}w`
        : `${ind.label} ${condSym} ${threshold} · ${ind.underlying} · ${horizon}b`,
    });
    if (row) {
      toast({ title: "Run saved", description: "Find it under History." });
      window.dispatchEvent(new CustomEvent("mhud:bt-runs-changed"));
    }
  }

  const isLoading = mode === "cot" ? cotLoading : false;

  return (
    <AppShell title="Backtests Lab">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border bg-surface/40 px-3">
        <div className="flex items-center gap-0.5">
          <TabBtn active={tab === "run"} onClick={() => setTab("run")} icon={<FlaskConical className="h-3 w-3" />}>Run</TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<History className="h-3 w-3" />}>History</TabBtn>
          <TabBtn active={tab === "compare"} onClick={() => setTab("compare")} icon={<GitCompare className="h-3 w-3" />}>Compare</TabBtn>
        </div>
        {tab === "run" && (
          <div className="flex items-center gap-2 py-1.5">
            <ModeToggle mode={mode} setMode={setMode} />
            <button
              onClick={saveRun}
              disabled={!unified}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:border-primary hover:text-primary disabled:opacity-40"
            >
              <Save className="h-3 w-3" /> Save Run
            </button>
          </div>
        )}
      </div>

      {tab === "run" && (
        <>
          {/* Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-px bg-border p-px">
            <div className="hud-chart p-3 space-y-4">
              {mode === "cot" ? (
                <>
                  <Section label="Market">
                    <select
                      value={activeSymbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full text-xs font-mono bg-chart-surface border border-chart-grid rounded-sm px-2 py-1.5 text-chart-surface-foreground focus:outline-none focus:border-chart-ink"
                    >
                      {groupedMarkets.map((g) => (
                        <optgroup key={g.sector} label={g.sector}>
                          {g.items.map((m) => (
                            <option key={m.symbol} value={m.symbol}>{m.symbol} — {m.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Section>
                  <Section label="CoT Indicator">
                    <select
                      value={cotIndicator}
                      onChange={(e) => setCotIndicator(e.target.value as BtIndicator)}
                      className="w-full text-xs font-mono bg-chart-surface border border-chart-grid rounded-sm px-2 py-1.5 text-chart-surface-foreground focus:outline-none focus:border-chart-ink"
                    >
                      {cotIndicatorGroups.map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Section>
                </>
              ) : (
                <>
                  <Section label="Indicator">
                    <select
                      value={indKey}
                      onChange={(e) => setIndKey(e.target.value)}
                      className="w-full text-xs font-mono bg-chart-surface border border-chart-grid rounded-sm px-2 py-1.5 text-chart-surface-foreground focus:outline-none focus:border-chart-ink"
                    >
                      {indByCategory.map(([cat, items]) => (
                        <optgroup key={cat} label={cat}>
                          {items.map((r) => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Section>
                  <Section label={`Underlying · ${ind.underlying}`}>
                    <div className="text-[10px] text-chart-axis font-mono">
                      Forward path measured on the indicator's natural underlying market.
                    </div>
                  </Section>
                  <Section label="Regime Filter">
                    <Toggle
                      options={[
                        { k: "any", l: "Any" },
                        { k: "high-liq", l: "High Liq" },
                        { k: "low-liq", l: "Low Liq" },
                      ]}
                      value={regimeFilter}
                      onChange={(v) => setRegimeFilter(v as typeof regimeFilter)}
                    />
                  </Section>
                </>
              )}

              <Section label="Threshold Condition">
                <Toggle
                  options={[
                    { k: "gte", l: "Indicator ≥" },
                    { k: "lte", l: "Indicator ≤" },
                  ]}
                  value={condition}
                  onChange={(v) => setCondition(v as BtCondition)}
                />
              </Section>

              <Section label={`Threshold · ${threshold}`}>
                <input
                  type="range"
                  min={mode === "cot" ? cotThMin : ind.min}
                  max={mode === "cot" ? cotThMax : ind.max}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-chart-ink"
                />
                <div className="flex justify-between text-[9px] text-chart-axis font-mono">
                  <span>{mode === "cot" ? cotThMin : ind.min}</span>
                  <span>{Math.round(((mode === "cot" ? cotThMin : ind.min) + (mode === "cot" ? cotThMax : ind.max)) / 2)}</span>
                  <span>{mode === "cot" ? cotThMax : ind.max}</span>
                </div>
              </Section>

              <Section label={`Forward Horizon · ${horizon}${mode === "cot" ? "w" : "b"}`}>
                <input
                  type="range"
                  min={1}
                  max={mode === "cot" ? 26 : 52}
                  step={1}
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  className="w-full accent-chart-ink"
                />
              </Section>

              <div className="border-t border-chart-grid pt-3 text-[10px] leading-relaxed text-chart-axis">
                When <span className="font-semibold text-chart-surface-foreground">{mode === "cot" ? cotMeta.label : ind.label}</span>{" "}
                {condSym} <span className="font-semibold text-chart-surface-foreground">{threshold}</span>, observe
                what <span className="font-semibold text-chart-surface-foreground">{mode === "cot" ? activeSymbol : ind.underlying}</span>{" "}
                did over the next {horizon} {mode === "cot" ? "week" : "bar"}{horizon > 1 ? "s" : ""}.
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-chart-grid">
              <KPI icon={<Hash className="h-3 w-3" />} label="Samples" value={unified ? unified.count.toString() : "—"}
                   sub={unified ? `baseline ${fmtInt.format(unified.baselineCount)}` : undefined} />
              <KPI
                icon={<Target className="h-3 w-3" />}
                label="% Positive"
                value={unified ? `${unified.pctPositive.toFixed(0)}%` : "—"}
                sub={unified ? `baseline ${unified.baselinePct.toFixed(0)}%` : undefined}
                tone={unified && unified.pctPositive > unified.baselinePct ? "long"
                    : unified && unified.pctPositive < unified.baselinePct ? "short" : undefined}
              />
              <KPI
                icon={<Percent className="h-3 w-3" />}
                label="Mean Return"
                value={unified ? fmtPct(unified.meanReturn) : "—"}
                sub={unified ? `baseline ${fmtPct(unified.baselineMean)}` : undefined}
                tone={unified && unified.meanReturn >= 0 ? "long" : "short"}
              />
              <KPI
                icon={<TrendingUp className="h-3 w-3" />}
                label="Median Return"
                value={unified ? fmtPct(unified.medianReturn) : "—"}
                sub={unified ? `baseline ${fmtPct(unified.baselineMedian)}` : undefined}
                tone={unified && unified.medianReturn >= 0 ? "long" : "short"}
              />
              <KPI label="Best" value={unified ? fmtPct(unified.bestReturn) : "—"} tone="long" />
              <KPI label="Worst" value={unified ? fmtPct(unified.worstReturn) : "—"} tone="short" />
              <KPI label="Horizon" value={`${horizon}${mode === "cot" ? "w" : "b"}`} />
              <KPI
                icon={<Zap className="h-3 w-3" />}
                label="Edge vs Baseline"
                value={unified ? `${fmtPct(unified.edgeMean)}` : "—"}
                sub={unified ? `z ${unified.zScore >= 0 ? "+" : ""}${unified.zScore.toFixed(2)}${sig ? " · sig" : ""}` : undefined}
                tone={unified && unified.edgeMean >= 0 ? "long" : "short"}
                big
              />
            </div>
          </div>

          {/* Spaghetti */}
          <div className="hud-chart m-px p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis">
                Forward Returns · each line = one past instance
              </div>
              <div className="text-[10px] font-mono text-chart-axis">{unified?.count ?? 0} paths</div>
            </div>
            <div className="h-[28rem]">
              {isLoading ? (
                <div className="h-full w-full animate-pulse bg-chart-grid/40" />
              ) : unified && unified.paths.length > 1 && unified.tradesCount ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={unified.paths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey={unified.weekKey}
                      tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                      axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }}
                      axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                      tickLine={false}
                      width={50}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                    />
                    <Tooltip cursor={false}
                      contentStyle={{
                        background: "hsl(var(--chart-surface))",
                        border: "1px solid hsl(var(--chart-grid))",
                        fontSize: 11, borderRadius: 2, color: "hsl(var(--chart-surface-foreground))",
                      }}
                      formatter={(v: number, name: string) => {
                        if (name === "median" || name === "mean" || name === "baseline" || name === "current") return [`${fmtPct(v)}`, name];
                        return null;
                      }}
                    />
                    <Customized component={HudCrosshairOverlay} />
                    <ReferenceLine y={0} stroke="hsl(var(--chart-grid))" />
                    {Array.from({ length: unified.tradesCount }).map((_, idx) => (
                      <Line key={`t${idx}`} type="monotone" dataKey={`t${idx}`}
                        stroke="hsl(var(--chart-ink))" strokeWidth={0.6} strokeOpacity={0.18}
                        dot={false} isAnimationActive={false} activeDot={false} />
                    ))}
                    <Line type="monotone" dataKey="baseline" stroke="hsl(var(--chart-axis))" strokeWidth={1} strokeDasharray="1 3" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="mean" stroke="hsl(var(--chart-axis))" strokeWidth={1.25} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="median" stroke="hsl(var(--chart-ink))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    {unified.current && (
                      <Line type="monotone" dataKey="current" stroke="hsl(var(--pos-short))" strokeWidth={2.5}
                        dot={{ r: 2.5, fill: "hsl(var(--pos-short))", stroke: "hsl(var(--pos-short))" }}
                        isAnimationActive={false} connectNulls={false} />
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
                Return Distribution
              </div>
              <div className="h-64">
                {histogram.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--chart-axis))" }} axisLine={{ stroke: "hsl(var(--chart-grid))" }} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: "hsl(var(--chart-surface))", border: "1px solid hsl(var(--chart-grid))", fontSize: 11, borderRadius: 2, color: "hsl(var(--chart-surface-foreground))" }} />
                      <Bar dataKey="count">
                        {histogram.map((b, i) => (
                          <Cell key={i} fill={b.lo >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState />}
              </div>
            </div>

            <div className="hud-chart p-3 flex flex-col">
              <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-chart-axis mb-2">
                Sample Log · {unified?.count ?? 0}
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
                    {unified?.trades.slice().reverse().map((t, i) => {
                      const up = t.returnPct >= 0;
                      return (
                        <tr key={i} className="border-b border-chart-grid/60">
                          <td className="py-1.5 text-chart-surface-foreground">{t.entryDate}</td>
                          <td className="text-right text-chart-axis">{t.entryValue}</td>
                          <td className="text-right text-chart-axis">{t.exitDate}</td>
                          <td className="text-right font-semibold" style={{ color: up ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}>
                            <span className="inline-flex items-center gap-0.5 justify-end">
                              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {fmtPct(t.returnPct)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!unified?.tradesCount && (
                      <tr><td colSpan={4} className="py-6 text-center text-chart-axis text-[10px] uppercase tracking-wider">No samples match these parameters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "history" && <HistoryTab onReopen={(row) => {
        if (row.params && (row.params as any).mode === "cot") {
          setMode("cot");
          setSymbol(row.symbol ?? "");
          setCotIndicator((row.indicator_key.replace("cot:", "")) as BtIndicator);
        } else {
          setMode("indicator");
          setIndKey(row.indicator_key);
        }
        setCondition(((row.params as any).condition) as BtCondition);
        setThreshold(Number((row.params as any).threshold));
        setHorizon(Number((row.params as any).horizon));
        setTab("run");
      }} />}

      {tab === "compare" && <CompareTab />}
    </AppShell>
  );
};

// ─── helpers ────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.14em] border-b-2 transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-surface-foreground"
      }`}
    >
      {icon}{children}
    </button>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-0.5 border border-border rounded-sm overflow-hidden">
      {(["cot", "indicator"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-2 py-1 text-[10px] uppercase tracking-wider ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-surface-foreground"}`}
        >
          {m === "cot" ? "CoT" : "Indicator"}
        </button>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] font-medium text-chart-axis">{label}</div>
      {children}
    </div>
  );
}

function Toggle<T extends string>({ options, value, onChange }: { options: { k: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
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

function KPI({ icon, label, value, sub, tone, big }: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: "long" | "short"; big?: boolean }) {
  const color = tone === "long" ? "text-pos-long" : tone === "short" ? "text-pos-short" : "text-chart-surface-foreground";
  return (
    <div className="bg-chart-surface px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] font-medium text-chart-axis">
        {icon}{label}
      </div>
      <div className={`mt-1 ${big ? "text-2xl" : "text-base"} font-semibold tabular-nums ${color} truncate`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-chart-axis mt-0.5 truncate">{sub}</div>}
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

function HistoryTab({ onReopen }: { onReopen: (row: BtRunRow) => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<BtRunRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setRows(await listRuns());
    setLoading(false);
  }

  useEffect(() => {
    if (user) refresh();
    const h = () => { if (user) refresh(); };
    window.addEventListener("mhud:bt-runs-changed", h);
    return () => window.removeEventListener("mhud:bt-runs-changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
        Sign in to view your saved backtest runs.
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="hud-chart">
        <div className="overflow-auto">
          <table className="w-full text-[11px] font-mono tabular-nums">
            <thead className="text-[9px] uppercase tracking-wider text-chart-axis sticky top-0 bg-chart-surface">
              <tr className="border-b border-chart-grid">
                <th className="text-left py-2 px-3 font-medium">When</th>
                <th className="text-left font-medium">Indicator</th>
                <th className="text-left font-medium">Symbol</th>
                <th className="text-left font-medium">Source</th>
                <th className="text-right font-medium">Samples</th>
                <th className="text-right font-medium">Hit%</th>
                <th className="text-right font-medium">Mean</th>
                <th className="text-right font-medium">Edge</th>
                <th className="text-right font-medium pr-3">Z</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="py-6 text-center text-chart-axis text-[10px]">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-chart-axis text-[10px] uppercase tracking-wider">
                  No saved runs yet. Hit "Save Run" on the Run tab to start a history.
                </td></tr>
              )}
              {rows.map((r) => {
                const s = (r.stats ?? {}) as any;
                return (
                  <tr key={r.id} className="border-b border-chart-grid/60 hover:bg-chart-grid/20 cursor-pointer" onClick={() => onReopen(r)}>
                    <td className="py-1.5 px-3 text-chart-axis">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="text-chart-surface-foreground">{r.label ?? r.indicator_key}</td>
                    <td className="text-chart-axis">{r.symbol ?? "—"}</td>
                    <td className="text-chart-axis text-[9px] uppercase tracking-wider">{r.source}</td>
                    <td className="text-right">{s.count ?? "—"}</td>
                    <td className="text-right">{s.pctPositive != null ? `${Number(s.pctPositive).toFixed(0)}%` : "—"}</td>
                    <td className="text-right" style={{ color: (s.meanReturn ?? 0) >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}>
                      {s.meanReturn != null ? fmtPct(Number(s.meanReturn)) : "—"}
                    </td>
                    <td className="text-right" style={{ color: (s.edgeMean ?? 0) >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}>
                      {s.edgeMean != null ? fmtPct(Number(s.edgeMean)) : "—"}
                    </td>
                    <td className="text-right pr-3">{s.zScore != null ? Number(s.zScore).toFixed(2) : "—"}</td>
                    <td className="pr-3">
                      <button
                        onClick={async (e) => { e.stopPropagation(); if (await deleteRun(r.id)) { toast({ title: "Run deleted" }); refresh(); } }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete run"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompareTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BtRunRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (user) listRuns(50).then(setRows);
  }, [user]);

  const chosen = rows.filter((r) => selected.includes(r.id));

  if (!user) {
    return <div className="p-6 text-center text-[11px] uppercase tracking-wider text-muted-foreground">Sign in to compare saved runs.</div>;
  }

  return (
    <div className="p-3 space-y-3">
      <div className="hud-chart p-3">
        <div className="text-[10px] uppercase tracking-[0.14em] text-chart-axis mb-2">Pick up to 4 saved runs to compare</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-48 overflow-auto">
          {rows.map((r) => {
            const on = selected.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelected((cur) => on ? cur.filter((x) => x !== r.id) : (cur.length >= 4 ? cur : [...cur, r.id]));
                }}
                className={`flex items-center justify-between text-[11px] px-2 py-1.5 border rounded-sm text-left ${
                  on ? "border-primary bg-primary/10 text-primary" : "border-border text-chart-axis hover:text-chart-ink"
                }`}
              >
                <span className="truncate">{r.label ?? r.indicator_key}</span>
                <span className="text-[9px] font-mono text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
              </button>
            );
          })}
          {!rows.length && <div className="text-[10px] text-chart-axis">No runs yet.</div>}
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border p-px">
          {chosen.map((r) => {
            const s = (r.stats ?? {}) as any;
            return (
              <div key={r.id} className="hud-chart p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold truncate">{r.label ?? r.indicator_key}</div>
                <div className="text-[9px] font-mono text-chart-axis">{new Date(r.created_at).toLocaleString()}</div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono tabular-nums pt-2">
                  <Stat lbl="Samples" val={s.count ?? "—"} />
                  <Stat lbl="Hit %" val={s.pctPositive != null ? `${Number(s.pctPositive).toFixed(0)}%` : "—"} />
                  <Stat lbl="Mean" val={s.meanReturn != null ? fmtPct(Number(s.meanReturn)) : "—"} tone={(s.meanReturn ?? 0) >= 0 ? "long" : "short"} />
                  <Stat lbl="Edge" val={s.edgeMean != null ? fmtPct(Number(s.edgeMean)) : "—"} tone={(s.edgeMean ?? 0) >= 0 ? "long" : "short"} />
                  <Stat lbl="Z" val={s.zScore != null ? Number(s.zScore).toFixed(2) : "—"} />
                  <Stat lbl="Best" val={s.bestReturn != null ? fmtPct(Number(s.bestReturn)) : "—"} tone="long" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ lbl, val, tone }: { lbl: string; val: string | number; tone?: "long" | "short" }) {
  const color = tone === "long" ? "text-pos-long" : tone === "short" ? "text-pos-short" : "text-chart-surface-foreground";
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-chart-axis">{lbl}</div>
      <div className={`font-semibold ${color}`}>{val}</div>
    </div>
  );
}

export default Backtests;
