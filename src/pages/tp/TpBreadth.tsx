// Breadth — SPX breadth signals from the Macro Ops API. Shows multiple
// breadth keys overlaid + underlying counts.
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsSignal } from "@/hooks/useMops";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Customized, ReferenceLine } from "recharts";
import { HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";

const INDICES = ["SPX", "NDX", "RUT", "DJI"];

export default function TpBreadth() {
  const [entity, setEntity] = useState("SPX");
  const today = new Date();
  const from = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const base = { entity, entity_type: "index", from_date: from, to_date: to, limit: 400 };

  const q50 = useMopsSignal({ ...base, key: "pct_above_sma_50" });
  const q200 = useMopsSignal({ ...base, key: "pct_above_sma_200" });
  const nh = useMopsSignal({ ...base, key: "new_highs_252d_count" });
  const nl = useMopsSignal({ ...base, key: "new_lows_252d_count" });

  const merged = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    const add = (rows: typeof q50.data, k: string) => {
      for (const r of rows ?? []) {
        const row = m.get(r.date) ?? { date: r.date };
        row[k] = typeof r.value === "number" ? r.value : Number(r.value);
        m.set(r.date, row);
      }
    };
    add(q50.data, "pct50");
    add(q200.data, "pct200");
    add(nh.data, "nh");
    add(nl.data, "nl");
    return Array.from(m.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [q50.data, q200.data, nh.data, nl.data]);

  const loading = q50.isLoading || q200.isLoading || nh.isLoading || nl.isLoading;
  const err = q50.error || q200.error || nh.error || nl.error;

  return (
    <AppShell title="Breadth">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-2">Index</span>
        {INDICES.map(i => (
          <button
            key={i}
            onClick={() => setEntity(i)}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
              entity === i ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >{i}</button>
        ))}
      </div>

      {err && <div className="px-3 py-3 text-xs text-destructive border-b border-border">{(err as Error).message}</div>}

      <div className="p-3 space-y-4">
        <Panel title="% Members above 50D / 200D MA">
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={50} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="pct50" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} name="% > 50D" />
                <Line type="monotone" dataKey="pct200" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} name="% > 200D" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="New 52W Highs vs Lows (count)">
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="nh" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} name="New Highs" />
                <Line type="monotone" dataKey="nl" stroke="hsl(var(--pos-short))" dot={false} strokeWidth={1.5} name="New Lows" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </AppShell>
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
function Skeleton() { return <div className="h-[260px] animate-pulse bg-surface/40 rounded-sm" />; }
