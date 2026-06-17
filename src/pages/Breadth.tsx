import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { BREADTH_AGGREGATOR, THRUST_AGGREGATOR, type ComponentSpec } from "@/lib/indicatorSpecs";
import { LiveBreadthCard } from "@/components/hud/LiveBreadthCard";
import { MockBadge } from "@/components/hud/MockBadge";
import {
  BreadthSectorProvider,
  BreadthSectorPicker,
} from "@/components/hud/BreadthSectorContext";
import type { TpBreadthRow } from "@/lib/tp/types";

// ---------------------------------------------------------------------------
// Live-data mapping. Component IDs not in this map fall back to mock series.
// ---------------------------------------------------------------------------

type LiveMap = Record<
  string,
  {
    field: keyof TpBreadthRow;
    transform?: (r: TpBreadthRow) => number | null;
    min?: number;
    max?: number;
    subtitle?: string;
  }
>;

const LIVE: LiveMap = {
  // Breadth Aggregator
  "pct-above-50": { field: "ma_50d", min: 0, max: 100, subtitle: "% stocks > 50D SMA · live" },
  "pct-above-200": { field: "ma_200d", min: 0, max: 100, subtitle: "% stocks > 200D SMA · live" },
  "nh-nl-50": {
    field: "new_highs_21d",
    transform: (r) =>
      r.new_highs_21d != null && r.new_lows_21d != null ? r.new_highs_21d - r.new_lows_21d : null,
    min: -30,
    max: 50,
    subtitle: "% NH₂₁D − % NL₂₁D · live",
  },
  // Thrusts
  "thrust-above-10": { field: "ma_10d", min: 0, max: 100, subtitle: "% stocks > 10D SMA · live" },
  "thrust-nh4w": { field: "new_highs_21d", min: 0, max: 60, subtitle: "% new 21D highs · live proxy" },
  // Capitulation
  "cap-nl4w": { field: "new_lows_21d", min: 0, max: 60, subtitle: "% new 21D lows · live proxy" },
};

function ComponentCard({ c, seed, variant = "bar" }: { c: ComponentSpec; seed: number; variant?: "line" | "bar" }) {
  const live = LIVE[c.id];
  if (live) {
    return (
      <LiveBreadthCard
        component={c}
        subtitle={live.subtitle}
        field={live.field as Exclude<keyof TpBreadthRow, "date" | "sector">}
        transform={live.transform}
        min={live.min ?? c.scale?.min}
        max={live.max ?? c.scale?.max}
        thresholds={c.thresholds}
        unit={c.scale?.max === 100 ? "%" : ""}
        rangeDays={365}
      />
    );
  }
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <MockBadge reason={`No upstream feed for "${c.title}" yet. Mock series shown for layout only.`} />
      </div>
      <IndicatorCard
        component={c}
        subtitle={`Score 0 – ${c.weight ?? 1}`}
        seed={seed}
        variant={variant}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function BreadthOverview() {
  return (
    <BreadthSectorProvider>
      <AppShell title="Breadth · Overview">
        <PageHeader
          eyebrow="Breadth"
          title="Breadth & Thrust"
          description="Two composites: a five-rule participation aggregator (max 6) and a ten-signal thrust/capitulation aggregator (max 10)."
          actions={<BreadthSectorPicker />}
        />
        <div className="px-4 pt-2 flex items-center gap-2">
          <MockBadge reason="Composite aggregator scores are still mock-generated; component cards below show live data where available." />
          <span className="text-[10px] text-muted-foreground">Composite scoring still on mock — components below are live where mapped.</span>
        </div>
        <CompositePanel spec={BREADTH_AGGREGATOR} seed={400} height={200} />
        <CompositePanel spec={THRUST_AGGREGATOR} seed={450} height={200} />
        <InputsRequired
          inputs={Array.from(
            new Set([...BREADTH_AGGREGATOR.inputs, ...THRUST_AGGREGATOR.inputs]),
          )}
        />
      </AppShell>
    </BreadthSectorProvider>
  );
}

export function BreadthComponents() {
  return (
    <BreadthSectorProvider>
      <AppShell title="Breadth · Aggregator">
        <PageHeader
          eyebrow="Breadth"
          title={BREADTH_AGGREGATOR.name}
          description={BREADTH_AGGREGATOR.description}
          actions={<BreadthSectorPicker />}
        />
        <div className="px-4 pt-2">
          <MockBadge reason="Composite scoring still on mock; per-rule cards show live data where mapped." />
        </div>
        <CompositePanel spec={BREADTH_AGGREGATOR} seed={400} height={200} />
        <div className="hud-section-head">
          <div>
            <div className="hud-section-eyebrow">Components</div>
            <div className="hud-section-title">Participation Rules</div>
          </div>
        </div>
        <CardGrid cols={2}>
          {BREADTH_AGGREGATOR.components.map((c, i) => (
            <ComponentCard key={c.id} c={c} seed={410 + i} />
          ))}
        </CardGrid>
        <InputsRequired inputs={BREADTH_AGGREGATOR.inputs} />
      </AppShell>
    </BreadthSectorProvider>
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
    <BreadthSectorProvider>
      <AppShell title="Breadth · Thrusts">
        <PageHeader
          eyebrow="Breadth"
          title="Thrust Signals (6)"
          description="Binary thrust signals from the Breadth Thrust Aggregator."
          actions={<BreadthSectorPicker />}
        />
        <CardGrid cols={3}>
          {items.map((c, i) => (
            <ComponentCard key={c.id} c={c} seed={420 + i} />
          ))}
        </CardGrid>
        <InputsRequired inputs={THRUST_AGGREGATOR.inputs} />
      </AppShell>
    </BreadthSectorProvider>
  );
}

export function BreadthCapitulation() {
  const items = THRUST_AGGREGATOR.components.filter((c) => !THRUST_IDS.has(c.id));
  return (
    <BreadthSectorProvider>
      <AppShell title="Breadth · Capitulation">
        <PageHeader
          eyebrow="Breadth"
          title="Capitulation / Oversold Signals (4)"
          description="Binary capitulation signals from the Breadth Thrust Aggregator."
          actions={<BreadthSectorPicker />}
        />
        <CardGrid cols={2}>
          {items.map((c, i) => (
            <ComponentCard key={c.id} c={c} seed={430 + i} />
          ))}
        </CardGrid>

        <div className="hud-section-head">
          <div>
            <div className="hud-section-eyebrow">Live Bonus</div>
            <div className="hud-section-title">Direct TP Capitulation Series</div>
          </div>
        </div>
        <CardGrid cols={2}>
          <LiveBreadthCard
            title="Oversold (TP)"
            subtitle="% stocks oversold · live"
            field="oversold"
            min={0}
            max={60}
            unit="%"
          />
          <LiveBreadthCard
            title="% Stocks Down 20%+"
            subtitle="bear-market participation · live"
            field="down_20_pct"
            min={0}
            max={100}
            unit="%"
          />
          <LiveBreadthCard
            title="New 63D Lows"
            subtitle="% making 63D lows · live"
            field="new_lows_63d"
            min={0}
            max={40}
            unit="%"
          />
          <LiveBreadthCard
            title="New 252D Lows"
            subtitle="% making 252D lows · live"
            field="new_lows_252d"
            min={0}
            max={30}
            unit="%"
          />
        </CardGrid>

        <InputsRequired inputs={THRUST_AGGREGATOR.inputs} />
      </AppShell>
    </BreadthSectorProvider>
  );
}
