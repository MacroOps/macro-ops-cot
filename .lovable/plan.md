## Plan

Add the newly accessible Google Doc models as dedicated HUD tabs while preserving the existing Macro Ops spec-driven architecture.

### 1. Add a new spec layer for TurningPoint models
- Create structured specs for:
  - Market Overview
  - Dual Trend System
  - TCTM Live Guides
- Capture each model’s tables, fields, badge rules, trigger logic, and required data inputs in a reusable data file.
- Keep the existing `indicatorSpecs.ts` models intact; add the new models alongside them rather than replacing current Macro Ops pages.

### 2. Add new left-sidebar tabs and routes
- Add a new top-level sidebar group, likely named `TurningPoint` or `TPMR Models`, with tabs:
  - Market Overview
  - Dual Trend: S&P 500
  - Dual Trend: S&P 400
  - Dual Trend: S&P 600
  - Dual Trend: ETFs
  - Dual Trend: Gold & Silver Miners
  - Dual Trend: Large Cap Cyclical
  - Dual Trend: Thematic Stocks
  - TCTM Risk-Off Guide
  - TCTM Capitulation Guide
  - TCTM Bottom Guide
  - TCTM Thrust Guide
  - TCTM Confirmation Guide
- Wire these to new routes in `App.tsx`.

### 3. Build shared HUD components for these views
- Build compact, dashboard-native components for:
  - House View table
  - TCTM 5-component status row
  - Systems overview by index
  - Sector analysis table
  - Historical performance tables
  - TCTM threshold conditions table
  - Dual Trend universe summary table
  - Searchable/sortable Dual Trend screener table
  - Expandable stock detail row with ST/LT signal panels
  - TCTM guide component-definition table
- Use the existing HUD visual language, semantic tokens, panels, badges, and density.

### 4. Implement the new pages with deterministic mock data
- Use mock data shaped exactly like the audit fields until real data ingestion is available.
- Ensure all fields from the document are represented: signal, signal date, count, level, days, returns, net returns, T-Level, R-Level, 5-day change, and model performance stats.
- Make the Gold & Silver Miners page include the example figures from the audit.

### 5. Preserve future real-data readiness
- Add clear specs/input lists so these pages can later be wired to ingestion without changing the UI contract.
- Keep calculations and mock generation centralized, not hardcoded throughout individual components.