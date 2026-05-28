import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";

const COMPONENTS = [
  { title: "Call/Put Ratio", seed: 101 },
  { title: "AAII Bull-Bear Index", seed: 102 },
  { title: "Pairwise Correlation", seed: 103, volatility: 0.08 },
  { title: "Aggregate Fund Flows", seed: 104, volatility: 0.3 },
  { title: "Net Speculators (L+S)", seed: 105 },
  { title: "Market Regime Index", seed: 106 },
];

export default function TrendFragility() {
  return (
    <AppShell title="Trend Fragility">
      <PageHeader
        eyebrow="MO Indicator"
        title="Trend Fragility"
        description="Composite of 6 sentiment, positioning, and regime components. Rolling 10-year percentile."
      />
      <div className="px-3 pt-3">
        <IndicatorCard
          title="Macro Ops | Trend Fragility (Composite)"
          subtitle="0–100% percentile"
          seed={100}
          variant="area"
          height={240}
          drift={-0.5}
          thresholds={{ hi: 90, lo: 20 }}
        />
      </div>
      <CardGrid cols={3}>
        {COMPONENTS.map((c) => (
          <IndicatorCard
            key={c.seed}
            title={c.title}
            subtitle="0–100% percentile"
            seed={c.seed}
            variant="line"
            volatility={c.volatility}
            thresholds={{ hi: 90, lo: 20 }}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}
