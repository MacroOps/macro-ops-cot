import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { RISK_CYCLE } from "@/lib/indicatorSpecs";

export default function RiskCycle() {
  return (
    <AppShell title="Risk Cycle">
      <PageHeader
        eyebrow="MO Indicator"
        title={RISK_CYCLE.name}
        description={RISK_CYCLE.description}
      />
      <CompositePanel spec={RISK_CYCLE} seed={200} drift={0.1} />
      <CardGrid cols={2}>
        {RISK_CYCLE.components.map((c, i) => (
          <IndicatorCard
            key={c.id}
            component={c}
            subtitle="0–100% percentile"
            seed={201 + i}
            variant="line"
          />
        ))}
      </CardGrid>
      <InputsRequired inputs={RISK_CYCLE.inputs} />
    </AppShell>
  );
}
