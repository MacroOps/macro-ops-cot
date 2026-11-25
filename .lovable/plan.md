# Major upgrade plan (no changes until approved)

Out of scope throughout: the `dual-trend-read` function and its `npm:zod@3` pin, all Outseta and backend settings, `src/integrations/supabase/*`. Each migration lands as its own commit so it can be rolled back alone. `npm run design:check` must end with OK after each one; no allowlist additions.

## Recommended order

1. Zod: remove unused zod + @hookform/resolvers
2. Vite 5 -> 8 + plugin-react-swc + Vitest 3 -> 5 (combined: Vitest 5 requires Vite 6+/7+, and both share the same config and plugin)
3. React Router 6 -> 7 (on its own, after the build tooling is stable)
4. ECharts 5 -> 6 (on its own, last; only affects TCTM Live)

Pinned minimums (advisory fixes): react-router-dom >= 7.18.0, echarts >= 6.1.0, vitest >= 5.1.1, Vite 8 release that npm audit reports clean.

Each step: bump in package.json, refresh both lockfiles (bun.lockb and package-lock.json), run all tests + design:check, then run `npm audit` and report which advisories cleared and which remain open, then check the preview.

---

## 1. Zod — remove zod and @hookform/resolvers (recommended)

Choice: remove both rather than bump. Nothing in `src/` imports either, `form.tsx` only uses react-hook-form, and the `dual-trend-read` function loads its own `npm:zod@3` at runtime independent of package.json. Removing them clears the zod advisory with zero code risk and drops unused weight; if a form ever needs validation, add zod >= 4.6.6 with resolvers v5 then.

Files: package.json, both lockfiles. No source changes, no new test.

Fallback if you prefer to keep it: bump zod to ^4.6.6 alone.

## 2. Vite 5 -> 8 + Vitest 3 -> 5 — medium/high risk (combined)

Files: package.json, lockfiles, `vite.config.ts`, `vitest.config.ts`, possibly `src/test/setup.ts`, `tsconfig.node.json`.
Packages: vite 8 (audit-clean release), vitest ^5.1.1, @vitejs/plugin-react-swc (latest major supporting Vite 8), jsdom (20 -> current), lovable-tagger (version that declares Vite 8 support), @testing-library/* if peer ranges require.

Steps:
1. Confirm lovable-tagger and plugin-react-swc publish Vite 8 peer support; if tagger does not, stop and report (preview editing depends on it).
2. Bump Vite + plugin; review Vite 6/7/8 breaking changes: Node 20.19+ required, Rolldown bundler in 8, `resolve.conditions` defaults, `server.allowedHosts`, Sass/CSS changes.
3. Re-verify the two custom pieces in `vite.config.ts`: the dev-only portfolio API middleware and the `@outseta/react` source alias (the alias stays as-is; only confirm it still resolves).
4. Bump Vitest + jsdom; update `vitest.config.ts` for removed options (e.g. workspace -> projects, pool defaults); keep `globals`, `setupFiles`, `include`.
5. Run full test suite, then production build.

Tests: existing 47 tests are the gate; add a small test that imports `vite.config.ts` and asserts the `@` and `@outseta/react` aliases resolve.

Manual preview check: app boots, sign-in flow renders, `/api/portfolio-snapshot` and `/api/tp-dt-portfolio` respond in dev, Dual Trend Portfolio page, Classic HUD iframe, chart JPG exports, and the published build loads.

Risks: Rolldown in Vite 8 may parse the `@outseta/react` barrel differently (the reason the alias exists); lovable-tagger compatibility; Node version in the sandbox; build output size changes. Fallback: stop at Vite 7 + Vitest 4 if 8/5 blocks; if so, check and report whether the tinypool critical advisory is still flagged.

## 3. React Router 6 -> 7 — medium risk

Files: package.json, lockfiles, `src/App.tsx` (BrowserRouter/Routes), ~21 files importing `react-router-dom` (NavLink, useNavigate, useSearchParams, Navigate).

Steps:
1. First on v6: enable future flags (`v7_startTransition`, `v7_relativeSplatPath`) on BrowserRouter, check the preview — this surfaces behaviour changes before the bump.
2. Bump to `react-router-dom` ^7.18.0 (v7 still exports the same API from this package; switching imports to `react-router` is optional and deferred).
3. Review relative links inside splat routes and any `useSearchParams` update loops.

Tests: add a routing test that renders the app routes in a MemoryRouter and asserts plan-gated routes redirect / render correctly using `src/lib/outseta/entitlements.ts` (mocked plan, no Outseta calls).

Manual preview check: sidebar navigation through every section, TPMR subpages, Dual Trend sections, deep links/refresh on nested routes, back/forward, paywall redirect, View as switching.

Risks: state updates now wrapped in startTransition may change loading flicker on HudLoader pages; relative splat link resolution.

## 4. ECharts 5 -> 6 — medium risk, narrow scope

Files: package.json, lockfiles, `src/lib/tctm/dashboard.js` (the only ECharts import; other charts use Recharts and are untouched).

Steps: bump echarts ^6.1.0; review v6 changes (new default theme, legend/axis defaults, label layout); explicitly set any styles that relied on v5 defaults so TCTM Live keeps chart-token ink and the paper surface.

Tests: extend `src/lib/tctm/dashboard.test.js` to assert chart options built for Dean's data are unchanged (series count, colors from tokens).

Manual preview check: `/tpmr/tctm-live` charts on screen in light and dark, TCTM JPG export (white export surface, 1200x900, heading strip).

Risks: v6 default theme changes colors/spacing — must not drift from design rules; Dean's static numbers must stay identical.

---

## Coverage gaps needing manual checks

Tests cover Dual Trend math, TCTM engine/status, export naming and Trend System mapping. Nothing covers routing, pages/components rendering, charts, the Vite dev middleware, or sign-in, so those rely on the preview checks listed above.

## Open uncertainties

- Exact audit-clean Vite 8 version, confirmed with npm audit at the time of the step.
- Whether lovable-tagger supports Vite 8 today (blocking for step 2).
- Sandbox Node version vs Vite 8 minimum.
- Signed-in preview checks may again be limited by the Outseta session in the sandbox; you may need to confirm member-only pages yourself.
