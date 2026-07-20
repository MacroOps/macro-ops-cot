// Signal Explorer — pick any signal + entity and inspect its time series,
// latest value, and percentile rank.
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsSignal, useMopsPercentile, useSignalKeys, useMopsEntities } from "@/hooks/useMops";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Customized, ReferenceLine,
} from "recharts";
import { HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function SignalExplorer() {
  const [key, setKey] = useState<string>("pct_above_sma_50");
  const [entity, setEntity] = useState<string>("SPX");
  const [entityType, setEntityType] = useState<string>("index");

  const today = new Date();
  const from = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const { data: keys = [] } = useSignalKeys();
  const { data: entities = [] } = useMopsEntities({ entity_type: entityType });
  const { data: rows = [], isLoading, error } = useMopsSignal({
    key, entity, from_date: from, to_date: to, limit: 400,
  });
  const { data: pct } = useMopsPercentile({ key, entity });

  const filteredKeys = useMemo(
    () => keys.filter(k => k.toLowerCase().includes(key.toLowerCase().split("_")[0] ?? "")).slice(0, 80),
    [keys, key],
  );

  const series = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(r => ({ date: r.date, value: typeof r.value === "number" ? r.value : Number(r.value) })),
    [rows],
  );
  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const delta = latest && prev ? latest.value - prev.value : 0;

  return (
    <AppShell title="Signal Explorer">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-1">Signal</span>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          list="signal-keys"
          className="h-7 w-64 bg-background border border-border rounded-sm px-2 font-mono tabular-nums"
        />
        <datalist id="signal-keys">
          {keys.map(k => <option key={k} value={k} />)}
        </datalist>

        <span className="hud-label ml-3 mr-1">Type</span>
        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          className="h-7 bg-background border border-border rounded-sm px-2"
        >
          {["symbol", "index", "sector", "industry", "sub_industry"].map(t => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <span className="hud-label ml-3 mr-1">Entity</span>
        <input
          value={entity}
          onChange={e => setEntity(e.target.value.toUpperCase())}
          list="mops-entities"
          className="h-7 w-40 bg-background border border-border rounded-sm px-2 font-mono uppercase"
        />
        <datalist id="mops-entities">
          {entities.slice(0, 500).map(e => <option key={e} value={e} />)}
        </datalist>

        <span className="ml-auto text-[10px] text-muted-foreground">{keys.length} keys · {entities.length} {entityType}s</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
        <Stat label="Latest" value={latest ? fmt.format(latest.value) : "—"} sub={latest?.date} />
        <Stat label="1D Change" value={fmt.format(delta)} tone={delta > 0 ? "pos" : delta < 0 ? "neg" : "n"} />
        <Stat
          label="Percentile"
          value={pct?.percentile != null ? `${fmt.format(pct.percentile)}%` : "—"}
          sub={pct?.count ? `${pct.count} obs` : undefined}
        />
        <Stat label="Signal" value={key} mono />
      </div>

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      <div className="p-3 space-y-4">
        <Panel title={`${key} · ${entity} (365D)`}>
          {isLoading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.75} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Related signals">
          <div className="flex flex-wrap gap-1">
            {filteredKeys.map(k => (
              <button
                key={k}
                onClick={() => setKey(k)}
                className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors ${
                  k === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
                }`}
              >
                {k}
              </button>
            ))}
            {filteredKeys.length === 0 && <div className="text-xs text-muted-foreground">no matches</div>}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub, tone, mono }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" | "n"; mono?: boolean }) {
  const c = tone === "pos" ? "text-[hsl(var(--pos-long))]" : tone === "neg" ? "text-[hsl(var(--pos-short))]" : "";
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${c} ${mono ? "font-mono truncate" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-sm bg-surface/30">
      <div className="px-3 py-2 border-b border-border hud-label">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}
function Skeleton() { return <div className="h-[280px] animate-pulse bg-surface/40 rounded-sm" />; }
