// Rankings — rank entities by any signal value with bar-embedded rows.
import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsRank, useSignalKeys } from "@/hooks/useMops";
import { breadthScopeWarning, symbolEquivalent } from "@/lib/mops/signalScope";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function Rankings() {
  const [key, setKey] = useState<string>("pct_above_sma_50");
  const [entityType, setEntityType] = useState<string>("sector");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [limit, setLimit] = useState(50);

  const { data: keys = [] } = useSignalKeys();
  const { data: rows = [], isLoading, error } = useMopsRank({ key, entity_type: entityType, order, limit });

  const scopeWarning = entityType === "symbol" ? breadthScopeWarning(key) : null;


  const nums = rows.map(r => typeof r.value === "number" ? r.value : Number(r.value)).filter(n => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1;
  const min = nums.length ? Math.min(...nums) : 0;
  const span = max - min || 1;

  return (
    <AppShell title="Rankings">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-1">Signal</span>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          list="rank-keys"
          className="h-7 w-64 bg-background border border-border rounded-sm px-2 font-mono"
        />
        <datalist id="rank-keys">{keys.map(k => <option key={k} value={k} />)}</datalist>

        <span className="hud-label ml-3 mr-1">Type</span>
        <select value={entityType} onChange={e => setEntityType(e.target.value)} className="h-7 bg-background border border-border rounded-sm px-2">
          {["sector", "industry", "sub_industry", "index", "symbol"].map(t => <option key={t}>{t}</option>)}
        </select>

        <span className="hud-label ml-3 mr-1">Order</span>
        {(["desc", "asc"] as const).map(o => (
          <button key={o} onClick={() => setOrder(o)} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${order === o ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>{o}</button>
        ))}

        <span className="hud-label ml-3 mr-1">Limit</span>
        <input type="number" value={limit} min={10} max={500} onChange={e => setLimit(Number(e.target.value) || 50)} className="h-7 w-16 bg-background border border-border rounded-sm px-2 tabular-nums" />
      </div>

      {scopeWarning && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border bg-surface/20">
          {scopeWarning}
          {symbolEquivalent(key) && (
            <button onClick={() => setKey(symbolEquivalent(key)!)} className="ml-2 underline hover:text-foreground">
              switch signal
            </button>
          )}
        </div>
      )}

      {error && <div className="px-3 py-3 text-xs text-destructive border-b border-border">{(error as Error).message}</div>}

      <div className="p-3">
        <div className="border border-border rounded-sm bg-surface/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="hud-label">{key} · {entityType}s ({order})</span>
            <span className="text-[10px] text-muted-foreground">{isLoading ? "…" : `${rows.length} rows`}</span>
          </div>
          <div className="max-h-[75vh] overflow-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-normal w-10">#</th>
                  <th className="px-3 py-2 font-normal">Entity</th>
                  <th className="px-3 py-2 font-normal w-1/2">Value</th>
                  <th className="px-3 py-2 font-normal text-right w-24">Raw</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const v = typeof r.value === "number" ? r.value : Number(r.value);
                  const w = Number.isNaN(v) ? 0 : Math.max(2, ((v - min) / span) * 100);
                  return (
                    <tr key={`${r.entity}-${i}`} className="border-b border-border/50 hover:bg-surface/40">
                      <td className="px-3 py-1.5 text-muted-foreground">{r.rank ?? i + 1}</td>
                      <td className="px-3 py-1.5 font-mono font-semibold">{r.entity}</td>
                      <td className="px-3 py-1.5">
                        <div className="h-2 bg-background border border-border rounded-sm relative overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${w}%`, opacity: 0.75 }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{Number.isNaN(v) ? String(r.value) : fmt.format(v)}</td>
                    </tr>
                  );
                })}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">no data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
