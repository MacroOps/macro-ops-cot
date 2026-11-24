// Breadth — SPX breadth signals from the Macro Ops API. Shows multiple
// breadth keys overlaid + underlying counts.
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useMopsSignal } from "@/hooks/useMops";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, Customized, ReferenceLine } from "recharts";
import { HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";
import { ChartExportButton } from "@/components/charts/ChartExportButton";
import { ChartLegend, type ChartLegendItem } from "@/components/charts/ChartLegend";
import { ResponsiveContainer } from "@/components/charts/ResponsiveContainer";

const INDICES = ["SPX", "S5INFT", "S5FINL", "S5HLTH", "S5INDU", "S5COND", "S5CONS", "S5ENRS", "S5MATR", "S5RLST", "S5TELS", "S5UTIL"];

export default function TpBreadth() {
  const [entity, setEntity] = useState("SPX");
  const today = new Date();
  const from = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const base = { entity, from_date: from, to_date: to, limit: 400 };

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
        <Panel
          title="% Members above 50D / 200D MA"
          exportTitle={`${entity} breadth above 50D 200D MA`}
          asOf={String(merged[merged.length - 1]?.date ?? "")}
          height={280}
          legend={[
            { label: "% > 50D", color: "hsl(var(--pos-long))" },
            { label: "% > 200D", color: "hsl(var(--primary))" },
          ]}
        >
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="date" stroke="hsl(var(--chart-grid))" tick={CHART_TICK} minTickGap={40} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--chart-grid))" tick={CHART_TICK} />
                <Tooltip cursor={false} contentStyle={CHART_TOOLTIP_STYLE} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={50} stroke="hsl(var(--chart-grid))" />
                <Line type="monotone" dataKey="pct50" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} name="% > 50D" />
                <Line type="monotone" dataKey="pct200" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} name="% > 200D" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          title="New 52W Highs vs Lows (count)"
          exportTitle={`${entity} new 52W highs vs lows`}
          asOf={String(merged[merged.length - 1]?.date ?? "")}
          height={240}
          legend={[
            { label: "New Highs", color: "hsl(var(--pos-long))" },
            { label: "New Lows", color: "hsl(var(--pos-short))" },
          ]}
        >
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={merged}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="date" stroke="hsl(var(--chart-grid))" tick={CHART_TICK} minTickGap={40} />
                <YAxis stroke="hsl(var(--chart-grid))" tick={CHART_TICK} />
                <Tooltip cursor={false} contentStyle={CHART_TOOLTIP_STYLE} />
                <Customized component={HudCrosshairOverlay} />
                <ReferenceLine y={0} stroke="hsl(var(--chart-grid))" />
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

function Panel({ title, exportTitle, asOf, height, legend, children }: { title: string; exportTitle?: string; asOf?: string; height: number; legend?: ChartLegendItem[]; children: React.ReactNode }) {
  return (
    <div className="hud-chart" data-chart-export="">
      <div className="hud-chart-header px-3 py-2 flex items-center justify-between gap-2">
        <span className="hud-label">{title}</span>
        <ChartExportButton title={exportTitle ?? title} asOf={asOf} />
      </div>
      <div className="p-3" data-chart-body="">
        {legend && <ChartLegend items={legend} className="mb-2" />}
        <div style={{ height }} data-chart-body="">{children}</div>
      </div>
    </div>
  );
}
function Skeleton() { return <div className="h-full animate-pulse bg-surface/40 rounded-sm" />; }
