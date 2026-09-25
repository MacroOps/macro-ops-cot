import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { usePortfolioSnapshot } from "@/hooks/usePortfolioSnapshot";
import type { EquityGroups, PublicPosition } from "@/lib/portfolio/types";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, RefreshCw } from "lucide-react";

const fp = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const tone = (v: number | null | undefined) =>
  v == null ? "text-muted-foreground" : v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground";

type EqFilter = keyof EquityGroups | "all";

const EQ_LABELS: Array<{ id: EqFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "aerospace", label: "Aerospace" },
  { id: "metals", label: "Metals & Mining" },
  { id: "oil", label: "Oil & Gas" },
  { id: "techAI", label: "Tech/AI" },
  { id: "healthcare", label: "Healthcare" },
  { id: "agriculture", label: "Agriculture" },
  { id: "crypto", label: "Crypto" },
  { id: "other", label: "Other" },
];

function sumAbs(arr: PublicPosition[]) {
  return arr.reduce((t, p) => t + (p.notional != null ? Math.abs(p.notional) : 0), 0);
}

function BarList({
  rows,
}: {
  rows: Array<{ label: string; pct: number | null; count: number | null }>;
}) {
  const max = Math.max(...rows.map((r) => (r.pct != null ? Math.abs(r.pct) : 0)), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const has = r.pct != null && !Number.isNaN(r.pct);
        const w = has ? Math.min((Math.abs(r.pct!) / max) * 100, 100) : 0;
        const neg = has && r.pct! < 0;
        return (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr_3.5rem_4rem] items-center gap-2 text-[11px]">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
              <div
                className={`h-full ${neg ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${w}%` }}
              />
            </div>
            <span className={`font-mono tabular-nums text-right ${tone(r.pct)}`}>{has ? fp(r.pct) : "—"}</span>
            <span className="text-[10px] text-muted-foreground text-right">
              {r.count != null ? `${r.count} pos` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PosTable({ rows }: { rows: PublicPosition[] }) {
  if (!rows.length) {
    return <div className="px-3 py-4 text-[11px] text-muted-foreground">No positions</div>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left py-1.5 px-3 font-medium">Name</th>
          <th className="text-left py-1.5 px-3 font-medium">Ticker</th>
          <th className="text-right py-1.5 px-3 font-medium">Notional</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={`${p.ticker}-${p.name}`} className="border-t border-border/50">
            <td className="py-1.5 px-3">{p.name}</td>
            <td className="py-1.5 px-3 font-mono">
              {p.ticker}
              {p.isShort && (
                <span className="ml-1.5 text-[9px] uppercase tracking-wider text-destructive">Short</span>
              )}
            </td>
            <td className={`py-1.5 px-3 text-right font-mono tabular-nums ${tone(p.notional)}`}>
              {fp(p.notional)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Portfolio() {
  const { data, isLoading, error, refetch, isFetching } = usePortfolioSnapshot();
  const [eqFilter, setEqFilter] = useState<EqFilter>("all");

  const port = data?.portfolio;
  const stats = data?.stats ?? [];
  const year = new Date().getFullYear();
  const ytdSeries = useMemo(
    () => stats.filter((d) => d.date.startsWith(String(year))),
    [stats, year],
  );
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const weekSeries = useMemo(() => stats.filter((d) => d.date >= weekAgo), [stats, weekAgo]);

  const eqFlat = useMemo(() => {
    if (!port) return [];
    if (eqFilter === "all") return Object.values(port.eq).flat();
    return port.eq[eqFilter];
  }, [port, eqFilter]);

  const assets = useMemo(() => {
    if (!port) return [];
    const eqAll = Object.values(port.eq).flat();
    const s = port.summary;
    return [
      { label: "Futures, Bonds & FX", pct: s.futures, count: port.futures.length },
      { label: "Equities", pct: s.equity, count: eqAll.length },
      { label: "Options", pct: sumAbs(port.opts.filter((o) => !o.isNet)) || null, count: port.opts.filter((o) => !o.isNet).length },
      { label: "Cash", pct: s.cash, count: null },
    ];
  }, [port]);

  const themes = useMemo(() => {
    if (!port) return [];
    if (port.alloc.length) return port.alloc.map((a) => ({ label: a.name, pct: a.pct, count: null }));
    const names: Record<keyof EquityGroups, string> = {
      aerospace: "Aerospace & Defense",
      metals: "Metals & Mining",
      oil: "Oil & Gas / Energy",
      techAI: "Tech / AI",
      healthcare: "Healthcare",
      agriculture: "Agriculture",
      crypto: "Crypto",
      other: "Other",
    };
    return (Object.keys(port.eq) as Array<keyof EquityGroups>)
      .map((k) => ({ label: names[k], pct: sumAbs(port.eq[k]), count: port.eq[k].length }))
      .filter((t) => (t.pct ?? 0) > 0);
  }, [port]);

  const eqPills = EQ_LABELS.filter(
    (f) => f.id === "all" || (port && port.eq[f.id as keyof EquityGroups].length > 0),
  );

  const s = port?.summary;
  const latestStat = ytdSeries[ytdSeries.length - 1] ?? stats[stats.length - 1];

  return (
    <AppShell title="Macro Portfolio">
      <PageHeader
        eyebrow="Macro Ops Book"
        title="Macro Portfolio"
        description="Public snapshot of the Macro Ops book: performance (daily) and holdings (weekly). Notional weights only — no cost basis, size, or stops."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted flex items-center gap-1.5"
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        }
      />

      <div className="px-4 py-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
        <span className="px-1.5 py-0.5 border border-border rounded-sm">Performance · updated daily</span>
        <span className="px-1.5 py-0.5 border border-border rounded-sm">
          Holdings · {port?.asOf ? `as of ${port.asOf}` : "weekly snapshot"}
        </span>
      </div>

      {isLoading && (
        <div className="p-8 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading snapshot
        </div>
      )}
      {error && (
        <div className="m-4 text-xs text-destructive border border-destructive/40 bg-destructive/10 px-3 py-2">
          {(error as Error).message}
        </div>
      )}

      {port && s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
            <Kpi label="YTD Return" value={fp(s.ytd)} className={tone(s.ytd)} />
            <Kpi label="Rolling 12M" value={fp(s.r12m)} className={tone(s.r12m)} />
            <Kpi label="3YR CAGR" value={fp(s.cagr3yr)} className={tone(s.cagr3yr)} />
            <Kpi label="Total Notional" value={fp(s.notional)} />
            <Kpi label="Equity Exposure" value={fp(s.equity)} />
            <Kpi label="Futures / FX" value={fp(s.futures)} />
            <Kpi label="Capital at Risk" value={fp(s.capitalRisk)} className={s.capitalRisk != null && s.capitalRisk > 15 ? "text-destructive" : ""} />
            <Kpi label="Drawdown Risk" value={fp(s.ddRisk)} className={s.ddRisk != null && s.ddRisk > 20 ? "text-destructive" : ""} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
            <ChartPanel
              title={`YTD Return ${year}`}
              sub={latestStat ? `As of ${latestStat.date} · ${fp(latestStat.ytd)}` : "No series"}
              data={ytdSeries}
              pad={false}
            />
            <ChartPanel
              title="Last 7 days"
              sub={weekSeries.length ? `${weekSeries[0].date} – ${weekSeries[weekSeries.length - 1].date}` : "No series"}
              data={weekSeries}
              pad
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pb-3">
            <div className="hud-panel p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-3">Asset class</div>
              <BarList rows={assets} />
            </div>
            <div className="hud-panel p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-3">Thematic allocation</div>
              <BarList rows={themes} />
            </div>
          </div>

          <div className="px-3 pb-3 space-y-3">
            <div className="hud-panel">
              <div className="px-3 py-2 border-b border-border flex justify-between text-[11px] uppercase tracking-wider">
                <span className="font-semibold">Futures, Bonds & FX</span>
                <span className="text-muted-foreground font-mono">{fp(s.futures)}</span>
              </div>
              <PosTable rows={port.futures} />
            </div>

            <div className="hud-panel">
              <div className="px-3 py-2 border-b border-border flex justify-between items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Equities</span>
                <span className="text-[11px] text-muted-foreground font-mono">{fp(s.equity)}</span>
              </div>
              <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
                {eqPills.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setEqFilter(f.id)}
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                      eqFilter === f.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <PosTable rows={eqFlat} />
            </div>

            {port.opts.length > 0 && (
              <div className="hud-panel p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3">Options</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {port.opts.map((o) => (
                    <div key={`${o.ticker}-${o.name}`} className="border border-border p-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {o.isNet ? "Net" : o.isCall ? "Call" : o.isPut ? "Put" : "Leg"}
                      </div>
                      <div className="font-mono text-xs mt-1">{o.ticker}</div>
                      <div className={`font-mono text-sm mt-1 ${tone(o.notional)}`}>{fp(o.notional)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="px-4 pb-6 text-[10px] text-muted-foreground max-w-3xl leading-relaxed">
            Holdings and notional weights reflect the Macro Ops portfolio and may change without notice.
            Entries, exits, and execution details are not disclosed. General market commentary — not
            individualized investment advice.
          </p>
        </>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="px-4 py-3 border-r border-b border-border last:border-r-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-medium tabular-nums font-mono ${className}`}>{value}</div>
    </div>
  );
}

function ChartPanel({
  title,
  sub,
  data,
  pad,
}: {
  title: string;
  sub: string;
  data: Array<{ date: string; ytd: number }>;
  pad: boolean;
}) {
  const domain = useMemo(() => {
    const vals = data.map((d) => d.ytd).filter(Number.isFinite);
    if (!pad || !vals.length) return ["auto", "auto"] as const;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const range = hi - lo;
    const room = Math.max(range * 0.12, 0.4);
    return [lo - room, hi + room] as const;
  }, [data, pad]);

  return (
    <div className="hud-panel p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider">{title}</div>
      <div className="text-[10px] text-muted-foreground mb-2">{sub}</div>
      {data.length < 2 ? (
        <div className="h-[220px] grid place-items-center text-[11px] text-muted-foreground">No chart data</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 9 }} minTickGap={28} />
            <YAxis
              domain={domain}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 9 }}
              tickFormatter={(v: number) => `${Number(v).toFixed(1)}%`}
              width={48}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "YTD"]}
            />
            <Line type="monotone" dataKey="ytd" stroke="hsl(var(--success))" dot={pad} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
