CREATE TABLE IF NOT EXISTS public.dashboard_payload_cache (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL,
  refreshed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_payload_cache TO anon;
GRANT SELECT ON public.dashboard_payload_cache TO authenticated;
GRANT ALL ON public.dashboard_payload_cache TO service_role;

ALTER TABLE public.dashboard_payload_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dashboard payload is publicly readable" ON public.dashboard_payload_cache;
CREATE POLICY "Dashboard payload is publicly readable"
ON public.dashboard_payload_cache
FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.dashboard_payload_cache (id, payload, refreshed_at)
SELECT id, payload, refreshed_at FROM public.dashboard_payload_mv WHERE id = 1
ON CONFLICT (id) DO UPDATE SET
  payload = EXCLUDED.payload,
  refreshed_at = EXCLUDED.refreshed_at;

CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT payload FROM public.dashboard_payload_cache WHERE id = 1;
$function$;

DROP VIEW IF EXISTS public.dashboard_payload_api;
REVOKE SELECT ON public.dashboard_payload_mv FROM anon;
REVOKE SELECT ON public.dashboard_payload_mv FROM authenticated;
REVOKE SELECT ON public.dashboard_payload_mv FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_payload()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_dashboard_payload() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_payload() TO service_role;