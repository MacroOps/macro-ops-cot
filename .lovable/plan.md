# Step 2: Vite 8 + Vitest 5, finish with a config-only build fix

## Already in place
- vite 8.3.8, vitest 5.1.1, @vitejs/plugin-react-swc 4.3.3, lovable-tagger 1.3.5, and both lockfiles updated.
- 47 of 47 tests pass. design:check OK.
- npm audit: 22 open advisories down to 18. Cleared: vitest (critical), tinypool (critical), vite (high), @vitest/mocker (moderate). No high or critical advisories remain.

## Build failure
Vite 8's HTML step reads `<link rel="canonical" href="/">` as a local file and fails with EISDIR. Vite has no setting to skip one link, so the fix is a small plugin in the config file.

## Fix (vite.config.ts only, index.html unchanged)
Add a small plugin pair to vite.config.ts:
- Before Vite processes the HTML, swap that exact canonical tag for a placeholder comment.
- After processing, put the original tag back.
- I tested this with a separate copy of the settings and no project files touched. The build succeeds, and the built page still contains `<link rel="canonical" href="/" />` unchanged.

## Alias test
- Add `src/test/alias.test.ts`. It imports a real module through the `@/` shortcut (`@/lib/exportNaming`) and checks a known output, so Vitest 5 still resolves the alias.

## Verify, then commit
- Run tests, design:check, a production build and npm audit.
- Make one commit, "Upgrade Vite to 8 and Vitest to 5", containing only package.json, both lockfiles, vite.config.ts and the alias test.
- Stop for your check.

## Other options if you'd rather not use the plugin
- Edit index.html to use the full address (this one-line change also works).
- Wait for an upstream Vite fix and stay on 5 for now.

## Preview checks for you
- The app loads and sign-in works (the Outseta script still loads).
- The Dual Trend Portfolio page (/tp/dean-portfolio) loads, because it depends on the dev-only portfolio middleware.
- TCTM Live and one chart JPG export render normally.
