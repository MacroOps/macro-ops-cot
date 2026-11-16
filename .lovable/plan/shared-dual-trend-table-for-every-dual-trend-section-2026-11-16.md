# Shared Dual Trend table for every Dual Trend section

## Goal
One table, one data loader. Each section only passes its universe.

| Section | Route | Universe source |
|---|---|---|
| S&P 500 | /tpmr/dual-trend/sp500 | /v1/members?parent=SPX |
| S&P 400 | /tpmr/dual-trend/sp400 | /v1/members?parent=MID |
| S&P 600 | /tpmr/dual-trend/sp600 | /v1/members?parent=SML |
| ETFs | /tpmr/dual-trend/etfs | 6 custom lists, shown as categories (Sector, Industry, Thematic, Global, Index/Style/Factor, Commodity/Crypto) |
| Gold & Silver Miners | /tpmr/dual-trend/gold-silver-miners | CUSTOM:STOCKS_GOLD_SILVER_MINERS |
| Thematic Stocks | /tpmr/dual-trend/thematic | CUSTOM:STOCKS_THEMATICS |
| Large Cap Cyclical | unchanged | stays as it is today |

## Rules applied
- Custom lists load from /v1/custom-list-signals (list_id, date). ETFs use their own signals; the sector-index proxy mapping (XLK -> S5INFT etc.) is removed.
- trend_rel_*_value1 / value2 are used as-is (already 0-100). The x10 scaling is removed in the S&P, ETF and TPMR Overview loaders.
- Signal days and start date come straight from trend_rel_*_days and trend_rel_*_start. The 3-year history walk used on row expand is removed for signal days/date.
- Every /v1/signal list call pages with offset += limit until a page returns fewer rows than the limit; meta.has_more is ignored. This also covers the sector breadth loader.
- SPX_UNIVERSE is used only to fill names and sub-industries, never to decide who is in the table.

## Steps
1. Verify first (read-only): call /v1/custom-list-signals for one list and /v1/members for SPX, MID, SML to confirm response field names, which signal keys custom lists return, and whether _start is epoch days or an ISO date. Adjust step 3 mapping to what the API returns.
2. Allow /v1/custom-list-signals (and /v1/custom-lists if needed for dates) in the app's API proxy allow-list, then redeploy the proxy.
3. Shared loader `useDualTrendUniverse(universe)`:
   - members: get symbols from /v1/members, then fetch 10 keys: trend_rel_lt_ and trend_rel_st_ value1, value2, state, days, start for the latest date with paged /v1/signal calls, filter to members.
   - custom lists: one /v1/custom-list-signals call per list; tag each row with its list as category.
   - Section labels (S&P 500, S&P 400, S&P 600, ETFs, ...) and each section's universe live in one config file, so renaming is a one-line change.
   - Returns: LT and ST return and net vs benchmark load for all rows in batched calls (many symbols per request) to the returns function, cached by symbol + start date + as-of date, so returns refresh every trading day and repeat visits the same day do not refetch.
   - Output one row shape: symbol, name, sub-industry/category, LT and ST (trend, relative, signal, days, start date).
4. Shared `DualTrendTable` component built from the current S&P 500 table (same look, search, sort, CSV, row expand). LT/ST return and net-vs-benchmark show as columns on every row. Category column/filter appears only when the universe has categories (ETFs).
5. Wire DualTrend page: sp500, sp400, sp600, etfs, gold-silver-miners, thematic use the shared table; large-cap-cyclical keeps its current content.
6. Sector breadth table shows on S&P 500, 400 and 600 using the SPX, MID and SML sector groups, with a total row for the whole index on top.
7. Remove x10 scaling in useTpmrSystems; add paging to useSectorOverview signal calls.
8. Retire SpxDualTrendTable, EtfDualTrendTable, useSpxDualTrend, useEtfDualTrend once nothing uses them. Row expand keeps its price-return-since-signal figure, using the API start date.
9. Update the AGENTS.md rule for Dual Trend data.

## Checks
- Unit tests: pagination stops on a short page and ignores has_more; values not rescaled; days/start passed through; SPX_UNIVERSE doesn't add or drop members.
- Browser: each of the six sections loads live rows; ETF categories show; Large Cap Cyclical unchanged; TPMR Overview levels are 0-100 and match the API.
- Returns columns filled on every row; a second visit makes no new returns requests.
- Breadth table on 400/600 shows sector rows plus index total.
- npm run design:check ends with OK.

