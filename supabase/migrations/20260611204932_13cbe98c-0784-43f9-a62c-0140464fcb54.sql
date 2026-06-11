REVOKE SELECT ON public.dashboard_payload_mv FROM anon;
REVOKE SELECT ON public.dashboard_payload_mv FROM authenticated;

CREATE OR REPLACE VIEW public.dashboard_payload_api AS
SELECT payload FROM public.dashboard_payload_mv WHERE id = 1;

GRANT SELECT ON public.dashboard_payload_api TO anon;
GRANT SELECT ON public.dashboard_payload_api TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT payload FROM public.dashboard_payload_api;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO authenticated;