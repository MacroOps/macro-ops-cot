import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { MARKET_INTERNALS } from "@/lib/indicatorSpecs";
import type { ComponentSpec } from "@/lib/indicatorSpecs";

type View = "internals" | "divergence";

function RatioCard({ component, seed }: { component: ComponentSpec; seed: number }) {
  const [view, setView] = useState<View>("internals");
  const isDiv = view === "divergence";
  return (
    <IndicatorCard
      component={component}
      subtitle={isDiv ? "Divergence vs SPX (63D stoch)" : "Raw ratio"}
      seed={seed + (isDiv ? 10_000 : 0)}
      variant="line"
      min={isDiv ? -50 : undefined}
      max={isDiv ? 50 : undefined}
      actions={
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="text-[10px] uppercase tracking-wider bg-transparent border border-border rounded-sm px-1 py-0.5"
        >
          <option value="internals">Internals</option>
          <option value="divergence">Divergence</option>
        </select>
      }
    />
  );
}

export default function MarketInternals() {
  return (
    <AppShell title="Market Internals">
      <PageHeader
        eyebrow="MO Indicator"
        title={MARKET_INTERNALS.name}
        description={MARKET_INTERNALS.description}
      />
      <CompositePanel spec={MARKET_INTERNALS} seed={300} drift={0.4} />
      <CardGrid cols={3}>
        {MARKET_INTERNALS.components.map((c, i) => (
          <RatioCard key={c.id} component={c} seed={301 + i} />
        ))}
      </CardGrid>
      <InputsRequired inputs={MARKET_INTERNALS.inputs} />
    </AppShell>
  );
}
