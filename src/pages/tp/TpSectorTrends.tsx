import { useMemo } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useTpSectorTrend } from "@/hooks/tp/useTp";

function stateColor(s: string | null | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (v.includes("bull") || v === "long" || v === "risk_on") return "hsl(var(--pos-long))";
  if (v.includes("bear") || v === "short" || v === "risk_off") return "hsl(var(--pos-short))";
  return "hsl(var(--muted-foreground))";
}

function scoreBg(score: number | null | undefined): string {
  if (score == null) return "hsl(var(--muted) / 0.2)";
  const s = Math.max(-100, Math.min(100, score));
  const alpha = Math.min(0.85, Math.abs(s) / 100);
  return s >= 0
    ? `hsl(var(--pos-long) / ${alpha.toFixed(2)})`
    : `hsl(var(--pos-short) / ${alpha.toFixed(2)})`;
}

export default function TpSectorTrends() {
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: rows = [], isLoading, error } = useTpSectorTrend({
    start_date: start,
    limit: 5000,
  });

  // Pivot to latest + 5-row-ago per sector/timeframe
  const grid = useMemo(() => {
    const byKey = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = `${r.sector}|${r.timeframe ?? ""}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(r);
    }
    const out: {
      sector: string;
      timeframe: string;
      latest: typeof rows[number];
      prev?: typeof rows[number];
    }[] = [];
    for (const [k, arr] of byKey) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      const latest = arr[arr.length - 1];
      const prev = arr.length > 5 ? arr[arr.length - 6] : arr[0];
      const [sector, timeframe] = k.split("|");
      out.push({ sector, timeframe, latest, prev });
    }
    return out.sort((a, b) =>
      a.timeframe.localeCompare(b.timeframe) || a.sector.localeCompare(b.sector),
    );
  }, [rows]);

  return (
    <AppShell title="TP · Sector Trends">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2">
        <span className="hud-label">Latest sector signal snapshot · WoW change shown vs ~5 sessions ago</span>
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="p-3 space-y-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-surface/40 rounded-sm" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface/40 border-b border-border">
              <tr className="text-left">
                <Th>Sector</Th>
                <Th>Timeframe</Th>
                <Th>Signal</Th>
                <Th className="text-right">Score</Th>
                <Th className="text-right">Δ vs ~5d</Th>
                <Th className="text-right">Composite</Th>
                <Th className="text-right">Close</Th>
                <Th>As of</Th>
              </tr>
            </thead>
            <tbody>
              {grid.map(g => {
                const score = g.latest.signal_score;
                const prevScore = g.prev?.signal_score;
                const delta = score != null && prevScore != null ? score - prevScore : null;
                return (
                  <tr key={`${g.sector}-${g.timeframe}`} className="border-b border-border/60 hover:bg-surface/40">
                    <td className="px-3 py-2 font-mono text-[12px] font-semibold">{g.sector}</td>
                    <td className="px-3 py-2 hud-label">{g.timeframe || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] tracking-wider" style={{ color: stateColor(g.latest.signal_state) }}>
                      {(g.latest.signal_state ?? "—").toUpperCase()}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono tabular-nums"
                      style={{ background: scoreBg(score) }}
                    >
                      {score == null ? "—" : score.toFixed(2)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono tabular-nums"
                      style={{ color: delta == null ? "hsl(var(--muted-foreground))" : delta >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
                    >
                      {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {g.latest.composite_score == null ? "—" : g.latest.composite_score.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {g.latest.close_price == null ? "—" : g.latest.close_price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{g.latest.date}</td>
                  </tr>
                );
              })}
              {grid.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No rows.</td></tr>
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
