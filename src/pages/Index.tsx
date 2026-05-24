import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { MarketCard } from "@/components/hud/MarketCard";
import { SECTORS, type Sector } from "@/lib/mockData";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { MarketSnapshot } from "@/lib/mockData";

type Filter = Sector | "All" | "Extremes";

const Index = () => {
  const { data, isLoading, error } = useDashboardData();
  const markets = data?.markets ?? [];
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    if (filter === "All") return markets;
    if (filter === "Extremes") {
      return [...markets]
        .filter(m => Math.abs(m.extremityScore) >= 50)
        .sort((a, b) => b.extremityScore - a.extremityScore);
    }
    return markets.filter(m => m.sector === filter);
  }, [markets, filter]);

  const stats = useMemo(() => {
    const exLong = markets.filter(m => m.extremityScore >= 75);
    const exShort = markets.filter(m => m.extremityScore <= -75);
    const crowdedLong = markets.filter(m => m.extremityScore >= 50 && m.extremityScore < 75);
    const crowdedShort = markets.filter(m => m.extremityScore <= -50 && m.extremityScore > -75);
    // Sort all extremes from most euphoric → most crowded short
    const allExtremes = [...exLong, ...crowdedLong, ...crowdedShort, ...exShort]
      .sort((a, b) => b.extremityScore - a.extremityScore);
    return {
      tracked: markets.length,
      exLong: exLong.length,
      exShort: exShort.length,
      crowdedLong: crowdedLong.length,
      crowdedShort: crowdedShort.length,
      allExtremes,
    };
  }, [markets]);

  return (
    <AppShell title="Global Positioning Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border bg-surface/30">
        <Stat label="Markets Tracked" value={stats.tracked.toString()} />
        <ExtremesStat
          exLong={stats.exLong}
          exShort={stats.exShort}
          allExtremes={stats.allExtremes}
        />
        <Stat label="Crowded 50–74" value={`${stats.crowdedLong}↑ / ${stats.crowdedShort}↓`} />
        <Stat label="Report" value={data?.reportDate ?? "—"} mono />
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        <span className="hud-label mr-2 shrink-0">Filter</span>
        {(["All", "Extremes", ...SECTORS] as const).map(s => {
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
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          Failed to load market data: {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border p-px">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="hud-panel p-3 h-40 animate-pulse bg-surface/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border p-px">
          {filtered.map(m => (
            <MarketCard key={m.symbol} m={m} />
          ))}
        </div>
      )}

      <div className="px-3 py-4 text-[10px] text-muted-foreground tracking-wider">
        Live from backend · Extremity Score = 0.40·NetSpec6M% + 0.25·NetSpec3Y% + 0.20·z(WoW Δ).
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

function ExtremesStat({
  exLong,
  exShort,
  allExtremes,
}: {
  exLong: number;
  exShort: number;
  allExtremes: MarketSnapshot[];
}) {
  const pulse = exLong + exShort > 0;
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0 min-w-0">
      <div className="hud-label">Extremes ≥75</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums flex items-baseline gap-2 ${pulse ? "animate-extremity-pulse" : ""}`}>
        <span className="text-pos-long">{exLong}↑</span>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-pos-short">{exShort}↓</span>
      </div>
      {allExtremes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
          {allExtremes.map(m => {
            const color =
              m.extremityScore >= 75
                ? "text-pos-long"
                : m.extremityScore <= -75
                  ? "text-pos-short"
                  : m.extremityScore > 0
                    ? "text-pos-long/70"
                    : "text-pos-short/70";
            return (
              <span
                key={m.symbol}
                className={`inline-flex items-center gap-1 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-sm bg-surface border border-border ${color}`}
                title={`${m.name} · Score ${m.extremityScore > 0 ? "+" : ""}${m.extremityScore}`}
              >
                {m.symbol}
                <span className="opacity-70">{m.extremityScore > 0 ? "+" : ""}{m.extremityScore}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Index;
