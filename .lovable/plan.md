# Daily Dual Trend returns job

## What changes for members
- Dual Trend tables read returns from the database only. No price calls happen when a page loads.
- Returns appear right away on every visit, including the first visit of the day.
- If today's job failed or hasn't run yet, the table shows the last saved returns and labels them, e.g. "Returns as of Nov 12", instead of showing blanks.

## The job
1. **Schedule:** once a day at 10:00 UTC (5 AM New York), after the API's overnight update and before the market opens. A second daily check at 12:00 UTC (7 AM New York) only runs if the first one didn't finish. That covers a late API update without checking all day.
2. **Is there new data?** Read the API's latest signal date. If returns for that date are already saved, stop. This uses one request.
3. **Build the work list:** the members of S&P 500, 400 and 600, plus the six ETF lists, Gold & Silver Miners and Thematic Stocks. Each symbol appears once, about 2,000 in total. For each symbol, the LT and ST signal start dates come from the same signal reads the tables use.
4. **Prices:** for each symbol, one `/v1/prices` call (split_adjusted) from its earliest start date to the as-of date. A range longer than 1,000 rows follows the next page. The S&P 500 index (raw prices, since an index has no splits) is fetched once per run.
5. **Math (same as the approved plan):** Return = close on the as-of date / close on the start date − 1. Net = Return − S&P 500 return over the same dates. A date with no trading row uses the last close on or before it. If there's no price at all, the result is saved as blank.
6. **Throttle:** at most 40 requests a minute (well under the 100 the app shares). About 2,000 symbols works out to roughly 50 minutes per day. The work runs in small chunks of about 60 symbols. Each chunk saves its progress and starts the next one, so a crash resumes where it left off instead of starting over.
7. **Finish:** mark the day complete. Delete saved returns older than 10 trading days.

## What the table reads
- For each row, the saved return and net for that symbol, start date and the newest as-of date that has data.
- If a symbol's signal changed and its new start date has no saved return yet, the cell shows a dash. A return from a previous start date is never shown.
- "Returns as of" sits in the table header next to the signal date.

## Tests
- Return and net math with fixed closes, including the fallback to the prior close and a missing series (blank).
- Throttle never goes over 40 requests in any 60-second window.
- Reading returns: today's row is used when it exists. Otherwise the previous day's row for the same start date is used, and its as-of date is shown. A start date with no saved row shows a dash, never a return from another start date.
- The work list includes each symbol from the six universes once.

## Technical details
- New table `dual_trend_returns` (symbol, start_date, as_of, ret, net, computed_at; primary key symbol + start_date + as_of). Grants, then RLS. Read-only public SELECT, same as the other market data tables (the app signs in through Outseta, so RLS can't check the plan). Writes are backend-only.
- New table `dual_trend_return_runs` (as_of, status, cursor, symbols_total, symbols_done, error, started_at, finished_at). Backend-only, with no public access.
- New backend function `dual-trend-returns-job`: `tick` (checks for new data, creates the run), `chunk` (about 60 symbols at the 40-per-minute pace, then calls itself for the next chunk until done). It uses the existing API key secret directly, not the browser proxy.
- Two daily cron entries (10:00 and 12:00 UTC) using the managed scheduler credential, the same pattern as the Community Alpha job.
- Frontend: `src/lib/dualTrend/returns.ts` reads from the table (batched `in` queries by symbol) in place of `symbol-returns`, and keeps the in-memory cache keyed by symbol + start date + as-of date. `useDualTrendReturns` exposes the returns as-of date. `DualTrendTable` shows the label.
- The `symbol-returns` Yahoo function stays deployed but unused by Dual Trend (Large Cap Cyclical is still on mock data). It can be removed later.
- Update the Dual Trend rule in AGENTS.md: returns come from the daily job's table, never from page-load price calls.
- After building: run the job once by hand, report how long it took, how many requests and symbols it handled, and the S&P 500 first-load time. Also re-check the 5-symbol comparison against the saved values.
