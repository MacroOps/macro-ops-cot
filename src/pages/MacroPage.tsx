import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { CompositePanel } from "@/components/hud/CompositePanel";
import { InputsRequired } from "@/components/hud/InputsRequired";
import { MO_LIQUIDITY, MO_INFLATION_LEAD, type IndicatorSpec } from "@/lib/indicatorSpecs";

type Section = {
  title: string;
  eyebrow: string;
  description?: string;
  charts: { title: string; subtitle?: string; min?: number; max?: number; drift?: number }[];
};

const SECTIONS: Record<string, Section> = {
  "mo-indicators": {
    eyebrow: "Macro",
    title: "MO Indicators",
    description: "Top-level proprietary cycle indicators.",
    charts: [
      { title: "MO: Growth Indicator", subtitle: "Cycle · -100 to +100", min: -100, max: 100 },
      { title: "MO: Liquidity Indicator", subtitle: "High / Low Liquidity · 0–100%", drift: 0.2 },
      { title: "MO: Inflation Lead Indicator", subtitle: "YoY %", min: -2, max: 10, drift: -0.4 },
      { title: "MO: Credit & Energy Shock", subtitle: "Composite", min: 0, max: 100, drift: 0.1 },
    ],
  },
  "us-growth": {
    eyebrow: "Macro · US",
    title: "US Growth",
    charts: [
      "ISM Manufacturing PMI", "ISM Services PMI", "Industrial Production YoY",
      "Retail Sales YoY", "Real GDP YoY", "Consumer Confidence",
      "Building Permits", "Durable Goods Orders", "Capacity Utilization",
    ].map((title) => ({ title, subtitle: "Series" })),
  },
  labor: {
    eyebrow: "Macro · US",
    title: "Labor",
    charts: [
      "Non-Farm Payrolls (MoM)", "Unemployment Rate", "Initial Jobless Claims",
      "Continuing Claims", "Wage Growth YoY", "Labor Force Participation",
      "Quits Rate (JOLTS)",
    ].map((title) => ({ title })),
  },
  "global-growth": {
    eyebrow: "Macro · Global",
    title: "Global Growth",
    charts: [
      "China Caixin PMI", "Eurozone PMI Composite", "Japan Tankan",
      "EM Industrial Production", "Global Trade Volume", "Baltic Dry Index",
    ].map((title) => ({ title })),
  },
  liquidity: {
    eyebrow: "Macro · Liquidity",
    title: "Liquidity",
    charts: [
      "Global M2 (USD)", "Fed Balance Sheet", "Reverse Repo (RRP)",
      "TGA Balance", "Bank Reserves", "USD DXY",
      "Net Liquidity (Fed - RRP - TGA)",
    ].map((title) => ({ title })),
  },
  inflation: {
    eyebrow: "Macro · Inflation",
    title: "Inflation",
    charts: [
      "CPI YoY", "Core CPI YoY", "PPI YoY", "PCE YoY", "Core PCE YoY",
      "5y Breakevens", "10y Breakevens", "Median CPI", "Sticky CPI",
    ].map((title) => ({ title })),
  },
  recession: {
    eyebrow: "Macro · Cycle",
    title: "Recession",
    charts: [
      "Sahm Rule", "Yield Curve (10Y-2Y)", "Yield Curve (10Y-3M)",
      "LEI YoY", "Conference Board Recession Prob.", "Chicago Fed NFCI",
      "Heavy Truck Sales", "Initial Claims 4w Avg",
    ].map((title) => ({ title })),
  },
  "implied-regime": {
    eyebrow: "Macro · Implied",
    title: "Market-Implied Macro Regime (6m)",
    description: "Cross-asset implied probability of each regime in 6 months.",
    charts: [
      { title: "Recession", subtitle: "0–100%" },
      { title: "Goldilocks", subtitle: "0–100%" },
      { title: "Overheating", subtitle: "0–100%" },
      { title: "Stagflation", subtitle: "0–100%" },
    ],
  },
};

const SPEC_OVERRIDES: Partial<Record<string, IndicatorSpec>> = {
  liquidity: MO_LIQUIDITY,
  inflation: MO_INFLATION_LEAD,
};

export default function MacroPage({ slug }: { slug: keyof typeof SECTIONS }) {
  const spec = SPEC_OVERRIDES[slug as string];
  if (spec) {
    return (
      <AppShell title={`Macro · ${spec.name}`}>
        <PageHeader
          eyebrow="Macro"
          title={spec.name}
          description={spec.description}
        />
        <CompositePanel spec={spec} seed={600 + slug.length} />
        <CardGrid cols={spec.components.length <= 4 ? 2 : 3}>
          {spec.components.map((c, i) => (
            <IndicatorCard
              key={c.id}
              component={c}
              subtitle={c.output === "zscore" ? "Z-score" : "0–100%"}
              seed={610 + slug.length * 3 + i}
              variant="line"
            />
          ))}
        </CardGrid>
        <InputsRequired inputs={spec.inputs} />
      </AppShell>
    );
  }

  const s = SECTIONS[slug];
  const cols = s.charts.length <= 4 ? 2 : 3;
  return (
    <AppShell title={`Macro · ${s.title}`}>
      <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} />
      <CardGrid cols={cols as 2 | 3}>
        {s.charts.map((c, i) => (
          <IndicatorCard
            key={c.title}
            title={c.title}
            subtitle={c.subtitle}
            seed={500 + slug.length * 7 + i}
            variant="area"
            min={c.min}
            max={c.max}
            drift={c.drift}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}
