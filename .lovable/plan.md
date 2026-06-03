## Backtesting, properly

The Backtests Lab already exists at `/backtests` — it's a CoT-only cohort backtester buried in a sub-group. We'll do three things in one pass: surface it, expand it to every indicator on the platform, and persist every run (manual or Copilot-triggered) into a history we can re-open and compare.

### 1. Discoverability — promote the page

- Lift "Backtests Lab" to a **top-level sidebar entry** with a `FlaskConical` icon (between Overview and Research).
- Add a "Backtests" tile to the Overview hero strip showing total runs + last run.
- Every `IndicatorCard` toolbar "Backtest" button currently opens the Copilot drawer. Change it to:
  - **Click** → opens `/backtests?indicator=<key>&symbol=<sym>&t=<hoverT>` with the lab pre-armed.
  - **Shift-click** → keeps current behavior (inline Copilot backtest in the drawer).
- Command palette: add "Backtest current chart" and "Open Backtests Lab".

### 2. Unified Backtest Lab — works on any indicator

Today the lab only backtests CoT positioning indicators on a single market via `runBacktest(asset.series, …)`. Generalize it so it can run on:

- CoT indicators (existing path — unchanged)
- **Trend Fragility composites** (`tf_score`, fragility z-score, regime flips)
- **Risk Cycle** (risk-on/off composite, vol-of-vol)
- **Breadth** (thrusts, capitulation triggers, % above 200dma)
- **Market Internals** (advance/decline, new highs/lows)
- **TPMR / TCTM** signal stages
- **Macro composites** (liquidity, inflation, recession)

Approach:

- New `src/lib/backtest/registry.ts` exposes `BacktestableIndicator` records:
  ```ts
  { key, label, group, range, loadSeries(symbol?) => Promise<{ t, v, price }[]> }
  ```
  Each registry entry knows where to pull its time series (existing hooks/specs in `src/lib/indicatorSpecs.ts`, `turningPointSpecs.ts`, `mockSeries.ts`, `useAssetData`, dashboard payload).
- Refactor `runBacktest` in `src/hooks/useBacktest.ts` to take `series: { t, v, price }[]` instead of `AssetSeriesPoint`, so any indicator with a price proxy can be backtested. CoT path keeps its existing API via a thin adapter.
- Lab UI gains a left rail "Indicator" picker grouped by category (CoT / Trend / Risk / Breadth / Internals / TPMR / Macro), plus an "Underlying" picker (defaults to the indicator's natural market, e.g. Trend Fragility → SPX; CoT → that contract).
- Add **regime filters**: only count signals when liquidity ↑ / inflation ↓ / VIX < X. Reuses `RegimeRibbon` source of truth.
- Stats strip already in place stays; we add **rolling hit rate**, **avg holding period**, **max consecutive losers**, and a **regime-tagged** distribution chart.

### 3. Run history & compare

New table `backtest_runs` (RLS by `user_id`):

| field | type |
|---|---|
| id | uuid |
| user_id | uuid |
| source | text (`lab` \| `copilot` \| `chart-toolbar`) |
| indicator_key | text |
| symbol | text |
| params | jsonb (condition, threshold, horizon, regime filters) |
| stats | jsonb (count, hit %, mean, median, edge, z, sharpe) |
| created_at | timestamptz |

- Every run from the Lab, the chart toolbar, or the Copilot drawer is saved (Copilot's `copilot-backtest` edge function gains a `persist: true` body flag; client inserts the row on success).
- New `/backtests/history` tab inside the Lab page:
  - Sortable table of past runs, filter by indicator/symbol/source/date.
  - Row click → re-loads params into the Lab.
  - Multi-select up to 4 rows → "Compare" view renders side-by-side stat cards + overlaid spaghetti paths.
- New `/backtests` route stays the lab; tabs across the top: **Run · History · Compare**.
- Sidebar Workspaces can pin a saved run as a tile (uses existing `workspaces` localStorage layer; the tile fetches the run row by id).

### Technical notes

- Migration: `backtest_runs` table + `GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_runs TO authenticated;` + `GRANT ALL ... TO service_role;` + RLS `auth.uid() = user_id` for all four commands. No `anon` grant.
- `copilot-backtest` edge function: accept `{ persist, indicatorKey, symbol, params }`, return the same payload plus optional `runId`. Client writes the row (edge function doesn't have user context unless we forward the JWT — simpler to insert from the client after receiving stats).
- `useBacktest` becomes indicator-agnostic. Keep the CoT-specific `INDICATOR_OPTIONS` but move it under the new registry.
- New files: `src/lib/backtest/registry.ts`, `src/pages/BacktestsHistory.tsx` (or tabs inside `Backtests.tsx`), `src/lib/backtest/persistence.ts`.
- Edited: `src/pages/Backtests.tsx` (tabs + indicator picker + regime filters), `src/components/hud/IndicatorCard.tsx` (toolbar Backtest → route), `src/components/hud/AppSidebar.tsx` (promote entry), `src/components/copilot/CopilotDrawer.tsx` (persist hook), `src/App.tsx` (no new route needed; tabs live inside `/backtests`), `supabase/functions/copilot-backtest/index.ts` (echo params for persistence).
- Anonymous users: lab still runs (results are computed client-side) but persistence is gated — show "Sign in to save this run" toast.

### Build order

1. Migration for `backtest_runs` + RLS/GRANTs.
2. Generalize `runBacktest` + create indicator registry; keep CoT lab green.
3. Add Lab tabs (Run/History/Compare) + indicator picker + regime filters.
4. Wire chart toolbar + Copilot drawer to persist and deep-link.
5. Sidebar promotion + Overview tile + command palette entries.
