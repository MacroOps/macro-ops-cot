import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Link } from "react-router-dom";

const TILES = [
  { title: "Trend Fragility", subtitle: "Composite (0–100%)", seed: 11, hi: 90, lo: 20, drift: -0.4 },
  { title: "Risk Cycle", subtitle: "Composite (0–100%)", seed: 12, drift: 0.1 },
  { title: "Market Internals", subtitle: "Net divergence", seed: 13, min: -80, max: 80, drift: 0.3 },
  { title: "Breadth & Thrust Score", subtitle: "0–15", seed: 14, min: 0, max: 15 },
  { title: "MO Liquidity", subtitle: "0–100%", seed: 15, drift: 0.2 },
  { title: "Implied Recession (6m)", subtitle: "Market-implied prob.", seed: 16, drift: -0.2 },
];

export default function Overview() {
  const { data } = useDashboardData();
  const extremes = (data?.markets ?? [])
    .filter((m) => Math.abs(m.extremityScore) >= 50)
    .sort((a, b) => b.extremityScore - a.extremityScore)
    .slice(0, 12);

  return (
    <AppShell title="Overview">
      <PageHeader
        eyebrow="Macro HUD"
        title="Market Overview"
        description="Top-of-funnel snapshot across positioning, internals, breadth, and macro."
      />
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
