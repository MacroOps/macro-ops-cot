# Step 2: Vite 8 + Vitest 5 — finish the upgrade

## Done so far
- vite 8.3.8, vitest 5.1.1, @vitejs/plugin-react-swc 4.3.3, lovable-tagger 1.3.5 installed; both lockfiles updated.
- 47/47 tests pass, design:check OK.
- npm audit: 22 -> 18 open. Cleared: vitest (critical), tinypool (critical), vite (high), @vitest/mocker (moderate). No high or critical left.

## Remaining fix (one line)
The production build fails under Vite 8: it tries to read `<link rel="canonical" href="/">` in index.html as a file ("EISDIR").
- Change it to the full address `https://app.foundationmacro.com/`. With that change the build succeeds (checked: built in 3.3s).
- Nothing else changes.

## Then
- Re-run tests, design:check, production build, npm audit.
- Commit as "Upgrade Vite to 8 and Vitest to 5".
- Pause for your check.

## Preview checks for you
- App loads and sign-in works (Outseta script still loads).
- Dual Trend Portfolio page (/tp/dean-portfolio) loads: it uses the dev-only portfolio middleware.
- A chart JPG export and TCTM Live render normally.
