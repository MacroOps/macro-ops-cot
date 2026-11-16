# Daily job saves Dual Trend signals and members

## Goal
Dual Trend tables and sector breadth open from saved data only. The daily job fetches signals and membership once, saves them, then computes returns from those saved start dates.

## What changes for users
- Pages open fast, with no waiting on the shared API limit.
- Header shows "signals as of <date>" (and returns as-of, as today).
- If today's data isn't saved yet, the page shows the last saved day with its date. Never blanks, never mixed days.
- A new signal whose start date has no saved return still shows a dash (unchanged rule).

## Daily job order (one run per as-of date)
1. **Members phase**: save membership for the as-of date.
   - `/v1/members?parent=SPX|MID|SML` (one call each, no paging).
   - The 33 sector groups (11 per index, from `sectorGroups()`), so breadth needs no API.
   - The 8 custom lists via `/v1/custom-list-signals` (membership + category).
2. **Signals phase**: the 10 keys (value1, value2, state, days, start for lt and st) via paged `/v1/signal` (offset += limit until a short page). Custom-list symbols not covered by the paged reads take their values from the custom-list payload. Saved per symbol + as-of date.
3. **Returns phase**: unchanged math, but the work list is built from the saved signals (start dates) and saved members, not refetched.
4. Run is marked done only after all three phases. Each phase is resumable from where it stopped (the 12:00 UTC check still resumes).

Request budget: about 10 keys x ~3 pages + 3 + 33 + 8 = ~75 extra calls, under 2 minutes at the current 40/min throttle. Returns still take ~1 hour.

## Fallback rule
- Pages read the newest as-of date whose members and signals phases are both complete (a "signals ready" mark on the run row). A half-saved day is never shown.
- Returns keep their own fallback (previous day, then dash for new start dates).
- Sector breadth "change vs prior day" uses the previous saved as-of date.

## Storage
- `dual_trend_members`: universe (SPX, MID, SML, sector group code, or list id), symbol, category, as_of. One row per member.
- `dual_trend_signals`: symbol, as_of, the 10 values (stored as the API returns them; no rescaling).
- Run table gains `signals_ready_at` and a phase field.
- Both new tables: public read (same as returns; this is market data already shown to members), writes by the job only. Keep ~15 days, same as returns.

## Frontend
- `useDualTrendUniverse`: reads members + signals for the chosen as-of from the database; row builders (`buildMemberRows`, `buildListRows`) unchanged, so row count still equals member count.
- `useSectorOverview`: reads sector-group members + states for as-of and prior saved day from the database.
- Remove the page-load `/v1/signal`, `/v1/members`, `/v1/custom-list-signals` calls from Dual Trend and breadth. Other pages (TPMR Overview, Signals Lab) are untouched.
- Large Cap Cyclical stays mock.

## Tests
- Job phase order: signals saved before returns; returns work list comes from saved start dates.
- Fallback: when today has no "signals ready" mark, the previous saved day is used with its date.
- Half-saved day is never read.
- Row count equals member count from saved members.
- Values saved and read as-is (no x10).
- Breadth change uses previous saved as-of.

## Verification
- Run the job once by hand; confirm counts (S&P 500 503, 400 401, 600 604, ETFs 260, miners 60, thematic 344) match the live pages today.
- Browser check: zero Macro Ops calls on Dual Trend page load; header shows the saved date.
- `npm run design:check` OK; AGENTS.md Dual Trend rule updated to say signals and members come from the database.

## Technical notes
- One migration: two tables + run columns, GRANTs, RLS, read policies, indexes on as_of.
- First day after deploy: until the first run saves signals, pages would have nothing to show. I'll run the job by hand right after deploy so a saved day exists before switching the page reader.
