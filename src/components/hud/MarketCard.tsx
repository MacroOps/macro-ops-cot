import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Star } from "lucide-react";
import { PercentileGauge } from "./PercentileGauge";
import { ExtremityBadge } from "./ExtremityBadge";
import type { MarketSnapshot } from "@/lib/mockData";
import { useWatchlist } from "@/hooks/useWatchlist";
import { toast } from "sonner";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat("en-US");

export function MarketCard({ m }: { m: MarketSnapshot }) {
  const up = m.weekChangePct >= 0;
  const { ids, add, remove, signedIn } = useWatchlist();
  const starred = m.id ? ids.has(m.id) : false;

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) { toast.error("Log in to save markets"); return; }
    if (!m.id) return;
    if (starred) remove.mutate(m.id);
    else add.mutate(m.id);
  }

  return (
    <Link
      to={`/asset/${m.symbol}`}
      className="hud-panel p-3 flex flex-col gap-2.5 hover:border-primary/60 transition-colors group relative"
    >
      <button
        onClick={toggle}
        className="absolute top-2 right-2 p-1 rounded-sm hover:bg-muted/40 transition-colors"
        aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}
      >
        <Star className={`h-3.5 w-3.5 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`} />
      </button>

      <div className="flex items-start justify-between gap-2 pr-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-surface-foreground">{m.symbol}</span>
            <span className="hud-label">{m.sector}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{m.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs tabular-nums text-surface-foreground">
            {fmt.format(m.price)}
          </div>
          <div
            className="flex items-center justify-end gap-0.5 text-[10px] font-mono tabular-nums"
            style={{ color: up ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? "+" : ""}{m.weekChangePct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="hud-chart p-2.5 flex flex-col gap-2">
        <ExtremityBadge score={m.extremityScore} band={m.extremityBand} />
        <PercentileGauge value={m.netSpecPct3y} label="Net Specs · 3Y" emphasize />
        <PercentileGauge value={m.netSpecPct6m} label="Net Specs · 6M" />
        {m.netLevPct6m != null && (
          <PercentileGauge value={m.netLevPct6m} label="Net Lev Funds · 6M" />
        )}
        {m.netAssetMgrPct6m != null && (
          <PercentileGauge value={m.netAssetMgrPct6m} label="Net Asset Mgrs · 6M" />
        )}

        <div className="border-t border-chart-grid pt-2 flex items-center justify-between text-[10px]">
          <div className="flex flex-col">
            <span className="hud-label">Net</span>
            <span
              className="font-mono tabular-nums"
              style={{ color: m.netSpecContracts >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
            >
              {m.netSpecContracts >= 0 ? "+" : ""}{fmtInt.format(m.netSpecContracts)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="hud-label">Δ WoW</span>
            <span
              className="font-mono tabular-nums"
              style={{ color: m.wowChange >= 0 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))" }}
            >
              {m.wowChange >= 0 ? "+" : ""}{fmtInt.format(m.wowChange)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

