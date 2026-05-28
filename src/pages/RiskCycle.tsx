import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";

const COMPONENTS = [
  { title: "FINRA Margin Accounts", seed: 201 },
  { title: "Schwab Trading Activity Index", seed: 202 },
  { title: "Leveraged Funds Sentiment", seed: 203, drift: -0.2 },
  { title: "Forward P/E Indicator", seed: 204, drift: 0.3 },
];

export default function RiskCycle() {
  return (
    <AppShell title="Risk Cycle">
      <PageHeader
        eyebrow="MO Indicator"
        title="Risk Cycle"
        description="Where we are in the risk-taking cycle. Composite of margin debt, retail activity, leveraged funds positioning, and valuation."
      />
      <div className="px-3 pt-3">
        <IndicatorCard
          title="Macro Ops | Risk Cycle (Composite)"
          subtitle="0–100% percentile"
          seed={200}
          variant="area"
          height={240}
          drift={0.1}
          thresholds={{ hi: 80, lo: 20 }}
        />
      </div>
      <CardGrid cols={2}>
        {COMPONENTS.map((c) => (
          <IndicatorCard
            key={c.seed}
            title={c.title}
            subtitle="0–100% percentile"
            seed={c.seed}
            variant="line"
            drift={c.drift}
            thresholds={{ hi: 80, lo: 20 }}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}
