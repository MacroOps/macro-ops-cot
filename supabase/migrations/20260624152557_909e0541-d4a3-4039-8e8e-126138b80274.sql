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