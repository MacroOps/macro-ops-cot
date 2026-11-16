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
- **Serif:** only for page titles (PageHeader), the paywall heading, and the sidebar wordmark (serif italic). Community Alpha day and week titles use grotesk, not serif.
- **Signal colors:** BULLISH is green (success). Bearish is red. Triggered takes the color of its TCTM composite: Risk-Off is red, the others are green. Neutral is gray.
- **Positioning reads are intentional and labeled in text:** directional (Sectors, Index) shows high as green. Contrarian (Offsides, Asset Detail) shows an extreme long as red. Do not mix the two on one screen without a text label.
- **Radius:** 2px everywhere. Round only avatars and counters. The copilot launcher stays round with a shadow.
- **Loading:** pages use HudLoader (tan line). Tables use Skeleton gray blocks. Chart areas may keep their own placeholders.
- **Heatmap meaning** (what high means per indicator) is pending real data. It is not final.
- Dual Trend sections share one loader (`src/hooks/useDualTrendUniverse.ts`) and one table (`DualTrendTable`); each section's label and universe live only in `src/lib/dualTrend/config.ts`. Values come from the API as-is (trend_rel value1/value2 are 0–100, days/start from `_days`/`_start`), every `/v1/signal` list read pages via `signalAll`, and returns are batched through `symbol-returns` and cached by symbol + start + as-of date — so sections stay consistent and cheap on the API's rate limit.
