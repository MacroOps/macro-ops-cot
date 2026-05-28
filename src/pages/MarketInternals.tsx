import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";

const RATIOS = [
  { title: "SOXX / SPY", seed: 301 },
  { title: "Cyclical / Defensives", seed: 302 },
  { title: "Discretionary / Staples", seed: 303 },
  { title: "LQD / IEF", seed: 304 },
  { title: "VIX3M / VIX", seed: 305 },
  { title: "High Beta / Low Volatility", seed: 306 },
];

type View = "internals" | "divergence";

function RatioCard({ title, seed }: { title: string; seed: number }) {
  const [view, setView] = useState<View>("internals");
  return (
    <IndicatorCard
      title={title}
      subtitle={view === "internals" ? "Ratio · 0–100%" : "Divergence vs SPX"}
      seed={seed + (view === "divergence" ? 10_000 : 0)}
      variant="line"
      min={view === "divergence" ? -50 : 0}
      max={view === "divergence" ? 50 : 100}
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
        title="Market Internals"
        description="Risk-on / risk-off ratio panels. Toggle each card between raw internals and divergence vs SPX."
      />
      <div className="px-3 pt-3">
        <IndicatorCard
          title="Macro Ops | Market Internals (Composite)"
          subtitle="Net signal · ±80%"
          seed={300}
          variant="area"
          height={240}
          min={-80}
          max={80}
          drift={0.4}
          thresholds={{ hi: 50, lo: -50 }}
        />
      </div>
      <CardGrid cols={3}>
        {RATIOS.map((r) => (
          <RatioCard key={r.seed} title={r.title} seed={r.seed} />
        ))}
      </CardGrid>
    </AppShell>
  );
}
