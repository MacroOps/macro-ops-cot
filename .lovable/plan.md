## Problem

The Research Copilot only knows about a hardcoded list of 16 mock "indicators" (Trend Fragility, Risk-On, etc.). It has no tools that touch the real `cot_reports` / `positioning_snapshots` tables, so questions like "what's commercial positioning in GBP" are genuinely outside its toolset. It also has no awareness of the page/route you opened it from — `context` is only set when you click the spark icon on a specific `IndicatorCard`. Opening it from `/asset/6B` gives it zero context about GBP.

## Fix — two parts

### 1. Give the Copilot real CoT tools (edge function)

Extend `supabase/functions/copilot-agent/index.ts` with new tools that hit the database via the service-role client:

- **`list_markets({ query?, sector? })`** — fuzzy search `markets` by symbol/name/sector. Returns `[{ id, symbol, name, sector }]`. Lets the model resolve "british pound" → `6B`.
- **`query_cot({ symbol, lookback_weeks? })`** — looks up market by symbol, then:
  - Pulls latest row from `get_cot_normalized(market_id, lookback)` → COT Index, Z, percentile, tier, regime tag, weeks-in-extreme, signal (BULLISH/BEARISH/NEUTRAL).
  - Pulls latest `cot_reports` row + `positioning_snapshots` to return raw net contracts for **all categories present** (commercial, non-commercial, non-reportable, managed money, leveraged funds, asset managers, dealers) across legacy / disaggregated / TFF (incl. combined) formats.
  - Returns `report_date`, `open_interest`, week-over-week deltas, and a `href: /asset/<symbol>`.
- **`cot_history({ symbol, category, weeks? })`** — small time series (default 26w) of net contracts for one category, for sparkline-style answers.
- **`scan_cot_extremes({ side?, min_index?, sector? })`** — wraps `get_cot_normalized` across all markets, returns top extremes (index ≥90 or ≤10), grouped by side. This is the "what's stretched in positioning right now" question.

Implementation notes:
- Use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` inside the function (read-only queries; service role already used elsewhere).
- Symbol lookup is case-insensitive and also matches `name ILIKE %query%` so "british pound", "pound", "GBP", or "6B" all resolve.
- Keep results compact (cap rows, round numbers) so the model's context stays small.
- Update the `SYSTEM` prompt: add a CoT playbook section ("positioning / commercial / net specs / extremes" → these tools), and explicitly tell it: *"If the user references a market by common name (gold, pound, crude, ES, etc.), call `list_markets` first to resolve the symbol — never refuse."*

### 2. Auto-sync Copilot to the current page/asset (frontend)

- In `CopilotContext.tsx`, read `useLocation()` and `useParams()`-equivalent (parse pathname) to build an automatic **`pageContext`** every render:
  - `{ route, label, symbol?, marketName? }`
  - `/asset/6B` → `{ route: "/asset/6B", symbol: "6B", label: "Asset · British Pound (6B)" }` (resolve name from a small client-side market lookup, or just pass symbol and let the agent resolve).
  - `/offsides`, `/breadth/overview`, `/risk-cycle`, etc. → human label only.
- The provider sends BOTH `pageContext` (always) and the explicit `chartContext` (only when a chart's spark icon was clicked) to the edge function.
- Edge function injects them into the system prompt as `CURRENT PAGE` and `ACTIVE CHART` blocks, and instructs the model: *"When the user says 'this', 'here', 'the chart I'm looking at', default to ACTIVE CHART; otherwise default to CURRENT PAGE's symbol if present."*
- `CopilotDrawer` header: when no chart context, show a small chip like `Page · Asset · British Pound (6B)` so the user can see what the Copilot thinks they're looking at.

### Files touched

- `supabase/functions/copilot-agent/index.ts` — add 4 tools, Supabase client, updated system prompt.
- `src/components/copilot/CopilotContext.tsx` — derive + expose `pageContext`.
- `src/components/copilot/CopilotDrawer.tsx` — send `pageContext`, render page chip, update tool-result summarizer for the new CoT tools.
- (Small) `src/lib/marketLabels.ts` — symbol → friendly name map for the page chip (e.g. `6B → British Pound`), to avoid a DB roundtrip on every page nav.

### Out of scope (can do next)

- Price/return tools (the existing `run_backtest` is mock — could be rewritten against `price_history` later).
- TPMR live tools (currently the agent only has the mock TPMR indicators).
- Streaming responses.

### Verification

After build:
1. Navigate to `/asset/6B`, open Copilot, ask "what's commercial positioning saying?" → should call `query_cot({symbol:"6B"})` and return real commercial/managed-money nets with COT Index.
2. Ask "what's most stretched in metals?" without opening from a page → `scan_cot_extremes({sector:"Metals"})`.
3. Open Copilot from `/offsides` — header chip shows `Page · Offsides`.