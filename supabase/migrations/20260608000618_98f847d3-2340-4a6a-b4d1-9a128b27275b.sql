DROP POLICY IF EXISTS "Public can read ingestion_log" ON public.ingestion_log;
CREATE POLICY "Authenticated can read ingestion_log" ON public.ingestion_log FOR SELECT TO authenticated USING (true);
REVOKE EXECUTE ON FUNCTION public.get_dashboard_payload() FROM anon, PUBLIC;