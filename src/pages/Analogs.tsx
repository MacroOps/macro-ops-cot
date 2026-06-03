// Analog Engine — find historical periods that look like today across a
// chosen indicator (or a small basket) and overlay their forward price paths.
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { REGISTRY, buildIndicatorSeries } from "@/lib/backtest/registry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function Analogs() {
  const [indKey, setIndKey] = useState(REGISTRY[0].key);
  const [tolPct, setTolPct] = useState(5); // % of range
  const [horizon, setHorizon] = useState(21);

  const result = useMemo(() => {
    const ind = REGISTRY.find((r) => r.key === indKey)!;
    const data = buildIndicatorSeries(ind, 312);
    const now = data[data.length - 1].v;
    const tol = ((ind.max - ind.min) * tolPct) / 100;
    const matches: Array<{ idx: number; date: string; value: number; distance: number; path: number[] }> = [];
    const today = Date.now();
    for (let i = horizon; i < data.length - horizon - 1; i++) {
      const d = Math.abs(data[i].v - now);
      if (d > tol) continue;
      const base = data[i].price;
      const path = data.slice(i, i + horizon + 1).map((p) => ((p.price - base) / base) * 100);
      matches.push({
        idx: i,
        date: new Date(today - (data.length - i) * 7 * 86_400_000).toISOString().slice(0, 10),
        value: +data[i].v.toFixed(2),
        distance: +d.toFixed(2),
        path,
      });
    }
    matches.sort((a, b) => a.distance - b.distance);
    const top = matches.slice(0, 8);
    const points = Array.from({ length: horizon + 1 }, (_, i) => {
      const row: Record<string, number | string> = { day: i };
      top.forEach((m, k) => (row[`m${k}`] = +m.path[i].toFixed(2)));
      const vals = top.map((m) => m.path[i]).filter((x) => x !== undefined);
      row.mean = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
      return row;
    });
    const finals = top.map((m) => m.path[m.path.length - 1]);
    const meanFinal = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : 0;
    const hit = finals.length ? (finals.filter((x) => x > 0).length / finals.length) * 100 : 0;
    return { ind, now, top, points, meanFinal, hit };
  }, [indKey, tolPct, horizon]);

  return (
    <AppShell title="Analogs">
      <PageHeader
        eyebrow="Intelligence"
        title="Analog Engine"
        description="Find historical weeks that look like today on the chosen indicator. Overlay their forward price paths to see the empirical distribution."
      />

      <div className="px-3 grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="hud-panel p-3 space-y-3 lg:col-span-1">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Indicator</label>
            <Select value={indKey} onValueChange={setIndKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGISTRY.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tolerance: {tolPct}% of range</label>
            <Slider value={[tolPct]} min={1} max={20} step={1} onValueChange={(v) => setTolPct(v[0])} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Horizon: {horizon} weeks</label>
            <Slider value={[horizon]} min={4} max={52} step={1} onValueChange={(v) => setHorizon(v[0])} />
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Current value</div>
              <div className="text-lg font-mono tabular-nums">{result.now.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Analogs found</div>
              <div className="text-lg font-mono tabular-nums">{result.top.length}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Mean fwd return</div>
              <div className={`text-lg font-mono tabular-nums ${result.meanFinal >= 0 ? "text-success" : "text-destructive"}`}>
                {result.meanFinal >= 0 ? "+" : ""}{result.meanFinal.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Hit rate</div>
              <div className="text-lg font-mono tabular-nums">{result.hit.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="hud-panel lg:col-span-3">
          <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wider font-semibold">
            Forward price paths · top {result.top.length} analogs · {horizon}w
          </div>
          <div className="p-3 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.points}>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--surface))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: "11px",
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                {result.top.map((_, k) => (
                  <Line key={k} type="monotone" dataKey={`m${k}`} stroke={COLORS[k % COLORS.length]} strokeWidth={1} dot={false} strokeOpacity={0.6} />
                ))}
                <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="hud-section-head">
        <div>
          <div className="hud-section-eyebrow">Historical matches</div>
          <div className="hud-section-title">Closest analog weeks</div>
        </div>
      </div>
      <div className="px-3 pb-4">
        <div className="hud-panel">
          <table className="w-full text-xs">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 pl-3 font-medium">#</th>
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-right py-2 font-medium">Value</th>
                <th className="text-right py-2 font-medium">Δ vs now</th>
                <th className="text-right py-2 pr-3 font-medium">Fwd {horizon}w return</th>
              </tr>
            </thead>
            <tbody>
              {result.top.map((m, k) => {
                const fwd = m.path[m.path.length - 1];
                return (
                  <tr key={m.idx} className="border-b border-border/50">
                    <td className="py-1.5 pl-3 font-mono">
                      <span className="inline-block w-2 h-2 rounded-sm mr-2" style={{ background: COLORS[k % COLORS.length] }} />
                      {k + 1}
                    </td>
                    <td className="py-1.5 font-mono">{m.date}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{m.value}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">±{m.distance}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono tabular-nums ${fwd >= 0 ? "text-success" : "text-destructive"}`}>
                      {fwd >= 0 ? "+" : ""}{fwd.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
              {result.top.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No analogs within tolerance. Increase the tolerance slider.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
