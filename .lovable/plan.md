# Community Alpha — three layout fixes (styling only)

## What changes

1. **Search + Live/Staging into the heading row.** The search box moves into the `PageHeader` actions slot (the same row as the "Community Alpha" title, right side), placed next to the existing Live/Staging tabs. The separate toolbar row (`.app-header`) is removed entirely.
2. **Digest left-aligned.** The digest column is currently centered (`.main-inner { max-width: 940px; margin: 0 auto; }`), which leaves an empty gap between the week list and the content. It becomes left-aligned next to the week list (`margin: 0`), keeping the 940px max width so lines don't stretch on wide screens.
3. **"Hide technical calls" font.** The toggle currently uses the inherited body font; it switches to IBM Plex Mono to match the count pills beside it.

## Files touched

- `src/pages/CommunityAlpha.tsx` — move the search-side markup (hint, search input, clear button) into `PageHeader`'s `actions`, after the Live/Staging Tabs; delete the `.app-header` toolbar row. The search input keeps `id="search"` and the clear button keeps `id="search-clear"` with the same refs, so the dashboard port's `/`-focus, Escape, and Close hooks are untouched.
- `src/pages/community-alpha.css` — remove the `.app-header` block and its references in the 720px container query; retune `.search-wrap` width so search + tabs fit the heading row (narrower at the 720px/440px container breakpoints, hint stays hidden on phone); change `.main-inner` margin to `0`; change `.tech-toggle` font-family to IBM Plex Mono.

No other files. Shared components (PageHeader, Input, Button, Tabs) are only used, not modified. No changes to the dashboard port (`communityAlphaDashboard.ts`), the read function, data, auth, or Outseta files. No AGENTS.md change needed — the existing rule already covers styling.

## Verification

- Build check via build log.
- Playwright with the existing mock harness (stubbed Outseta + `community-alpha-read`):
  - Search box and Live/Staging tabs sit in the heading row; toolbar row gone.
  - Digest starts at the left edge next to the week list (no centering gap).
  - "Hide technical calls" computed font is IBM Plex Mono, matching the pills.
  - Behavior intact: `/` focuses search, search filters, Escape clears, technical toggle, week list, top tickers, Live/Staging switch and banner, Slack links.
  - Desktop and phone widths, light and dark themes; no horizontal overflow.
