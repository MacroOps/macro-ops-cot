DROP POLICY IF EXISTS "Anyone can read daily briefings" ON public.daily_briefings;
REVOKE ALL ON public.daily_briefings FROM anon, authenticated;
GRANT ALL ON public.daily_briefings TO service_role;