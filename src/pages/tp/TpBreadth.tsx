import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { useTpBreadth } from "@/hooks/tp/useTp";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const SECTORS = ["SPX", "NDX", "RUT", "DJI", "XLF", "XLE", "XLK", "XLY", "XLP", "XLI", "XLV", "XLU", "XLB", "XLRE", "XLC"];
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function TpBreadth() {
  const [sector, setSector] = useState("SPX");
  const today = new Date();
  const start = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const end = today.toISOString().slice(0, 10);

  const { data: rows = [], isLoading, error } = useTpBreadth({
    sector,
    start_date: start,
    end_date: end,
    limit: 1000,
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  );
  const latest = sorted[sorted.length - 1];

  return (
    <AppShell title="TP · Breadth">
      <div className="border-b border-border bg-surface/30 px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="hud-label mr-2">Sector</span>
        {SECTORS.map(s => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
              sector === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-5 border-b border-border bg-surface/30">
          <Stat label="Close" value={fmt.format(latest.close_price ?? 0)} mono />
          <Stat label="Advances / Declines" value={`${latest.advances ?? 0} / ${latest.declines ?? 0}`} />
          <Stat label="New Highs 21D" value={fmt.format(latest.new_highs_21d ?? 0)} />
          <Stat label="New Lows 21D" value={fmt.format(latest.new_lows_21d ?? 0)} />
          <Stat label="MA50 / MA200" value={`${fmt.format(latest.ma_50d ?? 0)} / ${fmt.format(latest.ma_200d ?? 0)}`} />
        </div>
      )}

      {error && (
        <div className="px-3 py-3 text-xs text-destructive border-b border-border">
          {(error as Error).message}
        </div>
      )}

      <div className="p-3 space-y-4">
        <Panel title="Advances vs Declines">
          {isLoading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sorted}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="advances" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="declines" stroke="hsl(var(--pos-short))" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="New Highs / New Lows (21D)">
          {isLoading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sorted}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="new_highs_21d" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="new_lows_21d" stroke="hsl(var(--pos-short))" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Overbought / Oversold">
          {isLoading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sorted}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="overbought" stroke="hsl(var(--pos-long))" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="oversold" stroke="hsl(var(--pos-short))" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3 border-r border-border last:border-r-0">
      <div className="hud-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${mono ? "font-mono" : ""}`}>{value}</div>
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

function Skeleton() {
  return <div className="h-[200px] animate-pulse bg-surface/40 rounded-sm" />;
}
