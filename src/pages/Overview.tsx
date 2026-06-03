import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { SignalBadge, LevelBar } from "@/components/hud/SignalBadge";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  TCTM_STATUS,
  DUAL_TREND_UNIVERSES,
  type DualTrendStock,
} from "@/lib/turningPointSpecs";

const TILES = [
  { title: "Trend Fragility", subtitle: "Composite (0–100%)", seed: 11, hi: 90, lo: 20, drift: -0.4 },
  { title: "Risk Cycle", subtitle: "Composite (0–100%)", seed: 12, drift: 0.1 },
  { title: "Market Internals", subtitle: "Net divergence", seed: 13, min: -80, max: 80, drift: 0.3 },
  { title: "Breadth & Thrust Score", subtitle: "0–15", seed: 14, min: 0, max: 15 },
  { title: "MO Liquidity", subtitle: "0–100%", seed: 15, drift: 0.2 },
  { title: "Implied Recession (6m)", subtitle: "Market-implied prob.", seed: 16, drift: -0.2 },
];

// Visual specs for each TCTM composite chart (count of components triggered over time).
const TCTM_CHARTS: Array<{
  key: (typeof TCTM_STATUS)[number]["name"];
  title: string;
  subtitle: string;
  trigger: number;
  drift: number;
  variant: "area" | "bar";
  to: string;
}> = [
  { key: "RISK", title: "TCTM Risk-Off", subtitle: "Components triggered · trigger ≥5", trigger: 5, drift: 0.1, variant: "bar", to: "/tpmr/tctm/risk-off" },
  { key: "CAPITULATION", title: "TCTM Capitulation", subtitle: "Components triggered · trigger ≥4", trigger: 4, drift: -0.2, variant: "bar", to: "/tpmr/tctm/capitulation" },
  { key: "BOTTOM", title: "TCTM Bottom", subtitle: "Components triggered · trigger ≥4", trigger: 4, drift: 0.0, variant: "bar", to: "/tpmr/tctm/bottom" },
  { key: "THRUST", title: "TCTM Thrust", subtitle: "Components triggered · trigger ≥5", trigger: 5, drift: 0.4, variant: "area", to: "/tpmr/tctm/thrust" },
  { key: "CONFIRMATION", title: "TCTM Confirmation", subtitle: "Components triggered · trigger ≥4", trigger: 4, drift: 0.3, variant: "area", to: "/tpmr/tctm/confirmation" },
];

const TCTM_SEEDS: Record<string, number> = {
  RISK: 71,
  CAPITULATION: 72,
  BOTTOM: 73,
  THRUST: 74,
  CONFIRMATION: 75,
};

function useTopDualTrend() {
  return useMemo(() => {
    const all: Array<DualTrendStock & { universeSlug: string; universeTitle: string }> = [];
    Object.values(DUAL_TREND_UNIVERSES).forEach((u) => {
      u.stocks.forEach((s) => all.push({ ...s, universeSlug: u.slug, universeTitle: u.title }));
    });
    const bull = [...all]
      .filter((s) => s.ltSignal === "BULLISH")
      .sort((a, b) => b.ltTrend + b.ltRelative - (a.ltTrend + a.ltRelative))
      .slice(0, 8);
    const bear = [...all]
      .filter((s) => s.ltSignal === "BEARISH")
      .sort((a, b) => a.ltTrend + a.ltRelative - (b.ltTrend + b.ltRelative))
      .slice(0, 8);
    return { bull, bear };
  }, []);
}

