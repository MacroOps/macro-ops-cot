import { DeltaCell } from "@/components/hud/SignalBadge";
import { useSectorOverview, type SectorOverviewRow } from "@/hooks/useSectorOverview";
import { cn } from "@/lib/utils";

function Row({ r, emphasis }: { r: SectorOverviewRow; emphasis?: boolean }) {
  return (
    <tr className={cn("border-t border-border/50", emphasis && "bg-muted/30 font-semibold border-b-2 border-border")}>
      <td className="py-1.5 pl-2 text-left">{r.name}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{r.total}</td>
      <td className="py-1.5 text-right font-mono tabular-nums text-success">{r.bullishLT}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBullishLT}%</td>
      <td className="py-1.5 text-right"><DeltaCell value={r.bullishLTChg || null} /></td>
      <td className="py-1.5 text-right font-mono tabular-nums text-destructive">{r.bearishLT}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBearishLT}%</td>
      <td className="py-1.5 text-right"><DeltaCell value={r.bearishLTChg || null} /></td>
      <td className="py-1.5 text-right font-mono tabular-nums text-success">{r.bullishST}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBullishST}%</td>
      <td className="py-1.5 text-right"><DeltaCell value={r.bullishSTChg || null} /></td>
      <td className="py-1.5 text-right font-mono tabular-nums text-destructive">{r.bearishST}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBearishST}%</td>
      <td className="py-1.5 text-right pr-2"><DeltaCell value={r.bearishSTChg || null} /></td>
    </tr>
  );
}

export function SectorOverviewTable() {
  const { data, isLoading, error } = useSectorOverview();

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
          S&P 500 Sector Overview
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {data ? `as of ${data.asOf} · 5-day chg vs ${data.priorDate}` : ""}
        </div>
      </div>

      {isLoading && <div className="p-4 text-xs text-muted-foreground">Loading sector breadth…</div>}
      {error && <div className="p-4 text-xs text-destructive">Failed to load: {(error as Error).message}</div>}

      {data && (
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-xs min-w-[1080px]">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-1 pl-2 font-medium">Sector</th>
                <th className="text-right py-1 font-medium">Total</th>
                <th className="text-right py-1 font-medium"># Bullish LT</th>
                <th className="text-right py-1 font-medium">% Bullish LT</th>
                <th className="text-right py-1 font-medium">5-Day Chg</th>
                <th className="text-right py-1 font-medium"># Bearish LT</th>
                <th className="text-right py-1 font-medium">% Bearish LT</th>
                <th className="text-right py-1 font-medium">5-Day Chg</th>
                <th className="text-right py-1 font-medium"># Bullish ST</th>
                <th className="text-right py-1 font-medium">% Bullish ST</th>
                <th className="text-right py-1 font-medium">5-Day Chg</th>
                <th className="text-right py-1 font-medium"># Bearish ST</th>
                <th className="text-right py-1 font-medium">% Bearish ST</th>
                <th className="text-right py-1 font-medium pr-2">5-Day Chg</th>
              </tr>
            </thead>
            <tbody>
              <Row r={data.total} emphasis />
              {data.sectors.map((s) => (
                <Row key={s.code} r={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
