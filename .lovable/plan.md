# Undo step 2 (Vite 8 + Vitest 5)

## What changes
Restore `package.json`, `package-lock.json` and `bun.lockb` to the version saved right before change 9caf041 (the state after step 1, which removed zod and @hookform/resolvers). Reinstall from that lockfile.

Result: vite 5.4.21, vitest 3.2.7, @vitejs/plugin-react-swc 3.x, lovable-tagger 1.1.x. Step 1 (no zod / @hookform/resolvers) stays in place. vite.config.ts, vitest.config.ts and index.html are untouched.

## Checks
- Installed versions match the above.
- 47 tests pass, design:check OK, production build succeeds.
- npm audit back to 22 open advisories (vitest and tinypool critical, vite high), the same as after step 1.
- Commit as "Revert Vite 8 and Vitest 5 upgrade".
