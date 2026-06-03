# Design Upgrade Plan — Charts & Visual Identity

The CoT page works because the charts feel *designed*: paper-bright canvas, hairline grid, custom annotations, tabular legends, named series. Everywhere else still uses default Recharts. Goal: lift the entire app to that bar, then push 3–4 hero charts into "screenshot-worthy" territory.

## 1. Build a shared HUD chart primitive layer

A single `src/components/charts/` module so every chart inherits the CoT look automatically — no more per-page styling drift.

- `HudChartFrame` — paper surface, eyebrow + title + right-aligned meta (last value, Δ, as-of date), hairline ledger underline, optional corner stamp ("EXPERIMENTAL", "LIVE", source attribution).
- `HudAxis` / `HudGrid` — tnum axis labels in `--chart-axis`, dotted minor grid, solid zero line, smart tick reduction.
- `HudTooltip` — replaces shadcn default. Crosshair + vertical guideline, sticky right-edge readout (think Bloomberg), tabular values, delta vs prior, percentile chip.
- `HudLegend` — inline tabular legend with colored square + series name + current value + 1w/1m delta, not the floating pill style.
- `HudSeries` presets — `accent`, `accent-2`, `ink-muted`, `success`, `destructive`, `violet` — so series colors come from semantic tokens, never hex.
- `useChartCrosshair()` — shared hook that syncs hover x-position across stacked charts on the same page (already partially in `ChartSyncContext`, formalize it).

Outcome: every existing chart can swap to these primitives with ~10 lines of diff and instantly match the CoT look.

## 2. Signature chart treatments (the "wow" layer)

Four custom chart types that don't exist in Recharts out of the box — these become the app's visual signature.

- **Percentile-banded line.** Background renders 0–25 / 25–75 / 75–100 percentile bands in faint accent/ink, current line draws on top, dot pulses when in extreme band. Use on every indicator on `MacroPage`, `RiskCycle`, `Breadth`.
- **Regime-shaded timeline.** Vertical color washes behind the price line marking risk-on / risk-off / neutral regimes from `RegimeRibbon`. Replaces the separate ribbon strip on `Overview` and `RiskCycle`.
- **Analog overlay fan.** On `/analogs`, the top-8 historical paths render as semi-transparent threads radiating from t=0, with the median path in solid accent and a shaded IQR cone. Today's live path overlays in ink.
- **Heatmap cell with embedded sparkline.** `/heatmap` cells get a 12-week inline sparkline behind the percentile color, plus a tiny arrow glyph for 1w direction. Hover reveals a full popover chart.

## 3. Micro-details that sell the "research terminal" feel

Small, cumulative — these are what separate "nice chart" from "Bridgewater deck".

- **Hairline crosshair + axis halo.** Vertical guideline on hover, with a small filled chip on each axis showing the value at cursor (date on x, value on y).
- **End-of-series labels.** Last data point gets an inline label (series name + value) instead of a floating legend. Removes legend clutter on dense charts.
- **Annotation pins.** Lightweight markers for events (Fed meeting, earnings, regime flip) — small numbered circles on the timeline with hover tooltips. Sourced from `annotations.ts`.
- **Diff sparklines in tables.** Every numeric column in `Backtests` / `Alerts` / `Heatmap` gets a tiny 20-week sparkline next to the number.
- **Animated draw-in.** Series stroke draws left→right on mount (300ms, ease-out). One time only, not on every re-render. Subtle, used everywhere.
- **Smart number formatting.** `1,247` not `1247`; `+2.3%` colored by sign; basis points where appropriate; tabular nums everywhere (already partly done via `font-feature-settings`).

## 4. Layout & shell polish (non-chart)

- **Density toggle** in the global scrubber footer — `Compact / Comfortable` — that swaps card padding + chart heights app-wide via a CSS data attribute.
- **Page eyebrow + breadcrumbs** standardized via `PageHeader.tsx` — section, page title, as-of timestamp, source tag, share/export icon row.
- **Status dot in sidebar** for `/alerts` (unread count badge), `/briefing` (today/stale), `/backtests` (running).
- **Cmd-K palette** gets section grouping + recent commands + keyboard hint glyphs.
- **Print stylesheet** so any page can be exported as a clean PDF research note (no sidebar, paper background, page breaks before each section).

## 5. Rollout order

1. Build the `charts/` primitive layer + tooltip + axis + legend.
2. Migrate `MacroPage`, `RiskCycle`, `Breadth`, `IndicatorCard` to the primitives (no new features, just inherit the look).
3. Ship signature treatments: percentile bands → regime shading → analog fan → heatmap sparklines.
4. Layer in micro-details (crosshair, end labels, annotations, animated draw).
5. Shell polish (density toggle, page header, palette, print).

## Technical notes

- Keep Recharts as the engine; primitives are thin wrappers — no new chart lib.
- All colors via `--chart-*` tokens already in `index.css`. If a new semantic is needed (e.g. `--chart-band-low/mid/high`), add to `:root` + `.dark` + `tailwind.config.ts` together.
- Crosshair sync continues to use `ChartSyncContext`; extend it with `x` value + `seriesValues` map so the right-edge readout can pull from sibling charts.
- Animated draw uses `strokeDasharray` + `strokeDashoffset` transition, not framer — keeps bundle flat.
- Annotations layer is a separate `<Customized />` Recharts component reading from `annotations.ts`.

---

Want me to start with **(1) the primitive layer + migrate one page** as a proof of concept, or go straight for a **signature treatment** (percentile bands or analog fan) where the visual payoff is most dramatic?