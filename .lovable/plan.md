# Hook the dashboard up to TP Market Research

Add a new data source alongside the existing CoT stack. Nothing CoT-related changes.

## 1. Secret + edge-function proxy

- Store the API key as a runtime secret `TPMR_API_KEY` (request via `add_secret`, no value in code).
- New edge function `tp-proxy` (`supabase/functions/tp-proxy/index.ts`):
  - Accepts `?table=<name>` plus a safe allow-list of query params from the OpenAPI spec (`start_date`, `end_date`, `sector`, `sector_code`, `symbol`, `index_symbol`, `index_code`, `timeframe`, `signal_state`, `composite_type`, `industry`, `sub_industry`, `category`, `exchange`, `limit`, `offset`).
  - Rejects any other table/param.
  - Calls `https://api.tpmarketresearch.com/{table}` with header `X-API-Key: <secret>`, forwards JSON response, returns proper CORS headers.
  - Light in-memory caching headers (`Cache-Control: private, max-age=300`) so React Query can dedupe.
  - JWT verification stays default (verify in code via the supabase client we already use; no `config.toml` change needed).

## 2. Frontend client

- `src/lib/tp/client.ts`: thin wrapper `tpFetch(table, params)` that calls `supabase.functions.invoke('tp-proxy', { body: { table, params } })` and returns typed rows.
- `src/lib/tp/types.ts`: TS types derived from `/schema` for the tables we use (breadth, risk composite, trend signals, sector trend timeseries, symbol metadata, custom indexes).
- `src/hooks/tp/`: one React Query hook per table we render (`useBreadth`, `useRiskComposite`, `useTrendSignals`, `useSectorTrend`, `useCustomIndexes`). Stale time 5 min.

## 3. New pages (added to sidebar under a new "TP Research" group)

Each page matches the existing HUD look (AppShell, hud-label, tabular nums, recharts, same color tokens). All include sector/date filters where the table supports them.

1. **TP Breadth** (`/tp/breadth`) — `calculated_breadth_full`
   - Sector picker, date range, line chart of advances/declines + new-highs/new-lows, current-day stat strip (overbought/oversold, %>MA50/200, slope_200d).
2. **TP Trend Signals** (`/tp/trend-signals`) — `trend_signals` (table-level signal state across symbols/timeframes), with filters for `timeframe` and `signal_state`. Institutional table view + small distribution sparkline.
3. **TP Risk Composite** (`/tp/risk-composite`) — `risk_composite_history`
   - Sector + composite_type (LT/ST) selector, line chart of `composite_score`, signal-state ribbon, current snapshot card per sector.
4. **TP Sector Trends** (`/tp/sector-trends`) — `sector_trend_timeseries`
   - Heatmap/table of all sectors' latest signal + WoW change, drill-down line per sector.

Reference tables (`custom_indexes`, `index_constituents`, `symbol_metadata`, `trend_relative_signals`, `symbol_trend_relative_signals`) are wired into the client/types now but not given a dedicated page yet — easy to add later once you see what you want.

## 4. Routing + sidebar

- Register the four routes in `src/App.tsx`.
- Add a "TP Research" section to `AppSidebar.tsx` with the four links.

## Technical notes

- All TP data is read-only and fetched on demand; nothing is mirrored into Supabase in this phase. We can add a scheduled ingest later if performance demands it.
- The proxy is the only place the API key lives. Frontend never sees it.
- React Query keys: `['tp', table, params]` — stable JSON-stringified params for cache hits.
- Errors from TP are bubbled up with status + body so the UI can show a real message.

## Out of scope (call out if you want any of these now)

- Touching existing CoT-driven pages (Index, Offsides, Heatmap, AssetDetail, etc.).
- Mirroring TP tables into Supabase / scheduled ingest.
- Cross-joining TP symbols with our `markets` table.
- A dedicated Symbol Detail page for TP symbols.
