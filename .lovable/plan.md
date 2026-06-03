## Phase 2 — Chart Intelligence & Workspaces

Phase 1 shipped the Copilot drawer, per-chart "Ask", backtests, Signals Tape, and ⌘K palette. Next, push the terminal feel deeper into the charts themselves and let users save their work.

### A. Synced crosshair + global time range
- New `ChartSyncContext` (hover date + active range preset) consumed by every `IndicatorCard`.
- Hovering one chart broadcasts the timestamp; all other charts on the page draw a vertical reference line at the same `t` and show the matching value in the header readout.
- Page-level `RangeBar` (1M · 3M · 6M · 1Y · 3Y · MAX + custom brush sync) above each CardGrid. Cards slice their series to the active window; brush still works per-card for drill-in.
- Keyboard: `[` / `]` step range, `\` resets.

### B. Chart toolbar (per card)
Replace the lone Ask button with a compact toolbar revealed on hover:
- Ask Copilot (existing)
- Backtest this threshold (opens Copilot with backtest tool pre-armed)
- Add to Workspace
- Annotate (drop a note pinned to current `t`/`v`)
- Fullscreen (modal with larger chart + stats strip: z-score, percentile, 1M/3M/1Y change, regime tag)

### C. Annotations layer
- `annotations` table in Lovable Cloud (`user_id`, `indicator_key`, `t`, `v`, `note`, `color`, `created_at`) with RLS.
- Rendered as `ReferenceDot` + hover tooltip on charts; list view in a side rail.
- Copilot can read annotations as context ("what did I write about Trend Fragility last month?").

### D. Workspaces
- `workspaces` + `workspace_items` tables (RLS by user).
- New `/workspace/:id` route renders any saved indicators in a draggable bento grid (resizable via `react-grid-layout`, already a small add).
- "Add to Workspace" from any chart, "Save current page as workspace" from page header.
- Sidebar gets a Workspaces section listing user workspaces.

### E. Signals Tape upgrades
- Filter chips: severity (info/warn/critical), category (Trend / Risk / Breadth / TCTM / Positioning), asset.
- Sticky pinning + "mute until value crosses back" per signal.
- "Explain" button → Copilot with the signal as context.
- Persist firings to a `signal_events` table so the tape survives reloads and gets a real timeline.

### F. Regime ribbon
Thin strip above the Overview hero showing current macro regime (Growth ↑/↓, Liquidity ↑/↓, Inflation ↑/↓, Risk On/Off) derived from existing composites — single source of truth users see on every page via `AppShell`.

### Technical notes
- New context: `src/components/hud/ChartSyncContext.tsx`, `src/components/hud/RangeBar.tsx`.
- Extend `IndicatorCard` with optional `indicatorKey` for sync/annotations and a `ChartToolbar` subcomponent; preserve current props.
- New tables via migration with explicit GRANTs + RLS (`auth.uid() = user_id`).
- `react-grid-layout` for workspace canvas (lightweight, BSD).
- All Copilot context payloads extended to include annotations and active range.

### Suggested build order
1. ChartSyncContext + RangeBar + hover broadcast (visible win, no backend)
2. Per-card ChartToolbar + Fullscreen modal with stats strip
3. Annotations (table + UI + Copilot context)
4. Workspaces (tables + route + drag/resize + sidebar entry)
5. Signals Tape filters + persistence + Explain
6. Regime ribbon in AppShell

Want me to do all six in one pass, or start with **1 + 2 + 3** (the chart-intelligence trio) and do workspaces/signals/regime in a follow-up?
