// Dense heatmap: rows = indicators, cols = underlying markets. Cell color
// encodes percentile; inline sparkline shows recent 12 weeks. One screen,
// entire state of the world.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { REGISTRY, buildIndicatorSeries, CATEGORIES } from "@/lib/backtest/registry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MARKETS = ["ES", "NQ", "RTY", "ZN", "ZB", "GC", "CL", "DX", "VX"];

const ROUTE: Record<string, string> = {
  "tf-score": "/trend-fragility",
  "tf-zscore": "/trend-fragility",
  "tf-regime-flips": "/trend-fragility",
  "rc-risk-on": "/risk-cycle",
  "rc-vol-of-vol": "/risk-cycle",
  "rc-credit-stress": "/risk-cycle",
  "br-pct-200dma": "/breadth/overview",
  "br-thrust": "/breadth/thrusts",
  "br-capitulation": "/breadth/capitulation",
  "mi-ad-line": "/market-internals",
  "mi-nhnl": "/market-internals",
  "tpmr-dual-trend": "/tpmr/dual-trend/sp500",
  "tpmr-tctm-stage": "/tpmr/market-overview",
  "mc-liquidity": "/macro/liquidity",
  "mc-inflation": "/macro/inflation",
  "mc-recession": "/macro/recession",
};

function percentile(arr: number[], v: number) {
  const s = [...arr].sort((a, b) => a - b);
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] <= v) n = i + 1;
  return Math.round((n / s.length) * 100);
}

function pctColor(p: number) {
  // 0..100 → red → neutral → green spectrum (using HSL semantic tokens)
  if (p >= 80) return "bg-destructive/70 text-destructive-foreground";
  if (p >= 65) return "bg-destructive/30";
  if (p <= 20) return "bg-success/70 text-success-foreground";
  if (p <= 35) return "bg-success/30";
  return "bg-muted/40";
}

function Sparkline({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-4">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Heatmap() {
  const [filter, setFilter] = useState<string>("all");

  const cells = useMemo(() => {
    return REGISTRY.map((ind) => {
      const data = buildIndicatorSeries(ind, 156);
      const values = data.map((d) => d.v);
      const now = values[values.length - 1];
      const pct = percentile(values, now);
      // Per-market variants: offset seed slightly so cells differ
      const perMarket = MARKETS.map((m, i) => {
        const offset = m.charCodeAt(0) + i;
        const s2 = buildIndicatorSeries({ ...ind, seed: ind.seed + offset }, 156);
        const vs = s2.map((d) => d.v);
        const v = vs[vs.length - 1];
        const p = percentile(vs, v);
        return { market: m, value: v, percentile: p, spark: vs.slice(-12) };
      });
      return { ind, now, pct, perMarket };
    });
  }, []);

  const filtered = filter === "all" ? cells : cells.filter((c) => c.ind.category === filter);

  return (
    <AppShell title="Heatmap">
      <PageHeader
        eyebrow="Overview"
        title="Indicator × Market Heatmap"
        description="Dense state-of-the-world view. Color encodes percentile rank — green = depressed, red = stretched. Click any indicator label to dive in."
      />

      <div className="px-3 pb-2">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {CATEGORIES.filter((c) => c !== "Composite").map((c) => (
              <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-3 pb-4">
        <div className="hud-panel overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-muted-foreground font-medium sticky left-0 bg-surface/95 z-10 min-w-[220px]">
                  Indicator
                </th>
                <th className="text-center py-2 px-2 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">12w</th>
                <th className="text-center py-2 px-2 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Now</th>
                {MARKETS.map((m) => (
                  <th key={m} className="text-center py-2 px-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ ind, now, pct, perMarket }) => (
                <tr key={ind.key} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-1.5 px-3 sticky left-0 bg-background/95 z-10">
                    <Link to={ROUTE[ind.key] ?? "/"} className="hover:text-primary">
                      <div className="font-medium text-[11px]">{ind.label}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{ind.category}</div>
                    </Link>
                  </td>
                  <td className="py-1.5 px-2 w-[80px]">
                    <Sparkline data={perMarket[0].spark} />
                  </td>
                  <td className={`py-1.5 px-2 text-center font-mono tabular-nums text-[11px] ${pctColor(pct)}`}>
                    <div>{now.toFixed(1)}</div>
                    <div className="text-[9px] opacity-70">{pct}p</div>
                  </td>
                  {perMarket.map((c) => (
                    <td key={c.market} className={`text-center py-1.5 px-1 font-mono tabular-nums text-[10px] ${pctColor(c.percentile)}`}>
                      {c.percentile}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider">Percentile scale:</span>
          <span className="px-2 py-0.5 bg-success/70 text-success-foreground rounded-sm">≤20 depressed</span>
          <span className="px-2 py-0.5 bg-success/30 rounded-sm">21–34</span>
          <span className="px-2 py-0.5 bg-muted/40 rounded-sm">35–64 neutral</span>
          <span className="px-2 py-0.5 bg-destructive/30 rounded-sm">65–79</span>
          <span className="px-2 py-0.5 bg-destructive/70 text-destructive-foreground rounded-sm">≥80 stretched</span>
        </div>
      </div>
    </AppShell>
  );
}
