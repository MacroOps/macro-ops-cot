GRANT SELECT ON public.dashboard_payload_mv TO anon;
GRANT SELECT ON public.dashboard_payload_mv TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT payload FROM public.dashboard_payload_mv WHERE id = 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO authenticated;