function DualTrendList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Array<DualTrendStock & { universeSlug: string }>;
  tone: "bull" | "bear";
}) {
  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
          {title}
        </div>
        <span
          className={`text-[9px] font-mono uppercase tracking-wider ${
            tone === "bull" ? "text-success" : "text-destructive"
          }`}
        >
          {rows.length} names
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left py-1 pl-3 font-medium">Sym</th>
            <th className="text-left py-1 font-medium">Universe</th>
            <th className="text-left py-1 font-medium">LT Trend</th>
            <th className="text-left py-1 font-medium">LT Rel</th>
            <th className="text-left py-1 font-medium">Sig</th>
            <th className="text-right py-1 pr-3 font-medium">LT Ret</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={`${s.universeSlug}-${s.symbol}`} className="border-t border-border/50">
              <td className="py-1.5 pl-3 font-mono font-medium">
                <Link to={`/tpmr/dual-trend/${s.universeSlug}`} className="hover:text-primary">
                  {s.symbol}
                </Link>
              </td>
              <td className="py-1.5 text-[10px] text-muted-foreground truncate max-w-[140px]">
                {s.etf}
              </td>
              <td className="py-1.5 w-[100px]"><LevelBar value={s.ltTrend} /></td>
              <td className="py-1.5 w-[100px]"><LevelBar value={s.ltRelative} /></td>
              <td className="py-1.5"><SignalBadge value={s.ltSignal} /></td>
              <td
                className={`py-1.5 pr-3 text-right font-mono tabular-nums ${
                  s.ltReturn >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {s.ltReturn > 0 ? "+" : ""}
                {s.ltReturn}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview() {
  const { data } = useDashboardData();
  const { bull, bear } = useTopDualTrend();
  const extremes = (data?.markets ?? [])
    .filter((m) => Math.abs(m.extremityScore) >= 50)
    .sort((a, b) => b.extremityScore - a.extremityScore)
    .slice(0, 12);

  return (
    <AppShell title="Overview">
      <PageHeader
        eyebrow="Macro HUD"
        title="Market Overview"
        description="Top-of-funnel snapshot across positioning, internals, breadth, macro and TurningPoint composites."
      />

      <div className="hud-section-head">
        <div>
          <div className="hud-section-eyebrow">Composite Signals</div>
          <div className="hud-section-title">Cycle, Trend & Breadth</div>
        </div>
      </div>
      <CardGrid cols={3}>
        {TILES.map((t) => (
          <IndicatorCard
            key={t.seed}
            title={t.title}
            subtitle={t.subtitle}
            seed={t.seed}
            variant="area"
            min={t.min}
            max={t.max}
            drift={t.drift}
            thresholds={{ hi: t.hi, lo: t.lo }}
          />
        ))}
      </CardGrid>

      {/* TCTM composite charts */}
      <div className="hud-section-head">
        <div>
          <div className="hud-section-eyebrow">TurningPoint</div>
          <div className="hud-section-title">TCTM Composite Status</div>
        </div>
        <Link
          to="/tpmr/market-overview"
          className="text-[10px] uppercase tracking-[0.14em] text-primary hover:underline"
        >
          Open TPMR →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-3 pt-0">
        {TCTM_CHARTS.map((c) => {
          const status = TCTM_STATUS.find((s) => s.name === c.key)!;
          return (
            <div key={c.key} className="relative">
              <IndicatorCard
                title={c.title}
                subtitle={c.subtitle}
                seed={TCTM_SEEDS[c.key]}
                variant={c.variant}
                min={0}
                max={status.total}
                drift={c.drift}
                volatility={0.5}
                points={90}
                thresholds={{ hi: c.trigger }}
                unit={`/${status.total}`}
                actions={<SignalBadge value={status.signal} />}
              />
              <Link
                to={c.to}
                className="absolute inset-0"
                aria-label={`Open ${c.title} guide`}
              />
            </div>
          );
        })}
      </div>

      {/* Top Dual Trend Readings */}
      <div className="hud-section-head">
        <div>
          <div className="hud-section-eyebrow">TurningPoint · Dual Trend</div>
          <div className="hud-section-title">Top Dual Trend Readings</div>
        </div>
        <Link
          to="/tpmr/dual-trend/sp500"
          className="text-[10px] uppercase tracking-[0.14em] text-primary hover:underline"
        >
          Open Dual Trend →
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pt-0">
        <DualTrendList title="Strongest LT Bullish" rows={bull} tone="bull" />
        <DualTrendList title="Weakest LT Bearish" rows={bear} tone="bear" />
      </div>


      <div className="px-3 pb-4">
        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-surface-foreground">
              CoT Extremes (live)
            </div>
            <Link to="/" className="text-[10px] uppercase tracking-wider text-primary hover:underline">
              Open Positioning →
            </Link>
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {extremes.length === 0 && (
              <span className="text-xs text-muted-foreground">No extremes detected.</span>
            )}
            {extremes.map((m) => {
              const color =
                m.extremityScore >= 75
                  ? "text-pos-long"
                  : m.extremityScore <= -75
                    ? "text-pos-short"
                    : m.extremityScore > 0
                      ? "text-pos-long/70"
                      : "text-pos-short/70";
              return (
                <Link
                  key={m.symbol}
                  to={`/asset/${m.symbol}`}
                  className={`inline-flex items-center gap-1 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-sm bg-surface border border-border hover:border-primary ${color}`}
                >
                  {m.symbol}
                  <span className="opacity-70">
                    {m.extremityScore > 0 ? "+" : ""}
                    {m.extremityScore}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
