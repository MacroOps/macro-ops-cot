// Multi-condition scanner. Build predicates like `pct_above_sma_50>60` and
// combine with AND/OR. Displays matching entities with latest value.
import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsScan } from "@/hooks/useMops";
import { X, Plus, Search } from "lucide-react";

const PRESETS = [
  { label: "Bullish trend (SPX components)", conds: ["above_sma_50=true", "above_sma_200=true", "outperforming_spx_63d=true"], t: "symbol" },
  { label: "Fresh breakouts", conds: ["new_highs_252d=true"], t: "symbol" },
  { label: "Risk-Off regime hits", conds: ["risk_lt_state=Risk-Off"], t: "index" },
  { label: "Weak below MAs", conds: ["above_sma_50=false", "above_sma_200=false"], t: "symbol" },
];

export default function Scanner() {
  const [conds, setConds] = useState<string[]>(PRESETS[0].conds);
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [entityType, setEntityType] = useState<string>(PRESETS[0].t);
  const [draft, setDraft] = useState<string>("");

  const { data: rows = [], isLoading, error, refetch, isFetching } = useMopsScan({
    conditions: conds, logic, entity_type: entityType, limit: 500,
  });

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setConds([...conds, v]);
    setDraft("");
  };
  const remove = (i: number) => setConds(conds.filter((_, j) => j !== i));

  return (
    <AppShell title="Scanner">
      <div className="border-b border-border bg-surface/30 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="hud-label mr-1">Presets</span>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setConds(p.conds); setEntityType(p.t); }}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {conds.map((c, i) => (
            <span key={i} className="text-[11px] font-mono bg-background border border-border rounded-sm pl-2 pr-1 py-1 inline-flex items-center gap-1">
              {c}
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="signal_key>value"
            className="h-7 w-56 bg-background border border-border rounded-sm px-2 text-xs font-mono"
          />
          <button onClick={add} className="h-7 px-2 border border-border rounded-sm text-xs hover:border-muted-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> add
          </button>
          <div className="mx-2 h-5 w-px bg-border" />
          <span className="hud-label mr-1">Logic</span>
          {(["and", "or"] as const).map(l => (
            <button
              key={l}
              onClick={() => setLogic(l)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${logic === l ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
          <span className="hud-label ml-3 mr-1">Type</span>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="h-7 bg-background border border-border rounded-sm px-2 text-xs"
          >
            {["symbol", "index", "sector", "industry", "sub_industry"].map(t => <option key={t}>{t}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className="ml-auto h-7 px-3 border border-primary bg-primary text-primary-foreground rounded-sm text-xs inline-flex items-center gap-1"
          >
            <Search className="h-3 w-3" /> {isFetching ? "…" : "scan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      <div className="p-3">
        <div className="border border-border rounded-sm bg-surface/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="hud-label">Matches</span>
            <span className="text-[10px] text-muted-foreground">{isLoading ? "…" : `${rows.length} entities`}</span>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-normal">#</th>
                  <th className="px-3 py-2 font-normal">Entity</th>
                  <th className="px-3 py-2 font-normal">Type</th>
                  <th className="px-3 py-2 font-normal">Signal</th>
                  <th className="px-3 py-2 font-normal text-right">Value</th>
                  <th className="px-3 py-2 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.entity}-${r.key}-${i}`} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono font-semibold">{r.entity}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.entity_type ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.key ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right">{String(r.value ?? "—")}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.date}</td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">no matches</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
