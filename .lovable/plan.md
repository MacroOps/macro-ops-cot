# Next-Level Roadmap — Macro HUD

You've already got the bones of a serious terminal: CoT ingestion, Trend Fragility, Risk Cycle, Breadth, TPMR composites, Backtests Lab with history/compare, Copilot drawer, workspaces, regime ribbon. Here's what would actually move it from "nice prototype" to "thing prop traders keep open all day."

## Tier 1 — Intelligence Layer (biggest leverage)

**1. Agentic Copilot, not just chat**
Today the Copilot is single-shot chat + one backtest tool. Upgrade to an AI SDK agent loop with real tools:
- `query_indicator(key, symbol, range)` — pulls live series
- `run_backtest(params)` — reuses the Lab engine, persists to history
- `compare_regimes(indicator, regimeA, regimeB)`
- `find_analogs(currentVector, k)` — nearest-neighbor historical periods
- `scan_extremes(threshold)` — sweeps all indicators for percentile outliers
- `cite_source(report_date, market)` — pulls the actual CoT row
Stream `message.parts` with tool accordions (AI Elements `Tool`), so the user sees the chain-of-reasoning + cited data, not just prose.

**2. Daily Briefing (auto-generated)**
A cron'd edge function that, every morning at NY open:
- Snapshots every indicator's percentile + 1w delta
- Flags what crossed a threshold overnight
- Generates a 6-bullet markdown brief via Gemini, cited with chart deep-links
- Lands on `/briefing/today` and as a "What changed" card on Overview
This is the single feature that makes people open the app daily.

**3. Alert Engine**
`alerts` table + condition DSL ("Trend Fragility S&P > 75 AND Risk Cycle in 'Risk-Off'"). Background worker evaluates on each ingest, fires browser push + optional email. Alerts compose from the same indicator registry the Lab uses.

**4. Analog Engine**
Vectorize the current macro state (positioning percentiles + regime flags + breadth) and run cosine similarity vs. every historical week. "Today most resembles: Jul 2007 (87%), Feb 2018 (84%)…" with side-by-side forward path overlays. This is genuinely novel and visually killer.

## Tier 2 — UX / Killer UI

**5. Command-K everything**
Palette already exists — extend to: jump to any indicator on any symbol, run backtest from natural language ("backtest gold MM net > 80th, 20d"), open Copilot with context, pin to workspace. Fuzzy + recent + AI-suggested actions.

**6. Cross-chart hover sync + scrubber**
You have `ChartSyncContext`. Add a global date scrubber pinned to the AppShell footer that drives every chart simultaneously — drag through history, watch all indicators move together. Add an "as of" mode that recomputes percentile context up to that date only (no lookahead bias).

**7. Storyboards**
A user can save a sequence of (chart + annotation + caption) frames as a "Storyboard" (e.g., "Why I'm short copper") and share via signed URL. Effectively Bloomberg LAUNCH + Notion.

**8. Density / focus modes**
Bloomberg-style 4-pane mosaic with drag-to-resize, save layouts per workspace. Right now `IndicatorCard` is a fixed grid — let users compose.

**9. Heatmap Overview**
Replace/augment the hero tiles with a single dense heatmap: rows = indicators, cols = markets, cell = current percentile (color) + sparkline. One screen = entire state of the world.

**10. Polish pass**
- Real loading skeletons (still some flashes)
- Empty-states with CTAs ("No backtests yet → Run sample")
- Keyboard nav on every table
- A real brand mark (the app still feels lucide-generic in a few places)
- Tighter mono numerics, consistent percentile color ramp across the app

## Tier 3 — Data depth

**11. Options positioning** — CBOE put/call, dealer gamma, vanna/charm proxies (open-source approximations).
**12. ETF flows** — daily creations/redemptions for SPY/QQQ/HYG/TLT/GLD.
**13. Fed & macro calendar** — overlay FOMC, CPI, NFP on every chart.
**14. Cross-asset correlation matrix** — rolling 60d, with regime-conditional view.
**15. News → indicator linkage** — your `ingest-news` already runs; tag each headline to affected markets and surface inline on charts.

## Tier 4 — Collab & distribution

**16. Public share links** — any chart, backtest, or storyboard → signed URL with OG image (generated server-side from the chart SVG).
**17. Team workspaces** — invite + RLS by team_id.
**18. Export** — backtest results to CSV, briefings to PDF (you already have /mnt/documents pattern).

---

## Suggested build order

```text
Phase 1 (1-2 sessions): Agentic Copilot + Daily Briefing
  → immediate "wow", reuses existing infra

Phase 2: Alert Engine + Analog Engine
  → the two features no competitor has

Phase 3: Heatmap Overview + Global Scrubber + Storyboards
  → UI moment that makes screenshots go viral

Phase 4: Options/ETF flow data + News linkage
  → depth that retains users

Phase 5: Sharing, teams, exports
  → distribution
```

## My pick if you only do one thing next

**Agentic Copilot + Daily Briefing together.** They share the same tool registry, they make every other feature you've already built discoverable through natural language, and a morning briefing is the single highest-retention surface a research tool can have.

Want me to scope Phase 1 in detail and start building, or pick a different starting point?
