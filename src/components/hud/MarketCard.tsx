import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PercentileGauge } from "./PercentileGauge";
import type { MarketSnapshot } from "@/lib/mockData";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat("en-US");

export function MarketCard({ m }: { m: MarketSnapshot }) {
  const up = m.weekChangePct >= 0;
  return (
    <Link
      to={`/asset/${m.symbol}`}
      className="hud-panel p-3 flex flex-col gap-2.5 hover:border-primary/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
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
          <div className={`flex items-center justify-end gap-0.5 text-[10px] font-mono tabular-nums ${up ? "text-success" : "text-destructive"}`}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? "+" : ""}{m.weekChangePct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="hud-divider" />

      <div className="flex flex-col gap-2">
        <PercentileGauge value={m.largeSpecPercentile} label="Large Specs (Legacy)" />
        <PercentileGauge value={m.leveragedFundPercentile} label="Lev Funds (Disagg)" />
      </div>

      <div className="hud-divider" />

      <div className="flex items-center justify-between text-[10px]">
        <div className="flex flex-col">
          <span className="hud-label">Net</span>
          <span className={`font-mono tabular-nums ${m.netContracts >= 0 ? "text-pos-long" : "text-pos-short"}`}>
            {m.netContracts >= 0 ? "+" : ""}{fmtInt.format(m.netContracts)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="hud-label">Δ WoW</span>
          <span className={`font-mono tabular-nums ${m.wowChange >= 0 ? "text-pos-long" : "text-pos-short"}`}>
            {m.wowChange >= 0 ? "+" : ""}{fmtInt.format(m.wowChange)}
          </span>
        </div>
      </div>
    </Link>
  );
}
