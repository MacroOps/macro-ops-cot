// Sector Trends — rank sectors by trend strength signal.
import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsRank } from "@/hooks/useMops";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const KEYS = [
  { key: "pct_above_sma_50", label: "% > 50D MA" },
  { key: "pct_above_sma_200", label: "% > 200D MA" },
  { key: "pct_outperforming_spx_63d", label: "% outperforming SPX (63d)" },
  { key: "pct_new_highs_252d", label: "% at 52w highs" },
];

export default function TpSectorTrends() {
  const [key, setKey] = useState(KEYS[0].key);
  const { data: rows = [], isLoading, error } = useMopsRank({ key, entity_type: "sector", order: "desc", limit: 30 });

  const nums = rows.map(r => typeof r.value === "number" ? r.value : Number(r.value)).filter(n => !Number.isNaN(n));
  const max = Math.max(100, ...nums);

  return (
    <AppShell title="Sector Trends">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-1">Metric</span>
        {KEYS.map(k => (
          <button
            key={k.key}
            onClick={() => setKey(k.key)}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
              key === k.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >{k.label}</button>
        ))}
      </div>

      {error && <div className="px-3 py-3 text-xs text-destructive border-b border-border">{(error as Error).message}</div>}

      <div className="p-3 grid gap-2">
        {rows.map((r, i) => {
          const v = typeof r.value === "number" ? r.value : Number(r.value);
          const pct = Number.isNaN(v) ? 0 : Math.max(2, Math.min(100, (v / max) * 100));
          return (
            <div key={`${r.entity}-${i}`} className="border border-border rounded-sm bg-surface/30 px-3 py-2 flex items-center gap-3">
              <span className="w-6 text-xs text-muted-foreground tabular-nums">{r.rank ?? i + 1}</span>
              <span className="font-mono text-sm font-semibold w-40 truncate">{r.entity}</span>
              <div className="flex-1 h-3 bg-background border border-border rounded-sm overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%`, opacity: 0.75 }} />
              </div>
              <span className="w-20 text-right font-mono text-xs tabular-nums">{Number.isNaN(v) ? String(r.value) : `${fmt.format(v)}`}</span>
            </div>
          );
        })}
        {isLoading && <div className="h-40 animate-pulse bg-surface/40 rounded-sm" />}
        {!isLoading && rows.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-6">no data for this signal</div>
        )}
      </div>
    </AppShell>
  );
}
