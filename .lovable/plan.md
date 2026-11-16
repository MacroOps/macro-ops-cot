# Dual Trend: fix S&P 600 count, move returns to the API

## Part 1 — S&P 600 row count (616 vs 604)

The row builder already drops exact duplicate symbols, so the extra 12 rows come from somewhere else. The cause isn't confirmed yet. The first step is to find it:

1. Page through `/v1/members?parent=SML` (and SPX, MID) with offset += limit until a page comes back short, the same way `/v1/signal` reads already work. Log the raw count, the unique count and any symbols that appear twice.
2. Check whether the extras are case or format variants (for example `BRK.B` vs `BRK-B`, lowercase, extra spaces), or members that came from the names list instead of the member list.
3. Fix: normalize each symbol (trim + uppercase) and dedupe on that across every page. Membership comes only from the API's member list. A test covers it: duplicates spread across two pages, plus a page that's exactly full, so nothing gets dropped.

Report the final counts for S&P 500, 400 and 600, plus what the extra 12 rows actually were.

## Part 2 — Returns from `/v1/prices` instead of Yahoo

**Math (unchanged meaning):**
- Return = close on the as-of date / close on the signal start date − 1 (basis=split_adjusted).
- Net = Return − benchmark return over the same two dates.
- If either date has no trading row, use the last close on or before that date. If there's no row at all, show a blank, not 0.

**Benchmark:** Before building anything, check whether `/v1/prices?entity=SPY` (and other benchmarks in use) returns split-adjusted closes. If it does, everything comes from the API. If it doesn't, only the benchmark keeps using Yahoo: one call per start date, cached.

**Speed (goal: S&P 500 in a few seconds on the first visit of the day):**
- `/v1/prices` takes one symbol per call, so the browser won't call it for each row. The existing `symbol-returns` backend function changes to take the same batch (up to 50 symbols, each with start dates). For each symbol it makes one `/v1/prices` call covering the earliest start date through the as-of date, then reads both closes from that one series. Requests are throttled within the API's rate limit, and 1000-row pages are followed when a range is long.
- Server-side cache per symbol + as-of date, so the S&P 500, 400 and 600 pages and other visitors reuse price series fetched the same day.
- Browser cache key stays exactly `symbol + start date + as-of date` (memory + localStorage, prune old as-of dates).
- Measure first-visit load time for S&P 500 and report it. If the rate limit still keeps it above a few seconds, report the number and the limit before tuning further.

## Tests
- Return/net math with fixed closes, including a missing start date (falls back to the prior close) and a missing series (blank).
- Cache key still includes the as-of date.
- Members paging + dedupe (Part 1).

## Technical details
- Files: `src/lib/dualTrend/build.ts` or the members loader in `src/hooks/useDualTrendUniverse.ts` (paging + normalized dedupe), `src/lib/dualTrend/returns.ts` (unchanged key, fetcher unchanged shape), `supabase/functions/symbol-returns/index.ts` (call `/v1/prices` through the same API key secret, Yahoo only for the benchmark if needed), `supabase/functions/macro-ops-proxy/index.ts` (add `/v1/prices` and paged `/v1/members` if browser needs them), `src/lib/dualTrend/dualTrend.test.ts`.
- Redeploy `symbol-returns` (and the proxy if changed). Nothing pushed. Update the Dual Trend rule in AGENTS.md: returns come from `/v1/prices` split_adjusted.
