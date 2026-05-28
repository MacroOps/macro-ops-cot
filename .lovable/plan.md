# HUD Platform Expansion — Glassnode-style Layout

Today the app is the CoT dashboard. We restructure it into a multi-section research platform modeled on Glassnode Studio's layout, keeping the current charcoal/solar styling. CoT becomes **one** collapsible group in the sidebar; every other model from the Macro Ops HUD inventory gets scaffolded with mock data so the IA, navigation, and page chrome are real even before live data lands.

## Information architecture

Left sidebar groups (collapsible, each expands to sub-pages — like Glassnode's "Bitcoin > On-chain > ..."):

```text
Macro HUD
├── Overview                       (new home: top-level summary tiles)
├── Trend Fragility                (banner + 6 component charts)
├── Risk Cycle                     (banner + 4 components)
├── Market Internals               (banner + 6 ratio panels w/ Internals/Divergence toggle)
├── Breadth
│    ├── Overview
│    ├── Components
│    ├── Thrusts
│    └── Capitulation
├── Positioning (CoT)              ← everything currently in the app lives here
│    ├── Global Positioning        (current "/" dashboard)
│    ├── Asset Detail              (current /asset/:symbol)
│    ├── Sector Aggregates
│    ├── News & Divergence
│    └── Backtests Lab
├── Macro
│    ├── MO Indicators             (Growth / Liquidity / Inflation Lead / Credit-Energy Shock)
│    ├── US Growth
│    ├── Labor
│    ├── Global Growth
│    ├── Liquidity
│    ├── Inflation
│    ├── Recession
│    └── Implied Regime            (Recession / Goldilocks / Overheating / Stagflation probs)
└── Tools
     └── Position Sizing           (calculator, ~60 instruments)
```

Top-of-page asset selector (Glassnode style) appears on pages that are asset-scoped — Positioning > Asset Detail, and any future asset-scoped charts. Other pages are dashboards of fixed panels.

## Layout chrome

- Sidebar stays `collapsible="icon"` (existing pattern). Each group uses a Radix Collapsible header with a chevron; clicking expands sub-items. Active sub-item highlighted; parent group auto-opens when a child route is active.
- Header keeps the existing AppShell bar; add a **breadcrumb** (Group › Page) next to the sidebar trigger so users know where they are inside a deep group.
- Page body uses a consistent `PageHeader` (title, optional asset selector, optional time-range chip) + a card grid. All cards use the existing `hud-panel` styling, semantic tokens only — no new color literals.

## Pages to scaffold (mock data)

Each non-CoT page gets a working route, a `PageHeader`, and a grid of `IndicatorCard`s rendering deterministic mock series via Recharts (already in the project). One shared `useMockSeries(seed, points, range)` hook generates plausible percentile / oscillator data so the visuals look real.

| Route                          | Cards (mock) |
| ------------------------------ | ------------ |
| `/overview`                    | 6 KPI tiles (Trend Fragility, Risk Cycle, Market Internals, Breadth Score, Liquidity, Implied Regime) + mini CoT extremes strip |
| `/trend-fragility`             | 1 banner + 6 components (Call/Put, AAII, Pairwise Corr, Fund Flows, Net Spec, Regime Index) |
| `/risk-cycle`                  | 1 banner + 4 (FINRA Margin, Schwab STAX, Lev Funds Sentiment, Forward PE) |
| `/market-internals`            | 1 banner + 6 ratio panels, each with per-card `Internals ▼ / Divergence ▼` dropdown |
| `/breadth/overview`            | 3 stacked-bar panels (Breadth+Thrust Score, Components, Thrust Components) |
| `/breadth/components`          | 6 panels w/ index + view dropdowns |
| `/breadth/thrusts`             | 6 panels |
| `/breadth/capitulation`        | 5 panels (fix the legacy empty slot — use a 2-col row for the last 2) |
| `/macro/mo-indicators`         | 2x2: Growth, Liquidity, Inflation Lead, Credit/Energy Shock |
| `/macro/us-growth`             | 9 fundamental series |
| `/macro/labor`                 | 7 (no empty slots — auto-fit grid) |
| `/macro/global-growth`         | 6 |
| `/macro/liquidity`             | 7 |
| `/macro/inflation`             | 9 |
| `/macro/recession`             | 8 |
| `/macro/implied-regime`        | 4 (Recession / Goldilocks / Overheating / Stagflation) |
| `/tools/position-sizing`       | Form (asset, account size, risk bps, long/short, entry, exit) + output panel. Ships with the ~60-instrument list grouped by Equities Futures / Metals / Energy / Ag / Currencies / Fixed Income. Calc logic = pure-frontend stub (contracts = floor(risk$ / (|entry-exit| × multiplier))). |

## Existing routes — moved, not deleted

Current routes keep working; we just regroup them in the sidebar under **Positioning**. URLs preserved so deep links / backtest URLs don't break:
- `/` → still the Global Positioning dashboard
- `/asset/:symbol`, `/sectors`, `/news`, `/backtests`, `/auth` unchanged

## Implementation order

1. **Sidebar restructure** — refactor `AppSidebar` to render grouped nav with collapsible sub-menus; auto-expand on active child route. Add breadcrumb to `AppShell`.
2. **Shared scaffolding** — `PageHeader`, `IndicatorCard`, `useMockSeries`, `AssetSelector` (header dropdown), `RangePicker` (1M/3M/6M/1Y/All).
3. **Page stubs** — add all routes in `App.tsx`, each rendering a working page with mock cards. One file per page under `src/pages/<group>/<page>.tsx`.
4. **Position Sizing tool** — instrument catalog + form + calculation stub.
5. **Overview page** — pulls real CoT extremes (from existing `useDashboardData`) plus mock tiles for the other indicators, so the landing feels alive.

## Technical notes

- All new colors via existing semantic tokens (`--pos-long`, `--pos-short`, `--surface`, `--accent`). No hex literals in components.
- Recharts already installed; reuse it for every mock chart.
- No backend changes in this pass — mock-only for new sections. Live ingestion for each model becomes a follow-up task (e.g., Trend Fragility components → edge function + table).
- `tabs.tsx`, `collapsible.tsx`, `navigation-menu.tsx`, `select.tsx` already present — no new shadcn installs needed.
- Mobile: sidebar collapses to icons; page grids drop to 1 col under `md`.

## Out of scope (call out as follow-ups)

- Real data wiring for non-CoT models
- User-composable / drag-and-drop dashboards (Glassnode "Studio" feature)
- Saved chart presets, watchlists beyond the existing one
- Auth-gating per section
