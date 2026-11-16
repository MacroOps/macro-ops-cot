DROP POLICY IF EXISTS "Public can read dual trend members" ON public.dual_trend_members;
DROP POLICY IF EXISTS "Public can read dual trend signals" ON public.dual_trend_signals;
DROP POLICY IF EXISTS "Public can read dual trend returns" ON public.dual_trend_returns;
DROP POLICY IF EXISTS "Public can read dual trend signal days" ON public.dual_trend_signal_days;
REVOKE ALL ON public.dual_trend_members, public.dual_trend_signals, public.dual_trend_returns, public.dual_trend_signal_days FROM anon, authenticated;
GRANT ALL ON public.dual_trend_members, public.dual_trend_signals, public.dual_trend_returns, public.dual_trend_signal_days TO service_role;