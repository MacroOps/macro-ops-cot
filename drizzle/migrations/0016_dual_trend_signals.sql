CREATE TABLE public.dual_trend_members (
  as_of date NOT NULL,
  universe text NOT NULL,
  symbol text NOT NULL,
  name text,
  sub_group text,
  PRIMARY KEY (as_of, universe, symbol)
);
CREATE TABLE public.dual_trend_signals (
  as_of date NOT NULL,
  symbol text NOT NULL,
  vals jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (as_of, symbol)
);
CREATE TABLE public.dual_trend_signal_days (
  as_of date PRIMARY KEY,
  kind text NOT NULL DEFAULT 'full',
  ready_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dual_trend_members, public.dual_trend_signals, public.dual_trend_signal_days TO anon, authenticated;
GRANT ALL ON public.dual_trend_members, public.dual_trend_signals, public.dual_trend_signal_days TO service_role;
ALTER TABLE public.dual_trend_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_trend_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_trend_signal_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read dual trend members" ON public.dual_trend_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read dual trend signals" ON public.dual_trend_signals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read dual trend signal days" ON public.dual_trend_signal_days FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.dual_trend_return_runs ADD COLUMN phase text NOT NULL DEFAULT 'returns';
ALTER TABLE public.dual_trend_return_runs ADD COLUMN signals_ready_at timestamptz;