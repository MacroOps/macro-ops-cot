import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";

export function BreadthOverview() {
  return (
    <AppShell title="Breadth · Overview">
      <PageHeader eyebrow="Breadth" title="Breadth & Thrust Score" />
      <div className="p-3 space-y-3">
        <IndicatorCard
          title="MO: Breadth & Thrust Score"
          subtitle="Composite · 0–15"
          seed={401}
          variant="bar"
          height={220}
          min={0}
          max={15}
        />
        <IndicatorCard
          title="Macro Ops | Breadth Components"
          subtitle="5-series stacked · 0–4 each"
          seed={402}
          variant="bar"
          height={220}
          min={0}
          max={4}
        />
        <IndicatorCard
          title="Macro Ops | Breadth Thrust Components"
          subtitle="10-series stacked · 0–10"
          seed={403}
          variant="bar"
          height={220}
          min={0}
          max={10}
        />
      </div>
    </AppShell>
  );
}

const COMPONENTS = [
  "Breadth: 50 & 200 Day SMA",
  "McClellan Summation & Oscillator",
  "S&P 500 | Sectors Above 200 SMA",
  "NYSE | Advance-Decline Line",
  "NYSE | New Lows (All US)",
  "NYSE | New Highs − New Lows",
];
export function BreadthComponents() {
  return (
    <AppShell title="Breadth · Components">
      <PageHeader eyebrow="Breadth" title="Components" />
      <CardGrid cols={3}>
        {COMPONENTS.map((t, i) => (
          <IndicatorCard
            key={t}
            title={t}
            subtitle="% of stocks / index"
            seed={410 + i}
            variant="line"
            thresholds={{ hi: 90, lo: 20 }}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}

const THRUSTS = [
  "Russell 3000 | % > 10D SMA",
  "S&P 500 | % Making New 20D Highs",
  "S&P 500 | % > 50D SMA (15%→90% in <50D)",
  "NYSE | Zweig Breadth Thrust",
  "S&P 500 | % With MACD Buy",
  "S&P 500 | % With RSI > 70",
];
export function BreadthThrusts() {
  return (
    <AppShell title="Breadth · Thrusts">
      <PageHeader eyebrow="Breadth" title="Thrusts" />
      <CardGrid cols={3}>
        {THRUSTS.map((t, i) => (
          <IndicatorCard
            key={t}
            title={t}
            seed={420 + i}
            variant="line"
            thresholds={{ hi: 90 }}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}

const CAPS = [
  "S&P 500 | % Making New 20D Lows",
  "S&P 500 | % Below Upper BB",
  "S&P 500 | % With RSI < 30",
  "S&P 500 | 5D ROC Price Capitulation",
  "S&P 500 | Correlation Between Sectors",
];
export function BreadthCapitulation() {
  return (
    <AppShell title="Breadth · Capitulation">
      <PageHeader eyebrow="Breadth" title="Capitulation" />
      <CardGrid cols={3}>
        {CAPS.map((t, i) => (
          <IndicatorCard
            key={t}
            title={t}
            seed={430 + i}
            variant="line"
            min={t.includes("ROC") ? -15 : 0}
            max={t.includes("ROC") ? 5 : 100}
            thresholds={{ lo: 20 }}
          />
        ))}
      </CardGrid>
    </AppShell>
  );
}
