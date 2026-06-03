
REVOKE SELECT ON public.dashboard_payload_mv FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT payload FROM public.dashboard_payload_mv WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_dashboard_payload() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_payload() TO service_role;

REFRESH MATERIALIZED VIEW public.dashboard_payload_mv;
