# Outseta (Foundation Alpha)

This app (Terminus / Foundation Macro) uses Outseta for authentication, CRM, billing, and support.

- **Outseta subdomain:** `foundation-alpha-llc.outseta.com`
- **Skill:** `.agents/skills/outseta/SKILL.md` — read this before writing Outseta integration code.
- **MCP:** Cursor connects to `https://mcp.outseta.com` (OAuth). Confirm destructive or bulk CRM/billing changes with the user first.

## Rules

- Outseta is the source of truth for who the customer is and whether they paid.
- Gate product features with Outseta JWT `outseta:planUid`. Turning Point ⊂ Collective (same plan family). Company/ops is Team Plan (`7malDMWE`, $0, inactive, not sold). Route matrix: `src/lib/outseta/entitlements.ts`. Customer alpha includes live Collective routes plus Dual Trend Portfolio, TPMR Overview, Dual Trend universes, TCTM (TCTM - Live at `/tpmr/tctm-live` is Dean's manual static snapshot; Guides plus Glossary at `/tpmr/tctm/glossary` are Dean's static TPMR copy), and the TP signals lab (`tp` tier = Turning Point and Collective). Daily Briefing and Alerts stay Team Plan (indicator snapshot/eval is seeded mock). HUD regime ribbon and date scrubber are Team Plan only (seeded chrome). Remaining hybrid/mock stays Team Plan. Team Plan accounts can use in-app View as (Collective / Turning Point) for QA; it does not change Outseta.
- Keep Supabase for market data; do not use it as the billing or CRM system.
- Use `@outseta/react` on the frontend and `@outseta/node-sdk` on the server when implementing auth or billing in this repo.

## Community Alpha

- Weekly window logic lives in `supabase/functions/_shared/community-alpha/window.ts` (Luxon, America/Los_Angeles, Slack ts compared as integer microseconds) — one source of truth for DST-safe Friday 2 PM PT windows.
- Members page `/community-alpha` is Collective (and Team Plan). `community-alpha-read` verifies the Outseta JWT; staging mode is Team Plan only. Dashboard logic in `src/pages/communityAlphaDashboard.ts` stays a verbatim port of the reference, but its styling follows Terminus's design system.

## Design system exceptions (Terminus)

Intentional deviations from the HUD rules. Anything not listed here should follow the HUD tokens and components.

- **Before finishing any UI change, run `npm run design:check`.** It must end with `OK`. Fix violations in the code you touched. Do not add files to the allowlist in `scripts/design-check.mjs` without asking the user, and never add one just to make the check pass.

- **Classic HUD** (/classic-hud): separate product embedded as an iframe. It keeps its own visual language. Its tan ledger loader is the reference for HudLoader.
- **TCTM Live** (/tpmr/tctm-live): uses the HUD shell like the other TPMR pages: PageHeader, hud-panel style cards with a hairline header band, tinted signal badges (no solid fills or #fff), Hanken Grotesk only. Dean's numbers, tables and manual static copy are unchanged.
- **Charts stay on paper:** chart and table surfaces use hud-chart and the chart tokens in dark mode too.
- **Exports are white:** every chart or table export (`exportNodeToJpg`, TCTM JPG buttons) renders on `--export-surface` (white) with chart-token ink, in both themes, for research reports. On screen stays paper.
- **Chart exports look the same everywhere:** JPG, 1200x900 (800x600 layout rendered at 1.5x), a heading strip (title left, "As of MM/DD/YYYY" right, or "Exported …" when the chart has no data date) and only the plot, no toolbars. Files are named `<title-slug>_<YYYY-MM-DD>.jpg` by `src/lib/exportNaming.ts`, shared with TCTM. In a panel, mark the plot `data-chart-body`, legends and captions that must survive `data-export-keep`, and pass `asOf` (last data date) to `ChartExportButton`. Do not add a new export path.
- **Serif:** only for page titles (PageHeader), the paywall heading, and the sidebar wordmark (serif italic). Community Alpha day and week titles use grotesk, not serif.
- **Signal colors:** BULLISH is green (success). Bearish is red. Triggered takes the color of its TCTM composite: Risk-Off is red, the others are green. Neutral is gray.
- **Positioning reads are intentional and labeled in text:** directional (Sectors, Index) shows high as green. Contrarian (Offsides, Asset Detail) shows an extreme long as red. Do not mix the two on one screen without a text label.
- **Radius:** 2px everywhere. Round only avatars and counters. The copilot launcher stays round with a shadow.
- **Loading:** pages use HudLoader (tan line). Tables use Skeleton gray blocks. Chart areas may keep their own placeholders.
- **Heatmap meaning** (what high means per indicator) is pending real data. It is not final.
- Dual Trend sections share one loader (`src/hooks/useDualTrendUniverse.ts`) and one table (`DualTrendTable`); each section's label and universe live only in `src/lib/dualTrend/config.ts`. Pages and sector breadth read members, signals and returns only from the database (`dual_trend_members`, `dual_trend_signals`, `dual_trend_returns`), never from the API on page load; those tables are service-role only and pages read them through `dual-trend-read`, which checks the Outseta plan (Turning Point, Collective or Team Plan). `dual-trend-returns-job` fills them once a day in order members → signals (marks the day full in `dual_trend_signal_days`) → 5-day state backfill → returns from `/v1/prices` (split_adjusted, throttled to 40/min), values stored as the API returns them; pages show the newest full day, breadth's 5-day change uses the saved day 5 trading days earlier, and a start date with no saved return shows a dash — so sections stay consistent and cheap on the API's shared rate limit.
