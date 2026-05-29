-- 1. Add 'eurex' to report_format enum
ALTER TYPE report_format ADD VALUE IF NOT EXISTS 'eurex';

-- 2. Create eurex_oi_history table
CREATE TABLE public.eurex_oi_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  observed_on date NOT NULL,
  open_interest bigint,
  volume bigint,
  oi_change bigint,
  block_volume bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, observed_on)
);

CREATE INDEX idx_eurex_oi_market_date ON public.eurex_oi_history(market_id, observed_on DESC);

GRANT SELECT ON public.eurex_oi_history TO anon;
GRANT SELECT ON public.eurex_oi_history TO authenticated;
GRANT ALL ON public.eurex_oi_history TO service_role;

ALTER TABLE public.eurex_oi_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read eurex_oi_history"
  ON public.eurex_oi_history
  FOR SELECT
  USING (true);

-- 3. Seed Eurex markets
INSERT INTO public.markets (symbol, name, sector, exchange, yahoo_symbol, is_active) VALUES
  ('FESX',  'Euro Stoxx 50 Future',      'Equities', 'Eurex', '^STOXX50E', true),
  ('FDAX',  'DAX Future',                'Equities', 'Eurex', '^GDAXI',    true),
  ('FDXM',  'Mini-DAX Future',           'Equities', 'Eurex', '^GDAXI',    true),
  ('FSMI',  'SMI Future',                'Equities', 'Eurex', '^SSMI',     true),
  ('FSTX',  'Stoxx Europe 600 Future',   'Equities', 'Eurex', '^STOXX',    true),
  ('FESB',  'Euro Stoxx Banks Future',   'Equities', 'Eurex', '^SX7E',     true),
  ('FXXP',  'Stoxx Europe 600 Sector',   'Equities', 'Eurex', '^STOXX',    true),
  ('FGBL',  'Euro-Bund Future',          'Rates',    'Eurex', 'GG=F',      true),
  ('FGBM',  'Euro-Bobl Future',          'Rates',    'Eurex', NULL,        true),
  ('FGBS',  'Euro-Schatz Future',        'Rates',    'Eurex', NULL,        true),
  ('FGBX',  'Euro-Buxl Future',          'Rates',    'Eurex', NULL,        true),
  ('FOAT',  'French OAT Future',         'Rates',    'Eurex', NULL,        true),
  ('FBTP',  'Italian BTP Future',        'Rates',    'Eurex', NULL,        true),
  ('FBTS',  'Short-Term BTP Future',     'Rates',    'Eurex', NULL,        true),
  ('CONF',  'Swiss Confederation Bond',  'Rates',    'Eurex', NULL,        true)
ON CONFLICT (symbol) DO NOTHING;