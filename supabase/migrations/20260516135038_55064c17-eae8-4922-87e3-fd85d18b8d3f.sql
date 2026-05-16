WITH yr AS (
  SELECT market_id, EXTRACT(YEAR FROM observed_on)::int AS y, COUNT(*) AS c
  FROM price_history GROUP BY 1,2
),
first_daily AS (
  SELECT market_id, MIN(y) AS fy FROM yr WHERE c >= 150 GROUP BY market_id
)
DELETE FROM price_history p
USING first_daily f
WHERE f.market_id = p.market_id
  AND EXTRACT(YEAR FROM p.observed_on)::int < f.fy;