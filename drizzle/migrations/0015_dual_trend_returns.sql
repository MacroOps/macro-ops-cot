CREATE TABLE public.dual_trend_returns (
  symbol text NOT NULL,
  start_date date NOT NULL,
  as_of date NOT NULL,
  ret numeric,
  net numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, start_date, as_of)
);
CREATE INDEX dual_trend_returns_as_of_idx ON public.dual_trend_returns (as_of);
GRANT SELECT ON public.dual_trend_returns TO anon, authenticated;
GRANT ALL ON public.dual_trend_returns TO service_role;
ALTER TABLE public.dual_trend_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read dual trend returns" ON public.dual_trend_returns FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.dual_trend_return_runs (
  as_of date PRIMARY KEY,
  status text NOT NULL DEFAULT 'running',
  cursor integer NOT NULL DEFAULT 0,
  symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  symbols_total integer NOT NULL DEFAULT 0,
  symbols_done integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.dual_trend_return_runs TO service_role;
ALTER TABLE public.dual_trend_return_runs ENABLE ROW LEVEL SECURITY;