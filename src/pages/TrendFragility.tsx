import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { MockBadge } from "@/components/hud/MockBadge";
import { TREND_FRAGILITY } from "@/lib/indicatorSpecs";

export default function TrendFragility() {
  return (
    <AppShell title="Trend Fragility">
      <PageHeader
        eyebrow="MO Indicator"
        title={TREND_FRAGILITY.name}
        description={TREND_FRAGILITY.description}
        actions={<MockBadge reason="Trend Fragility needs ICI fund flows, OCC put/call, AAII, CFTC Legacy, S&P 500 closes & constituent correlations — not yet wired up." />}
      />
      <CompositePanel spec={TREND_FRAGILITY} seed={100} drift={-0.5} />
      <div className="hud-section-head">
        <div>
          <div className="hud-section-eyebrow">Components</div>
          <div className="hud-section-title">Sub-indicator Percentiles</div>
        </div>
      </div>
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
