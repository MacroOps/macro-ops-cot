import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Star, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/hud/AppShell";
import { SECTORS, type Sector, type MarketSnapshot } from "@/lib/mockData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Filter = Sector | "All" | "Extremes" | "Watchlist";
type SortKey = "extremity" | "wow" | "net3y" | "wkpct" | "symbol";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat("en-US");

function bandLabel(score: number) {
  const a = Math.abs(score);
  if (a >= 75) return score >= 0 ? "EUPHORIC" : "CAPITULATION";
  if (a >= 50) return score >= 0 ? "CROWDED LONG" : "CROWDED SHORT";
  if (a >= 25) return score >= 0 ? "LEAN LONG" : "LEAN SHORT";
  return "NEUTRAL";
}

function tierColor(score: number): string {
  const a = Math.abs(score);
  if (a >= 75) return score >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))";
  if (a >= 50) return score >= 0 ? "hsl(var(--pos-long) / 0.78)" : "hsl(var(--pos-short) / 0.78)";
  if (a >= 25) return score >= 0 ? "hsl(var(--pos-long) / 0.55)" : "hsl(var(--pos-short) / 0.55)";
  return "hsl(var(--muted-foreground))";
}

const Index = () => {
  const { data, isLoading, error } = useDashboardData();
  const markets = data?.markets ?? [];
  const [filter, setFilter] = useState<Filter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("extremity");
  const { ids } = useWatchlist();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    const t = toast.loading("Refreshing CFTC data…");
    try {
      // Only pull the last ~3 weeks on manual refresh — anything longer
      // exceeds the 150s edge-function idle timeout (45 markets × 5 feeds).
      const since = new Date();
      since.setDate(since.getDate() - 21);
      const { data: res, error: err } = await supabase.functions.invoke("ingest-cftc", {
        body: { since: since.toISOString().slice(0, 10) },
      });
      if (err) throw err;
      await qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      await qc.invalidateQueries({ queryKey: ["sector-data"] });
      const wrote = (res as { rows_written?: number })?.rows_written ?? 0;
      toast.success(
        wrote > 0 ? `Refreshed — ${wrote} new rows` : "Up to date — no new CFTC reports upstream",
        { id: t },
      );
    } catch (e) {
      toast.error(`Refresh failed: ${(e as Error).message}`, { id: t });
    } finally {
      setRefreshing(false);
    }
  }

  const stats = useMemo(() => {
    const exLong = markets.filter(m => m.extremityScore >= 75).length;
    const exShort = markets.filter(m => m.extremityScore <= -75).length;
    const crowdedLong = markets.filter(m => m.extremityScore >= 50 && m.extremityScore < 75).length;
    const crowdedShort = markets.filter(m => m.extremityScore <= -50 && m.extremityScore > -75).length;
    return { tracked: markets.length, exLong, exShort, crowdedLong, crowdedShort };
  }, [markets]);

  const filtered = useMemo(() => {
    let rows = markets;
    if (filter === "Extremes") rows = rows.filter(m => Math.abs(m.extremityScore) >= 70);
    else if (filter === "Watchlist") rows = rows.filter(m => m.id && ids.has(m.id));
    else if (filter !== "All") rows = rows.filter(m => m.sector === filter);

    const sorted = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "extremity": return b.extremityScore - a.extremityScore;
        case "wow":       return Math.abs(b.wowChange) - Math.abs(a.wowChange);
        case "net3y":     return Math.abs(b.netSpecPct3y - 50) - Math.abs(a.netSpecPct3y - 50);
        case "wkpct":     return Math.abs(b.weekChangePct) - Math.abs(a.weekChangePct);
        case "symbol":    return a.symbol.localeCompare(b.symbol);
      }
    });
    return sorted;
  }, [markets, filter, sortKey, ids]);

  return (
    <AppShell title="Global Positioning Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-border bg-surface/30">
        <Stat label="Markets" value={stats.tracked.toString()} />
        <Stat label="Euphoric ≥75" value={stats.exLong.toString()} accent="long" />
        <Stat label="Capitulation ≤−75" value={stats.exShort.toString()} accent="short" />
        <Stat label="Crowded 50–74" value={`${stats.crowdedLong}↑ / ${stats.crowdedShort}↓`} />
        <div className="relative">
          <Stat label="Report" value={data?.reportDate ?? "—"} mono />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh CFTC data"
            className="absolute top-1.5 right-1.5 p-1 rounded-sm border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>


      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        <span className="hud-label mr-2 shrink-0">Filter</span>
        {(["All", "Extremes", "Watchlist", ...SECTORS] as const).map(s => {
          const active = filter === s;
          const isExtremes = s === "Extremes";
          return (
            <button
              key={s}
              onClick={() => setFilter(s as Filter)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors shrink-0 ${
                active
                  ? isExtremes
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-primary bg-primary text-primary-foreground"
                  : isExtremes
                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                    : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
              }`}
            >
              {s}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <span className="hud-label mr-1">Sort</span>
          {([
            ["extremity", "Extremity"],
            ["wow", "Δ WoW"],
            ["net3y", "Net 3Y"],
            ["wkpct", "Wk %"],
            ["symbol", "A–Z"],
          ] as [SortKey, string][]).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                sortKey === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          Failed to load market data: {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="p-3 space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-surface/40 rounded-sm" />
          ))}
        </div>
      ) : (
        <PositioningTable rows={filtered} />
      )}

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        Live · Extremity = 0.40·NetSpec6M% + 0.25·NetSpec3Y% + 0.20·z(WoW Δ).
        Click any row for full asset detail.
      </div>
    </AppShell>
  );
};

function Stat({ label, value, accent, mono }: { label: string; value: string; accent?: "long" | "short"; mono?: boolean }) {
  const color = accent === "long" ? "text-pos-long" : accent === "short" ? "text-pos-short" : "text-surface-foreground";
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${mono ? "font-mono" : ""} ${color}`}>{value}</div>
    </div>
  );
}

function PositioningTable({ rows }: { rows: MarketSnapshot[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-surface/40 border-b border-border">
          <tr className="text-left">
            <Th className="w-8 text-center">#</Th>
            <Th>Market</Th>
            <Th className="hidden md:table-cell">Sector</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Wk %</Th>
            <Th className="w-[200px]">Net Spec · 3Y %ile</Th>
            <Th className="w-[220px]">Extremity</Th>
            <Th className="hidden lg:table-cell">Band</Th>
            <Th className="text-right hidden xl:table-cell">Net</Th>
            <Th className="text-right">Δ WoW</Th>
            <Th className="w-6"></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <Row key={m.symbol} m={m} idx={i + 1} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="p-6 text-center text-muted-foreground text-xs">
                No markets match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 hud-label font-medium ${className}`}>{children}</th>
  );
}

function Row({ m, idx }: { m: MarketSnapshot; idx: number }) {
  const up = m.weekChangePct >= 0;
  const { user } = useAuth();
  const { ids, add, remove } = useWatchlist();
  const starred = m.id ? ids.has(m.id) : false;

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error("Sign in to save markets"); return; }
    if (!m.id) return;
    if (starred) remove.mutate(m.id);
    else add.mutate(m.id);
  }

  return (
    <tr className="border-b border-border/60 hover:bg-surface/40 transition-colors group">
      <td className="px-3 py-2 text-center font-mono tabular-nums text-[10px] text-muted-foreground">{idx}</td>
      <td className="px-3 py-2">
        <Link to={`/asset/${m.symbol}`} className="flex flex-col">
          <span className="font-mono text-[12px] font-semibold text-surface-foreground group-hover:text-primary">
            {m.symbol}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{m.name}</span>
        </Link>
      </td>
      <td className="px-3 py-2 hidden md:table-cell">
        <span className="hud-label">{m.sector}</span>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-surface-foreground">
        {fmt.format(m.price)}
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className="inline-flex items-center justify-end gap-0.5 font-mono tabular-nums text-[11px]"
          style={{ color: up ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? "+" : ""}{m.weekChangePct.toFixed(2)}%
        </span>
      </td>
      <td className="px-3 py-2">
        <PercentileBar value={m.netSpecPct3y} />
      </td>
      <td className="px-3 py-2">
        <ExtremityBar score={m.extremityScore} />
      </td>
      <td className="px-3 py-2 hidden lg:table-cell">
        <span
          className="font-mono text-[10px] tracking-wider"
          style={{ color: tierColor(m.extremityScore) }}
        >
          {bandLabel(m.extremityScore)}
        </span>
      </td>
      <td
        className="px-3 py-2 text-right font-mono tabular-nums hidden xl:table-cell"
        style={{ color: m.netSpecContracts >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
      >
        {m.netSpecContracts >= 0 ? "+" : ""}{fmtInt.format(m.netSpecContracts)}
      </td>
      <td
        className="px-3 py-2 text-right font-mono tabular-nums"
        style={{ color: m.wowChange >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
      >
        {m.wowChange >= 0 ? "+" : ""}{fmtInt.format(m.wowChange)}
      </td>
      <td className="px-2 py-2">
        <button
          onClick={toggle}
          className="p-1 rounded-sm hover:bg-muted/40 transition-colors"
          aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star className={`h-3.5 w-3.5 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      </td>
    </tr>
  );
}

// 0-100 percentile bar with extreme zone shading
function PercentileBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const extreme = v >= 85 || v <= 15;
  const fill =
    v >= 85 ? "hsl(var(--pos-long))"
    : v <= 15 ? "hsl(var(--pos-short))"
    : "hsl(var(--chart-ink))";
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 h-1.5 overflow-hidden rounded-sm"
        style={{ background: "hsl(var(--muted) / 0.4)", border: "1px solid hsl(var(--border))" }}
      >
        <div className="absolute inset-y-0 left-0 w-[15%]" style={{ background: "hsl(var(--pos-short) / 0.15)" }} />
        <div className="absolute inset-y-0 right-0 w-[15%]" style={{ background: "hsl(var(--pos-long) / 0.15)" }} />
        <div className="absolute inset-y-0 left-0" style={{ width: `${v}%`, background: fill }} />
      </div>
      <span
        className="font-mono tabular-nums text-[11px] w-7 text-right"
        style={{
          color: extreme
            ? (v >= 85 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))")
            : "hsl(var(--surface-foreground))",
          fontWeight: extreme ? 600 : 400,
        }}
      >
        {v.toFixed(0)}
      </span>
    </div>
  );
}

// Diverging extremity bar centered on 0, range -100..+100
function ExtremityBar({ score }: { score: number }) {
  const s = Math.max(-100, Math.min(100, score));
  const pct = Math.abs(s) / 2; // 0..50 width
  const positive = s >= 0;
  const color = tierColor(s);
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 h-2 rounded-sm overflow-hidden"
        style={{ background: "hsl(var(--muted) / 0.35)", border: "1px solid hsl(var(--border))" }}
      >
        {/* center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: "hsl(var(--border))" }} />
        {/* fill */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: positive ? "50%" : `${50 - pct}%`,
            width: `${pct}%`,
            background: color,
          }}
        />
        {/* extreme tick marks at ±75 */}
        <div className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: "12.5%", background: "hsl(var(--pos-short))" }} />
        <div className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: "87.5%", background: "hsl(var(--pos-long))" }} />
      </div>
      <span
        className="font-mono tabular-nums text-[11px] w-9 text-right"
        style={{ color, fontWeight: Math.abs(s) >= 50 ? 600 : 400 }}
      >
        {s > 0 ? "+" : ""}{s.toFixed(0)}
      </span>
    </div>
  );
}

export default Index;
