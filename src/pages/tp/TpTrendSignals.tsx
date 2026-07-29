// Trend Signals — per-symbol trend state grid (above SMAs, relative strength).
import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsScan } from "@/hooks/useMops";
import { CheckCircle2, XCircle } from "lucide-react";

const PRESETS = [
  { label: "SPX components (bullish stack)", conds: ["above_sma_50=1", "above_sma_150=1", "above_sma_200=1"] },
  { label: "Golden cross candidates", conds: ["ma_50_above_150=1", "above_sma_200=1"] },
  { label: "Outperformers vs SPX (63d)", conds: ["outperforming_spx_63d=1"] },
  { label: "Downtrend (below all MAs)", conds: ["above_sma_50=0", "above_sma_150=0", "above_sma_200=0"] },
];

export default function TpTrendSignals() {
  const [preset, setPreset] = useState(0);
  const { data: rows = [], isLoading, error } = useMopsScan({
    conditions: PRESETS[preset].conds,
    entity_type: "symbol",
    logic: "and",
    limit: 500,
  });

  return (
    <AppShell title="Trend Signals">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-1">Preset</span>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPreset(i)}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
              preset === i ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >{p.label}</button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{PRESETS[preset].conds.join(` AND `)}</span>
      </div>

      {error && <div className="px-3 py-3 text-xs text-destructive border-b border-border">{(error as Error).message}</div>}

      <div className="p-3">
        <div className="border border-border rounded-sm bg-surface/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="hud-label">Matches</span>
            <span className="text-[10px] text-muted-foreground">{isLoading ? "…" : `${rows.length} symbols`}</span>
          </div>
          <div className="max-h-[75vh] overflow-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1 p-2">
            {rows.map((r, i) => {
              const passed = r.value === true || r.value === "true" || r.value === 1;
              return (
                <div
                  key={`${r.entity}-${i}`}
                  className="border border-border rounded-sm bg-background px-2 py-1.5 flex items-center gap-2"
                >
                  {passed ? <CheckCircle2 className="h-3 w-3 text-[hsl(var(--pos-long))]" /> : <XCircle className="h-3 w-3 text-[hsl(var(--pos-short))]" />}
                  <span className="font-mono text-xs font-semibold">{r.entity}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.date}</span>
                </div>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <div className="col-span-full px-3 py-8 text-center text-muted-foreground text-xs">no matches</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
