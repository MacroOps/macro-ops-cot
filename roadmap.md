
## Shared Dual Trend table (Nov 16)
- [x] Audit index signal coverage and custom-list counts for the uploaded brief
- [x] Add verified Trend System keys and Sector Analysis group (preserve native API levels)
- [x] Redeploy daily Dual Trend job and reset/rerun latest completed date; membership/signals refreshed, returns continuing
- [x] Run tests, design check, and verify saved categories
- [ ] Verify signed-in Market Overview visually — blocked by unavailable Outseta member session
- [x] Shared loader + table for S&P 500/400/600, ETFs, Gold & Silver Miners, Thematic (Large Cap Cyclical unchanged)
- [x] Section labels in one config
- [x] LT/ST return + net columns on every row, batched + cached (symbol + start + as-of)
- [x] Sector breadth on S&P 500/400/600 with index total row
- [x] Remove x10 trend scaling (incl. TPMR Overview); paginate every /v1/signal list call

## Major dependency upgrades — ON HOLD (Nov 25)
- [x] Step 1: remove zod + @hookform/resolvers (zod advisory cleared; 22 advisories open)
- [ ] Step 2: Vite 8 + Vitest 5 — reverted; blocked on production build failing on the canonical link in index.html (config-only plugin tested and works)
- [ ] Step 3: react-router-dom 6 → 7 (target >= 7.18.0)
- [ ] Step 4: echarts 5 → 6 (target >= 6.1.0)
