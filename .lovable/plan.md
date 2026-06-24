## Problem

`ingest-cftc` is successfully writing new CFTC rows to the database (06-16 data is already there), but the final step — refreshing `dashboard_payload_cache` via `refresh_dashboard_payload()` — has been timing out on every run since 06-20:

```
dashboard refresh failed: canceling statement due to statement timeout
```

The cache row is stuck at `refreshed_at = 2026-06-20` with `reportDate = 2026-06-09`, so the UI never sees newer data even though ingestion "succeeds".

The default Postgres `statement_timeout` for the role calling the RPC is too short for `REFRESH MATERIALIZED VIEW dashboard_payload_mv` (which scans the full COT/price history).

## Fix

### 1. Raise the per-call statement timeout inside `refresh_dashboard_payload()`

Add a local `SET LOCAL statement_timeout` so the refresh has enough time regardless of who calls it. Function stays `SECURITY DEFINER`.

```sql
CREATE OR REPLACE FUNCTION public.refresh_dashboard_payload()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SET LOCAL statement_timeout = '300s';
  SET LOCAL lock_timeout = '10s';

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_payload_mv;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.dashboard_payload_mv;
  END;

  INSERT INTO public.dashboard_payload_cache (id, payload, refreshed_at)
  SELECT id, payload, refreshed_at FROM public.dashboard_payload_mv WHERE id = 1
  ON CONFLICT (id) DO UPDATE SET
    payload = EXCLUDED.payload,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$;
```

### 2. Manually run the refresh now so the UI unsticks immediately

After deploying the function change, call `refresh_dashboard_payload()` once (with the new timeout) to populate the cache with 06-16 data right away — no need to wait for the next ingest.

### 3. Make the manual refresh button invalidate the React Query cache

In `src/pages/Index.tsx`, after `ingest-cftc` returns, invalidate `["dashboard-data"]` via `queryClient.invalidateQueries(...)` so the UI re-fetches the freshly-updated cache instead of serving the 5-minute stale copy. (Small but necessary — otherwise users still wait up to 5 min after a successful refresh.)

### 4. Surface refresh failures honestly in the toast

If the ingest function's response indicates `status: "warn"` (cache-refresh failure), show a yellow warning toast like "Ingested N rows but dashboard cache refresh failed" instead of the green success toast. Today the user only sees "Refreshed — 1345 new rows" even when the cache step silently failed.

## Why not other approaches

- **Increase the role's global `statement_timeout`** — affects every query, too broad.
- **Refresh asynchronously via pg_net** — adds moving parts; the local `SET LOCAL` fix is one line and solves the root cause.
- **Drop `CONCURRENTLY`** — already falls back to non-concurrent in the EXCEPTION block; both paths are timing out, so the issue is duration, not lock contention.

## Files touched

- New migration: `ALTER`/`CREATE OR REPLACE FUNCTION public.refresh_dashboard_payload`
- One-off SQL: `SELECT public.refresh_dashboard_payload();`
- `src/pages/Index.tsx`: invalidate query + branch toast on `status`
