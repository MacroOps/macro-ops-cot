// Analog Engine — find historical periods that look like today across a
// chosen indicator (or a small basket) and overlay their forward price paths.
import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { REGISTRY, buildIndicatorSeries } from "@/lib/backtest/registry";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis, Customized,
} from "recharts";
import { HudTooltip, HudCrosshairCursor, HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";

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
      const row: Record<string, number | string | null> = { day: i };
      top.forEach((m, k) => (row[`m${k}`] = +m.path[i].toFixed(2)));
      const vals = top.map((m) => m.path[i]).filter((x) => x !== undefined).sort((a, b) => a - b);
      const at = (q: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(q * (vals.length - 1)))] : 0);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      row.mean = +mean.toFixed(2);
      row.median = +at(0.5).toFixed(2);
      row.p25 = +at(0.25).toFixed(2);
      row.p75 = +at(0.75).toFixed(2);
      row.iqrLow = row.p25;
      row.iqrSpan = +((row.p75 as number) - (row.p25 as number)).toFixed(2);
      row.min = +at(0).toFixed(2);
      row.max = +at(1).toFixed(2);
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
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold">
              Forward path fan · {result.top.length} analogs · {horizon}w
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-sm" style={{ background: "hsl(var(--chart-accent) / 0.18)", border: "1px solid hsl(var(--chart-accent) / 0.4)" }} />
                IQR
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5" style={{ background: "hsl(var(--chart-axis))" }} />
                Threads
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-[2px]" style={{ background: "hsl(var(--chart-accent))" }} />
                Median
              </div>
            </div>
          </div>
          <div className="hud-chart rounded-none p-1" style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.points} margin={{ top: 8, right: 48, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="analog-cone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-accent))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="hsl(var(--chart-accent))" stopOpacity={0.22} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }}
                  axisLine={{ stroke: "hsl(var(--chart-grid))" }}
                  tickLine={false}
                  label={{ value: "Weeks forward", position: "insideBottom", offset: -2, fontSize: 9, fill: "hsl(var(--chart-axis))" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(var(--chart-axis))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
                />
                <ReferenceLine y={0} stroke="hsl(var(--chart-ink-muted))" strokeOpacity={0.4} />
                <ReferenceLine x={0} stroke="hsl(var(--chart-halo))" strokeOpacity={0.5} strokeDasharray="2 3" label={{ value: "t = 0", position: "insideTopLeft", fontSize: 9, fill: "hsl(var(--chart-halo))" }} />

                {/* IQR cone — stacked invisible base + visible span */}
                <Area
                  type="monotone"
                  dataKey="iqrLow"
                  stackId="cone"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="iqrSpan"
                  stackId="cone"
                  stroke="hsl(var(--chart-accent) / 0.4)"
                  strokeWidth={0.5}
                  fill="url(#analog-cone)"
                  isAnimationActive
                  animationDuration={650}
                />

                {/* Individual analog threads */}
                {result.top.map((_, k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={`m${k}`}
                    stroke="hsl(var(--chart-ink-muted))"
                    strokeWidth={1}
                    strokeOpacity={0.32}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}

                {/* Median — the hero line */}
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="hsl(var(--chart-accent))"
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive
                  animationDuration={750}
                  animationEasing="ease-out"
                />

                <Tooltip
                  content={<HudTooltip />}
                  cursor={false}
                  formatter={(v: number, name: string) => [`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, name]}
                />
                <Customized component={HudCrosshairOverlay} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            <span>Empirical distribution of forward returns from {result.top.length} closest analog weeks.</span>
            <span>
              Mean <span className={`tabular-nums ${result.meanFinal >= 0 ? "text-success" : "text-destructive"}`}>{result.meanFinal >= 0 ? "+" : ""}{result.meanFinal.toFixed(2)}%</span>
              {" · "}Hit <span className="tabular-nums text-surface-foreground">{result.hit.toFixed(0)}%</span>
            </span>
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
                      <span className="inline-block w-2 h-2 rounded-sm mr-2" style={{ background: "hsl(var(--chart-accent))" }} />
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
