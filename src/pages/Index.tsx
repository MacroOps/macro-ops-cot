import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { MarketCard } from "@/components/hud/MarketCard";
import { SECTORS, type Sector } from "@/lib/mockData";
import { useDashboardData } from "@/hooks/useDashboardData";

const Index = () => {
  const { data, isLoading, error } = useDashboardData();
  const markets = data?.markets ?? [];
  const [sector, setSector] = useState<Sector | "All">("All");

  const filtered = useMemo(
    () => sector === "All" ? markets : markets.filter(m => m.sector === sector),
    [markets, sector]
  );

  const stats = useMemo(() => {
    const long = markets.filter(m => m.netSpecPct3y >= 85).length;
    const short = markets.filter(m => m.netSpecPct3y <= 15).length;
    return { tracked: markets.length, long, short };
  }, [markets]);

  return (
    <AppShell title="Global Positioning Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border bg-surface/30">
        <Stat label="Markets Tracked" value={stats.tracked.toString()} />
        <Stat label="Crowded Long ≥85" value={stats.long.toString()} accent="long" />
        <Stat label="Crowded Short ≤15" value={stats.short.toString()} accent="short" />
        <Stat label="Report" value={data?.reportDate ?? "—"} mono />
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        <span className="hud-label mr-2 shrink-0">Sector</span>
        {(["All", ...SECTORS] as const).map(s => (
          <button
            key={s}
            onClick={() => setSector(s as Sector | "All")}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors shrink-0 ${
              sector === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
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
        Live from backend · Percentiles are placeholder pending 3y rolling history.
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

export default Index;
