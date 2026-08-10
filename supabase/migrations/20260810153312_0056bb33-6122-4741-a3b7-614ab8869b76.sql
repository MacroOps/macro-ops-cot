UPDATE public.price_history p
SET close = 100 - p.close
FROM public.markets m
WHERE m.id = p.market_id AND m.symbol = 'SR3' AND p.close < 50;