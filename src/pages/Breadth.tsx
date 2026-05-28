import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { BREADTH_AGGREGATOR, THRUST_AGGREGATOR } from "@/lib/indicatorSpecs";

export function BreadthOverview() {
  return (
    <AppShell title="Breadth · Overview">
      <PageHeader
        eyebrow="Breadth"
        title="Breadth & Thrust"
        description="Two composites: a five-rule participation aggregator (max 6) and a ten-signal thrust/capitulation aggregator (max 10)."
      />
      <CompositePanel spec={BREADTH_AGGREGATOR} seed={400} height={200} />
      <CompositePanel spec={THRUST_AGGREGATOR} seed={450} height={200} />
      <InputsRequired
        inputs={Array.from(
          new Set([...BREADTH_AGGREGATOR.inputs, ...THRUST_AGGREGATOR.inputs]),
        )}
      />
    </AppShell>
  );
}

export function BreadthComponents() {
  return (
    <AppShell title="Breadth · Aggregator">
      <PageHeader
        eyebrow="Breadth"
        title={BREADTH_AGGREGATOR.name}
        description={BREADTH_AGGREGATOR.description}
      />
      <CompositePanel spec={BREADTH_AGGREGATOR} seed={400} height={200} />
      <CardGrid cols={2}>
        {BREADTH_AGGREGATOR.components.map((c, i) => (
          <IndicatorCard
            key={c.id}
            component={c}
            subtitle={`Score 0 – ${c.weight ?? 1}`}
            seed={410 + i}
            variant="bar"
          />
        ))}
      </CardGrid>
      <InputsRequired inputs={BREADTH_AGGREGATOR.inputs} />
    </AppShell>
  );
}

const THRUST_IDS = new Set([
  "thrust-roc5",
  "thrust-above-10",
  "thrust-15-90",
  "thrust-nh4w",
  "thrust-rsi70",
  "thrust-bb-upper",
]);

export function BreadthThrusts() {
  const items = THRUST_AGGREGATOR.components.filter((c) => THRUST_IDS.has(c.id));
  return (
    <AppShell title="Breadth · Thrusts">
      <PageHeader
        eyebrow="Breadth"
        title="Thrust Signals (6)"
        description="Binary thrust signals from the Breadth Thrust Aggregator."
      />
      <CardGrid cols={3}>
        {items.map((c, i) => (
          <IndicatorCard
            key={c.id}
            component={c}
            subtitle="Signal · 0 / 1"
            seed={420 + i}
            variant="bar"
          />
        ))}
      </CardGrid>
      <InputsRequired inputs={THRUST_AGGREGATOR.inputs} />
    </AppShell>
  );
}

export function BreadthCapitulation() {
  const items = THRUST_AGGREGATOR.components.filter((c) => !THRUST_IDS.has(c.id));
  return (
    <AppShell title="Breadth · Capitulation">
      <PageHeader
        eyebrow="Breadth"
        title="Capitulation / Oversold Signals (4)"
        description="Binary capitulation signals from the Breadth Thrust Aggregator."
      />
      <CardGrid cols={2}>
        {items.map((c, i) => (
          <IndicatorCard
            key={c.id}
            component={c}
            subtitle="Signal · 0 / 1"
            seed={430 + i}
            variant="bar"
          />
        ))}
      </CardGrid>
      <InputsRequired inputs={THRUST_AGGREGATOR.inputs} />
    </AppShell>
  );
}
