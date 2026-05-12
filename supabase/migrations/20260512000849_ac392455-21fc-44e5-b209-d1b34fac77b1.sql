INSERT INTO public.markets (symbol, name, sector, exchange, cftc_code, yahoo_symbol, is_active) VALUES
  ('GF', 'Feeder Cattle', 'Agriculture', 'CME', '061641', 'GF=F', true),
  ('OJ', 'Orange Juice', 'Agriculture', 'ICE', '040701', 'OJ=F', true),
  ('LBR', 'Lumber', 'Agriculture', 'CME', '058644', 'LBR=F', true),
  ('SR3', 'SOFR 3M', 'Rates', 'CME', '134742', 'SR3=F', true),
  ('MBT', 'Micro Bitcoin', 'Crypto', 'CME', '133742', 'MBT=F', true)
ON CONFLICT (symbol) DO NOTHING;