# Align scaffold to the MO indicator spec

The current scaffold uses generic mock cards. The audit (HUD_DOC) + construction doc (MO_Indicators) give us exact components, lookbacks, and scoring rules. This pass makes the scaffold a faithful blueprint of the real models so (a) the UI is correct even while data is mocked and (b) wiring real data later is a fill-in-the-blanks job, not a redesign.

## 1. One source of truth: indicator specs

New file `src/lib/indicatorSpecs.ts` — typed records, one per composite, encoding what the construction doc says:

```ts
type ComponentSpec = {
  id: string;
  title: string;
  inputs: string[];        // data series the component needs (e.g. "OCC Put/Call")
  steps: string[];         // bullet-by-bullet formula from the doc
  output: "percentile" | "zscore" | "ratio" | "signal" | "score";
  scale?: { min: number; max: number };
  thresholds?: { hi?: number; lo?: number };
};
type IndicatorSpec = {
  slug: string;
  name: string;
  category: "trend-fragility" | "risk-cycle" | "market-internals" | "breadth" | "thrust" | "macro";
  composite: { steps: string[]; output: ComponentSpec["output"]; scale?: ... };
  components: ComponentSpec[];
};
```

Specs to encode verbatim from the doc:
- **Trend Fragility** — 6 components (Fund Flows 100d rolling sum→pct; Put/Call inverted, 10d MA, 10y pct; AAII bull-bear diff, 5d MA, pct; Net Specs/OI 152w stoch; Market Regime = mean/sd × √100 over 100d log returns; Pairwise Corr inverted→pct). Composite = mean→pct→5d MA.
- **Market Internals** — 8 ratios (SOXX/SPY, Cyc/Def with explicit XLF/XLE/XLB/XLI/XLY vs XLU/XLP/XLRE, RSPD/RSPS, LQD/IEF, VIX3M/VIX, SPHB/USMV, %>10D SMA→10d MA, SPY 63d stoch). Composite = median of 63d stochs minus SPY 63d stoch, 5d MA.
- **Risk Cycle** — 4 components (FINRA margin 12m RoC→pct; STAX raw; Lev Funds long/(long+short) across ES/YM/NQ, 3w MA, pct; Forward P/E pct). Composite = mean→pct→5d MA.
- **Breadth Aggregator** — 5 weighted scoring rules (max score = 6: 1+2+1+1+1). Encode the exact thresholds (0.20 rolling-min on %>50/200 SMA; 0.05 divergence percentile rules).
- **Breadth Thrust Aggregator** — 10 binary signals split 6 thrust / 4 capitulation, with exact 0.998 / 0.00317 / 0.90 / "15→90 in <50d" thresholds and 63d rolling max/min logic.
- **MO Liquidity** — 4 inputs (NFCI, 10Y, HY effective yield, HY OAS). Composite = avg 504d z-score × −1 → 756d pct.
- **MO Inflation Lead** — 5 inputs (gasoline, NFIB price pressures, M2, ISM Mfg, home prices). Composite = 84mo z-score average.

(Growth / Credit-Energy Shock / regional macro pages stay generic until the user supplies their formulas.)

## 2. UI changes driven by the specs

- **`IndicatorCard` gains a "Construction" affordance** — an `Info` icon in the card header opens a popover (shadcn `Popover`) showing inputs + step-by-step formula pulled from the spec. Closed by default. Reuses the spec's `scale.{min,max}` and `thresholds` so we stop hard-coding them per page.
- **`CompositePanel` (new)** — banner card that renders the composite chart plus a small "How it's built" subline (e.g. "Mean of 6 components → percentile → 5d MA"). Used on Trend Fragility, Risk Cycle, Market Internals, MO Liquidity.
- **Pages re-derive their card grid from the spec**, so the count and titles match the doc exactly. Removes the discrepancy between e.g. the Market Internals page (currently 6 cards) and the actual 8-component model.
- **Breadth pages** — `breadth/components` becomes the 5-rule Aggregator (each card shows: input series, rolling-min window, threshold, current score 0/1/2). `breadth/thrusts` and `breadth/capitulation` render the 6+4 binary-signal grid with the actual threshold annotations on each chart.
- **"Inputs Required" rail** — collapsible footer block on each composite page listing the raw data series the model consumes (e.g. AAII weekly, OCC put/call, CFTC TFF Lev Funds across ES/YM/NQ, FRED `DGS10` / `BAMLH0A0HYM2` / `BAMLH0A0HYM2EY` / `NFCI`, ICI weekly fund flows). This becomes the checklist for the ingestion phase.

## 3. Fixes from the audit that bleed into the scaffold

- **Empty grid slots** (Capitulation, Labor, Liquidity, Recession): card grids already use `auto-fit`; spec-driven counts confirm no holes.
- **Equities missing Valuation chart** — when we ship the CoT instrument view rebuild, render the 9-chart grid uniformly and replace the empty Equities slot with a documented "n/a for equities" placeholder.
- **Per-card dropdown inconsistency** — keep the Market Internals "Internals / Divergence" toggle, but standardize the dropdown styling (we already do via the shadcn select pattern).
- **Y-axis label overlap / redundant titles** — `IndicatorCard` already moves the title out of the chart area; nothing further needed.

## 4. Out of scope this pass (call out as follow-ups)

- Real data ingestion for any new model (FRED, FINRA, AAII, ICI, OCC, Schwab STAX). Each becomes its own edge function + table pass.
- Position Sizing — already correct vs the audit.
- History/Previews split inside the CoT instrument tabs (audit's section 7) — handle in a separate CoT-UI pass.
- Authoring `Construction` content for Growth/Credit-Energy Shock/Macro regional pages — needs the user's spec.

## File touch list

- new: `src/lib/indicatorSpecs.ts`, `src/components/hud/CompositePanel.tsx`, `src/components/hud/ConstructionPopover.tsx`, `src/components/hud/InputsRequired.tsx`
- edit: `src/components/hud/IndicatorCard.tsx` (consume spec, info popover)
- edit: `src/pages/TrendFragility.tsx`, `RiskCycle.tsx`, `MarketInternals.tsx`, `Breadth.tsx`, `MacroPage.tsx` (Liquidity + Inflation sections only)
