import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { TREND_FRAGILITY } from "@/lib/indicatorSpecs";

export default function TrendFragility() {
  return (
    <AppShell title="Trend Fragility">
      <PageHeader
        eyebrow="MO Indicator"
        title={TREND_FRAGILITY.name}
        description={TREND_FRAGILITY.description}
      />
      <CompositePanel spec={TREND_FRAGILITY} seed={100} drift={-0.5} />
      <CardGrid cols={3}>
        {TREND_FRAGILITY.components.map((c, i) => (
          <IndicatorCard
            key={c.id}
            component={c}
            subtitle="0–100% percentile"
            seed={101 + i}
            variant="line"
          />
        ))}
      </CardGrid>
      <InputsRequired inputs={TREND_FRAGILITY.inputs} />
    </AppShell>
  );
}
