import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useTpTrendSignals } from "@/hooks/tp/useTp";

const TIMEFRAMES = ["", "daily", "weekly", "monthly"];
const STATES = ["", "bullish", "bearish", "neutral", "long", "short"];

function stateColor(s: string | null | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (v.includes("bull") || v === "long") return "hsl(var(--pos-long))";
  if (v.includes("bear") || v === "short") return "hsl(var(--pos-short))";
  return "hsl(var(--muted-foreground))";
}

export default function TpTrendSignals() {
  const [timeframe, setTimeframe] = useState("");
  const [signalState, setSignalState] = useState("");

  const { data: rows = [], isLoading, error } = useTpTrendSignals({
    timeframe: timeframe || undefined,
    signal_state: signalState || undefined,
    limit: 2000,
  });

  const latest = useMemo(() => {
    const bySymbol = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      const key = `${r.symbol}|${r.timeframe ?? ""}`;
      const prev = bySymbol.get(key);
      if (!prev || r.date > prev.date) bySymbol.set(key, r);
    }
    return [...bySymbol.values()].sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
  }, [rows]);

  const dist = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of latest) {
      const k = (r.signal_state ?? "unknown").toLowerCase();
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [latest]);

  return (
    <AppShell title="TP · Trend Signals">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-1">
          <span className="hud-label mr-1">Timeframe</span>
          {TIMEFRAMES.map(t => (
            <button
              key={t || "all"}
              onClick={() => setTimeframe(t)}
              className={`px-2 py-1 rounded-sm border ${
                timeframe === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {t || "All"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="hud-label mr-1">State</span>
          {STATES.map(s => (
            <button
              key={s || "all"}
              onClick={() => setSignalState(s)}
              className={`px-2 py-1 rounded-sm border ${
                signalState === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-border bg-surface/30">
        <Stat label="Rows" value={String(rows.length)} />
        <Stat label="Distinct Symbols" value={String(latest.length)} />
        {dist.slice(0, 3).map(([k, v]) => (
          <Stat key={k} label={k} value={String(v)} />
        ))}
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="p-3 space-y-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse bg-surface/40 rounded-sm" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface/40 border-b border-border">
              <tr className="text-left">
                <Th>Symbol</Th>
                <Th>Sector</Th>
                <Th>Timeframe</Th>
                <Th>Signal</Th>
                <Th>Change</Th>
                <Th>Since</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Close</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {latest.map(r => (
                <tr key={`${r.symbol}-${r.timeframe}-${r.date}`} className="border-b border-border/60 hover:bg-surface/40">
                  <td className="px-3 py-2 font-mono text-[12px] font-semibold">{r.symbol}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.sector ?? "—"}</td>
                  <td className="px-3 py-2 hud-label">{r.timeframe ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] tracking-wider" style={{ color: stateColor(r.signal_state) }}>
                    {(r.signal_state ?? "—").toUpperCase()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{r.signal_change ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.signal_start_date ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {r.signal_score == null ? "—" : r.signal_score.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {r.close_price == null ? "—" : r.close_price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.date}</td>
                </tr>
              ))}
              {latest.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 hud-label font-medium ${className}`}>{children}</th>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
