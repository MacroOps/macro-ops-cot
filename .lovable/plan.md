
# Institutional Redesign — Porcelain & Electric

A full redesign moving the platform off the current Solarized cream/orange aesthetic toward a cool, light-forward institutional look anchored in greys, light blues, and a single vivid electric blue accent (used at restrained intensity ~3/5). Matching dark mode included.

## Design language

**Light mode (default)**
- Background: `#f6f8fb` porcelain
- Surface / cards: `#ffffff` with `#e6ecf3` hairline borders
- Muted surface: `#eef2f7`
- Mid greys: `#dbe3ed` → `#5b6b80` (a 6-step slate scale)
- Ink / foreground: `#1a2433` near-navy black
- Accent (primary): `#1e63ff` electric blue — used sparingly: primary CTA, active nav, focus rings, key chart series, signal highlights
- Accent soft: `#7aa8ff` for secondary chart series & hovers
- Semantic: long `#0a8f5f`, short `#d83a4a`, neutral `#5b6b80`, warning `#c8861a`, info reuses accent

**Dark mode**
- Background: `#0b1220` deep slate-navy (not pure black — institutional, not terminal)
- Surface: `#121a2b` with `#1f2a40` borders
- Foreground: `#e6ecf3`
- Accent stays `#3b7bff` (slightly lifted for contrast)
- Charts keep a *near-white panel* (`#f4f7fb` at ~6% inset shadow) inside dark cards — the "data canvas always reads as paper" pattern used by Bridgewater/Two Sigma research decks. Toggle option: full-dark charts for night use.

**Typography**
- Headers: tight grotesk (Inter Display or Space Grotesk) at 600 weight, slight negative tracking
- Body / UI: Inter at 400/500
- Numerics: JetBrains Mono (already in project) with tabular + zero-style features — keep
- Type scale tightened: 11/12/13/15/18/22/28 (currently jumps too aggressively)

**Density & geometry**
- Border radius drops from 0.25rem to 0.1875rem (3px) — sharper, more institutional
- 1px hairline borders everywhere (no shadows except a single `0 1px 0` ledger line under sticky headers)
- 4/8/12/16 spacing scale enforced
- Sidebar: narrower (224px), denser nav, accent left-bar on active item instead of background fill

## Chart upgrades (layered blues direction)

Apply across `IndicatorCard`, `AssetDetail` price/CoT charts, sector charts, breadth, backtests:

- Canvas: pure `#ffffff` with `#eef2f7` hairline grid (horizontal only by default, vertical on hover-crosshair)
- Primary series: `#0a84ff` at 1.5px
- Secondary series: `#7aa8ff` at 1.25px
- Reference / comparison: `#475569` dotted 1px
- Long/short fills: accent blue tints (`#0a84ff` @ 12%) for net-long zones, slate (`#475569` @ 12%) for net-short — less alarming than red/green, more research-paper
- Threshold lines: 1px dashed slate with small inline labels right-aligned
- Axis labels: 10px Inter, slate `#5b6b80`, tabular numerics
- Crosshair: full-height hairline + value bubble (rounded 2px, white, 1px border)
- Tooltips: white card, 1px border, mono numerics, ISO date, delta vs prior
- New: subtle **range brush** under multi-year charts (the 2y/5y/10y/all picker becomes a draggable brush, not just buttons) — wired to the synced timescale system already in place
- New: **annotation rail** above x-axis for FOMC / CPI / OPEX markers (small vertical ticks, hover for label)
- Sparkline cards get a single trailing value chip + delta in accent blue/slate instead of orange

## Shell & component refresh

- **Sidebar (`AppSidebar`)**: switch to porcelain surface, active item = 2px left accent bar + ink text + `#eef2f7` background; section labels in 10px uppercase slate
- **Top header (`PageHeader`)**: thinner, ledger underline, breadcrumb in slate, page title in 22px grotesk
- **Cards (`IndicatorCard`, `MarketCard`, `CompositePanel`)**: white surface, hairline border, header row gains a tiny colored dot (accent/slate/long/short) for at-a-glance status
- **Tables (`hud-table`)**: zebra removed, replaced with 1px row dividers in `#eef2f7`; sticky header with ledger underline; numerics right-aligned, tabular; sort carets in slate
- **Badges (`SignalBadge`)**: pill → squared 2px-radius chip, 10px mono, accent-blue for BULLISH, slate for NEUTRAL, muted red for BEARISH (desaturated from current)
- **Buttons**: primary = accent blue solid, secondary = white + 1px slate border, ghost = slate text only
- **Inputs / selects**: 1px slate border, accent focus ring at 2px, no inner shadow

## Dashboard composition (Overview / Index)

- Top strip: 4 KPI tiles (Risk Cycle, Trend Fragility, Breadth, Composite Signal) — large numeric, small sparkline, accent dot
- Two-column grid below: left = signal stack (composite panels), right = watchlist + news
- Section headers gain a thin ledger line + uppercase eyebrow
- Removes current orange accent everywhere; nothing pulses in orange anymore (extremity badges shift to accent-blue pulse at low opacity)

## Implementation outline (technical)

1. **`src/index.css`** — replace `:root` and `.dark` token blocks with the new palette (all HSL). Update `--chart-surface` to pure white in light mode and porcelain-inset in dark. Tighten `--radius` to `0.1875rem`. Add new tokens: `--accent-soft`, `--ledger`, `--surface-2`.
2. **`tailwind.config.ts`** — add `accent-soft`, `ledger`; keep existing token mapping. No new color literals in components.
3. **`src/components/hud/ThemeProvider.tsx`** — rename internal theme keys from `solar`/`charcoal` to `light`/`dark`; persist; default `light`.
4. **`src/components/hud/IndicatorCard.tsx`** — swap stroke/grid/axis to new tokens; add crosshair + tooltip styling; add optional `secondarySeries` prop; status dot in header.
5. **`src/pages/AssetDetail.tsx`** — apply layered-blue series to price + CoT charts; add range brush under the synced timescale; preserve existing x-axis sync logic and dropdown.
6. **`src/components/hud/AppSidebar.tsx` + `PageHeader.tsx`** — restyle per shell spec; narrower sidebar; ledger underline.
7. **`SignalBadge.tsx`, `MarketCard.tsx`, `CompositePanel.tsx`, `PercentileGauge.tsx`** — token swap + geometry tightening.
8. **`src/pages/Index.tsx` / `Overview.tsx`** — recompose top KPI strip + two-column grid.
9. **`src/pages/Backtests.tsx`, `Breadth.tsx`, `SectorAggregates.tsx`, `EurexPositioning.tsx`, `MarketInternals.tsx`, `RiskCycle.tsx`, `TrendFragility.tsx`, `News.tsx`** — chart + table token sweep; no logic changes.
10. **Dark mode pass** — verify contrast (WCAG AA) on every page; chart-in-dark-card pattern verified visually.

### What does NOT change
- All data hooks, Supabase calls, edge functions, backtest logic, timescale sync logic, asset dropdown ordering — untouched
- Routing, page structure beyond composition tweaks listed above
- Mock data generators

### Risks
- Token sweep is wide (~25 files); a few component-level color literals may remain and need a second pass after first render review
- Chart tooltip restyling in Recharts requires per-chart prop updates; will batch by page

### Verification
- Visual QA each major page in light + dark after the token swap
- Confirm chart x-axes still align (recent fix preserved)
- Confirm no `text-white` / `bg-black` / hex literals reintroduced

Approve to proceed, or tell me what to adjust (e.g. swap accent shade, keep current sidebar, skip dashboard recomposition).
