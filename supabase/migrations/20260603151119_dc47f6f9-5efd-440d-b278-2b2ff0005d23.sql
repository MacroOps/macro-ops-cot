
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_payload_mv AS
WITH legacy_per_report AS (
  SELECT r.market_id, r.report_date,
    SUM(s.net_contracts) FILTER (WHERE s.category IN ('non_commercial','non_reportable')) AS net_spec
  FROM cot_reports r
  JOIN positioning_snapshots s ON s.report_id = r.id
  WHERE r.format = 'legacy' AND r.report_date >= (CURRENT_DATE - INTERVAL '3 years')
  GROUP BY r.market_id, r.report_date
),
legacy_arr AS (
  SELECT market_id,
    jsonb_agg(COALESCE(net_spec, 0) ORDER BY report_date) AS spec_series,
    MAX(report_date) AS last_report_date
  FROM legacy_per_report GROUP BY market_id
),
disagg_per_report AS (
  SELECT r.market_id, r.report_date,
    MAX(s.net_contracts) FILTER (WHERE s.category IN ('leveraged_fund','managed_money')) AS net_lev
  FROM cot_reports r
  JOIN positioning_snapshots s ON s.report_id = r.id
  WHERE r.format = 'disaggregated' AND r.report_date >= (CURRENT_DATE - INTERVAL '3 years')
  GROUP BY r.market_id, r.report_date
),
disagg_arr AS (
  SELECT market_id, jsonb_agg(COALESCE(net_lev, 0) ORDER BY report_date) AS lev_series
  FROM disagg_per_report GROUP BY market_id
),
tff_per_report AS (
  SELECT r.market_id, r.report_date,
    MAX(s.net_contracts) FILTER (WHERE s.category = 'leveraged_fund') AS net_lev,
    MAX(s.net_contracts) FILTER (WHERE s.category = 'asset_manager') AS net_am
  FROM cot_reports r
  JOIN positioning_snapshots s ON s.report_id = r.id
  WHERE r.format = 'tff' AND r.report_date >= (CURRENT_DATE - INTERVAL '3 years')
  GROUP BY r.market_id, r.report_date
),
tff_arr AS (
  SELECT market_id,
    jsonb_agg(jsonb_build_object('l', COALESCE(net_lev, 0), 'a', COALESCE(net_am, 0)) ORDER BY report_date) AS tff_series
  FROM tff_per_report GROUP BY market_id
),
last_prices AS (
  SELECT market_id, jsonb_agg(close ORDER BY observed_on DESC) AS px
  FROM (
    SELECT market_id, observed_on, close,
      ROW_NUMBER() OVER (PARTITION BY market_id ORDER BY observed_on DESC) AS rn
    FROM price_history
  ) p
  WHERE rn <= 2
  GROUP BY market_id
)
SELECT
  1::int AS id,
  jsonb_build_object(
    'reportDate', (SELECT MAX(last_report_date) FROM legacy_arr),
    'markets', COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'symbol', m.symbol,
      'name', m.name,
      'sector', m.sector,
      'specSeries', COALESCE(la.spec_series, '[]'::jsonb),
      'levSeries', COALESCE(da.lev_series, '[]'::jsonb),
      'tffSeries', COALESCE(ta.tff_series, '[]'::jsonb),
      'px', COALESCE(lp.px, '[]'::jsonb)
    )), '[]'::jsonb)
  ) AS payload,
  now() AS refreshed_at
FROM markets m
LEFT JOIN legacy_arr la ON la.market_id = m.id
LEFT JOIN disagg_arr da ON da.market_id = m.id
LEFT JOIN tff_arr ta ON ta.market_id = m.id
LEFT JOIN last_prices lp ON lp.market_id = m.id
WHERE m.is_active;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_payload_mv_pk ON public.dashboard_payload_mv(id);

GRANT SELECT ON public.dashboard_payload_mv TO anon, authenticated;
GRANT ALL ON public.dashboard_payload_mv TO service_role;

CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT payload FROM public.dashboard_payload_mv WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_payload()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_payload_mv;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.dashboard_payload_mv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_dashboard_payload() TO service_role;
