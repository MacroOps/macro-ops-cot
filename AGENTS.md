# Outseta (Foundation Alpha)

This app (Terminus / Foundation Research) uses Outseta for authentication, CRM, billing, and support.

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
