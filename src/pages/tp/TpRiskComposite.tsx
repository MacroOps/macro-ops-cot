// Risk Composite — long-term and short-term risk regime signals.
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsSignal } from "@/hooks/useMops";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Customized, ReferenceLine } from "recharts";
import { HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const INDICES = ["SPX", "NDX", "RUT"];

export default function TpRiskComposite() {
  const [entity, setEntity] = useState("SPX");
  const today = new Date();
  const from = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const base = { entity, entity_type: "index", from_date: from, to_date: to, limit: 400 };

  const lt = useMopsSignal({ ...base, key: "risk_lt_score" });
  const st = useMopsSignal({ ...base, key: "risk_st_score" });
  const ltState = useMopsSignal({ ...base, key: "risk_lt_state", limit: 5 });
  const stState = useMopsSignal({ ...base, key: "risk_st_state", limit: 5 });

  const merged = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    const add = (rows: typeof lt.data, k: string) => {
      for (const r of rows ?? []) {
        const row = m.get(r.date) ?? { date: r.date };
        row[k] = typeof r.value === "number" ? r.value : Number(r.value);
        m.set(r.date, row);
      }
    };
    add(lt.data, "lt");
    add(st.data, "st");
    return Array.from(m.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [lt.data, st.data]);

  const latestLt = ltState.data?.[ltState.data.length - 1];
  const latestSt = stState.data?.[stState.data.length - 1];
  const loading = lt.isLoading || st.isLoading;
  const err = lt.error || st.error || ltState.error || stState.error;

  return (
    <AppShell title="Risk Composite">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <span className="hud-label mr-2">Index</span>
        {INDICES.map(i => (
          <button key={i} onClick={() => setEntity(i)} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
            entity === i ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"
          }`}>{i}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
        <Stat label="LT Regime" value={String(latestLt?.value ?? "—")} sub={latestLt?.date} tone={String(latestLt?.value).includes("On") ? "pos" : String(latestLt?.value).includes("Off") ? "neg" : "n"} />
        <Stat label="LT Score" value={merged.length ? fmt.format(Number(merged[merged.length - 1].lt ?? 0)) : "—"} />
        <Stat label="ST Regime" value={String(latestSt?.value ?? "—")} sub={latestSt?.date} tone={String(latestSt?.value).includes("On") ? "pos" : String(latestSt?.value).includes("Off") ? "neg" : "n"} />
        <Stat label="ST Score" value={merged.length ? fmt.format(Number(merged[merged.length - 1].st ?? 0)) : "—"} />
      </div>

      {err && <div className="px-3 py-3 text-xs text-destructive border-b border-border">{(err as Error).message}</div>}

      <div className="p-3">
        <Panel title="Risk score · LT vs ST">
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="lt" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.75} name="LT" />
                <Line type="monotone" dataKey="st" stroke="hsl(var(--accent))" dot={false} strokeWidth={1.5} name="ST" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" | "n" }) {
  const c = tone === "pos" ? "text-[hsl(var(--pos-long))]" : tone === "neg" ? "text-[hsl(var(--pos-short))]" : "";
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${c}`}>{value}</div>
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
function Skeleton() { return <div className="h-[300px] animate-pulse bg-surface/40 rounded-sm" />; }
