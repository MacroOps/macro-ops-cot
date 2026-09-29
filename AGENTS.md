# Outseta (Foundation Alpha)

This app (Terminus / Foundation Research) uses Outseta for authentication, CRM, billing, and support.

- **Outseta subdomain:** `foundation-alpha-llc.outseta.com`
- **Skill:** `.agents/skills/outseta/SKILL.md` — read this before writing Outseta integration code.
- **MCP:** Cursor connects to `https://mcp.outseta.com` (OAuth). Confirm destructive or bulk CRM/billing changes with the user first.

## Rules

- Outseta is the source of truth for who the customer is and whether they paid.
- Gate product features with Outseta JWT claims or the REST API (`outseta:planUid`, subscription status).
- Keep Supabase for market data; do not use it as the billing or CRM system.
- Use `@outseta/react` on the frontend and `@outseta/node-sdk` on the server when implementing auth or billing in this repo.

## Community Alpha

- Weekly window logic lives in `supabase/functions/_shared/community-alpha/window.ts` (Luxon, America/Los_Angeles, Slack ts compared as integer microseconds) — one source of truth for DST-safe Friday 2 PM PT windows.
- Members page `/community-alpha` reads only via `community-alpha-read` (Outseta JWT verified in-function, live/staging weeks tables only, no author_id); its dashboard logic is a verbatim port of Mike's reference HTML in `src/pages/communityAlphaDashboard.ts` — keep it matching the reference rather than refactoring.
