import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useTpRiskComposite } from "@/hooks/tp/useTp";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HudCrosshairCursor, HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";

const SECTORS = ["SPX", "NDX", "RUT", "DJI", "XLF", "XLE", "XLK", "XLY", "XLP", "XLI", "XLV", "XLU", "XLB", "XLRE", "XLC"];
const TYPES = ["LT", "ST"];

function stateColor(s: string | null | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (v.includes("bull") || v === "long" || v === "risk_on") return "hsl(var(--pos-long))";
  if (v.includes("bear") || v === "short" || v === "risk_off") return "hsl(var(--pos-short))";
  return "hsl(var(--muted-foreground))";
}

export default function TpRiskComposite() {
  const [sector, setSector] = useState("SPX");
  const [type, setType] = useState("LT");

  const start = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);

  const { data: rows = [], isLoading, error } = useTpRiskComposite({
    sector,
    composite_type: type,
    start_date: start,
    end_date: end,
    limit: 2000,
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  );
  const latest = sorted[sorted.length - 1];

  return (
    <AppShell title="TP · Risk Composite">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-1">
          <span className="hud-label mr-1">Sector</span>
          {SECTORS.map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`px-2 py-1 rounded-sm border ${
                sector === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="hud-label mr-1">Type</span>
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-2 py-1 rounded-sm border ${
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border bg-surface/30">
          <Stat label="Composite Score" value={latest.composite_score?.toFixed(2) ?? "—"} mono />
          <Stat label="Signal State" value={(latest.signal_state ?? "—").toUpperCase()} color={stateColor(latest.signal_state)} />
          <Stat label="Last Change" value={latest.signal_change ?? "—"} />
          <Stat label="Since" value={latest.signal_start_date ?? "—"} mono />
        </div>
      )}

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      <div className="p-3">
        <div className="border border-border rounded-sm bg-surface/30">
          <div className="px-3 py-2 border-b border-border hud-label">
            {sector} · {type} Composite Score
          </div>
          <div className="p-3">
            {isLoading ? (
              <div className="h-[300px] animate-pulse bg-surface/40 rounded-sm" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={sorted}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip cursor={false} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Line type="monotone" dataKey="composite_score" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${mono ? "font-mono" : ""}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
