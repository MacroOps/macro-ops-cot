# Community Alpha as a Terminus workspace

## What changes for members
- /community-alpha opens inside the normal Terminus frame, like the other sections: the side menu, the top bar titled "Community Alpha", the light/dark switch, and the alerts inbox.
- Access follows the frame's existing rule: members with an active Collective plan. Signed-out visitors and members without a plan see the same log-in or subscription screen as on other sections. The page's own "Sign in" prompt is removed because the frame already handles this.
- The digest fills the main area and keeps all its behavior: week list, search ("/" and Esc), summary pills, top tickers with the week/month choice, the technical toggle, and the Live/Staging switch with the "STAGING — test data" banner. The banner sits at the top of the digest area, not across the whole window.
- The digest's own logo block (FR / Foundation Research, the "|" divider and the big title) and its link back to Terminus are removed. The digest header keeps only the Live/Staging switch and the search box.
- On phones, Terminus's menu button in the top bar opens the side menu as usual. Inside, the digest keeps its phone layout: the week list becomes a row across the top, and the search goes full width.

## Existing files touched (only these)
1. `src/pages/CommunityAlpha.tsx` — wrap in the Terminus frame, drop the logo block and the sign-in prompt, and move the banner.
2. `src/pages/community-alpha.css` — size to the main area instead of the full window, remove the brand styles, and switch the phone rules to respond to the digest area's own width instead of the window's.
3. `AGENTS.md` — update the Community Alpha rule so it says the page uses the Collective-plan frame, replacing the current line instead of adding a second rule.

Not changed: `src/pages/communityAlphaDashboard.ts` (the ported behavior), the data reader function, the frame itself (`AppShell.tsx`), `PaywallGate.tsx`, the side menu, and all Outseta and sign-in files.

## Technical notes
- Use `<AppShell title="Community Alpha" hideScrubber hideRibbon fillViewport>` so the digest gets a fixed-height main area. The digest's `.layout` scrolls its week list and main column separately inside it, the same as the reference.
- `.ca-page` goes from `height: 100vh` to `height: 100%` (flex column, `min-height: 0`).
- The reference's phone breakpoints (720px / 380px) become container queries on `.ca-page` (`container-type: inline-size`), so the stacked layout also triggers when the side menu leaves the digest area narrow on a tablet. On phones, `fillViewport` is overridden so the page scrolls as one column, like the reference's phone view.
- The data reader still verifies the Outseta token itself; the frame's plan check only controls what is shown on screen.
- Verification: Playwright on desktop and at a 390px width with a stand-in plan holder. Check the menu button, the week strip, search, the staging banner, and a signed-out visitor seeing the frame's log-in screen.
