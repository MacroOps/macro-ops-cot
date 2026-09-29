# Step 8 — Community Alpha members page (/community-alpha)

## What members will see
- A new page at /community-alpha that matches the reference dashboard's layout and behavior: header with logo | "Community Alpha" and the search box ("/" to focus, Esc to clear), a "Weekly digests" date list (it becomes a horizontal strip on phones), and for the selected week: the summary pills, the "hide technical" toggle, the top-tickers row with the week/month lookback, and ideas grouped by channel with their tags, highlighted search matches, and Slack links. Search runs across all weeks, grouped by week, with the week/month scope banner. The phone and small-phone layouts match the reference too.
- Branding: the reference's Macro Ops logo, Open Sans font, and beige palette are swapped for Terminus's existing "FR / Foundation Research" mark from the side menu, Terminus's fonts (Hanken Grotesk and IBM Plex Mono), and Terminus's color tokens, so it also works in dark mode.
- A Live / Staging switch in the header. Any logged-in member can use it for now. When it's on Staging, a banner reading "STAGING — test data" shows across the top, and the page loads staging weeks.
- Signed-out visitors see a "Sign in to view Community Alpha" prompt that uses the existing Outseta login. No paywall.
- A "Community Alpha" link in the side menu.

## Data
- New function `community-alpha-read` (it doesn't exist yet). It checks the member's Outseta token with the existing verifier (read-only import), then returns `{ generated_at, days: [...] }` in the exact shape the reference's empty data block expects. It reads `community_alpha_weeks` (live) or `community_alpha_weeks_staging` when `mode: "staging"` is sent. Only those two tables are read, never runs, tasks, state, or private settings.
- Only the idea fields the page shows are sent. Member names and Slack links show up because the reference page shows them. Nothing internal is sent (warnings, token counts, source flags).
- Returns 401 without a valid token and 400 for any mode other than live or staging.

## Auth / Outseta
No changes needed. The page uses the existing sign-in hook and token helper as they are, and the new function imports the existing verifier without changing it. If building turns up a needed change there, I'll stop and tell you.

## Existing files touched (only these)
1. `src/App.tsx` — add the import and the `/community-alpha` route.
2. `src/components/hud/AppSidebar.tsx` — add one menu entry (nav list only; the login and logout code stays as it is).
3. `AGENTS.md` — one rule for the read function and page.

Read only, not changed: `src/lib/outseta/edge.ts`, `supabase/functions/_shared/outseta-jwt.ts`, the Outseta provider/hook, `PaywallGate.tsx`.

## New files
- `supabase/functions/community-alpha-read/index.ts`
- `supabase/functions/community-alpha-read/shape_test.ts` (tests the row-to-`days` mapping and mode validation)
- `src/pages/CommunityAlpha.tsx` (the page: the reference's logic as React state and render)
- `src/pages/community-alpha.css` (the reference's styles, scoped under `.ca-page`, with colors mapped to Terminus tokens)

## Technical notes
- The new function sets `verify_jwt = false` in its own `supabase/config.toml` block (the same pattern as the other Outseta-gated functions) and checks the token inside the function. That adds a block for this function only; no project settings change.
- The reference's DOM-string rendering is ported to React components, keeping the same class names, same sort order (newest first), same lookback math (1 or 4 weeks), same search matching (ticker, member, channel, text), and the same keyboard shortcuts.
- Logged-in check: I'll test the page signed in, in both live and staging, and confirm the banner and the Sep 18/25/Oct 2 weeks show.
