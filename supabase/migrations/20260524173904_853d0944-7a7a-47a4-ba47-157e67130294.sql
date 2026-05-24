CREATE OR REPLACE FUNCTION public.get_asset_cot_series(p_market_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH agg AS (
    SELECT
      r.report_date,
      MAX(r.open_interest) AS open_interest,
      MAX(CASE WHEN r.format='legacy' AND s.category='non_commercial' THEN s.net_contracts END) AS net_large,
      MAX(CASE WHEN r.format='legacy' AND s.category='non_reportable' THEN s.net_contracts END) AS net_small,
      MAX(CASE WHEN r.format='legacy' AND s.category='commercial' THEN s.net_contracts END) AS net_commercial,
      COALESCE(
        MAX(CASE WHEN r.format='tff' AND s.category='leveraged_fund' THEN s.net_contracts END),
        MAX(CASE WHEN r.format='disaggregated' AND s.category='managed_money' THEN s.net_contracts END)
      ) AS net_lev,
      MAX(CASE WHEN r.format='disaggregated' AND s.category='managed_money' THEN s.net_contracts END) AS net_mm,
      MAX(CASE WHEN r.format='tff' AND s.category='asset_manager' THEN s.net_contracts END) AS net_asset_mgr,
      bool_or(r.format='legacy') AS has_legacy,
      bool_or((r.format='tff' AND s.category='leveraged_fund') OR (r.format='disaggregated' AND s.category='managed_money')) AS has_lev,
      bool_or(r.format='disaggregated' AND s.category='managed_money') AS has_mm,
      bool_or(r.format='tff' AND s.category='asset_manager') AS has_asset_mgr
    FROM cot_reports r
    LEFT JOIN positioning_snapshots s ON s.report_id = r.id
    WHERE r.market_id = p_market_id
    GROUP BY r.report_date
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'd', report_date,
    'oi', COALESCE(open_interest, 0),
    'nl', COALESCE(net_large, 0),
    'ns', COALESCE(net_small, 0),
    'nc', COALESCE(net_commercial, 0),
    'nlv', COALESCE(net_lev, 0),
    'nmm', COALESCE(net_mm, 0),
    'nam', COALESCE(net_asset_mgr, 0),
    'hl', COALESCE(has_legacy, false),
    'hlv', COALESCE(has_lev, false),
    'hmm', COALESCE(has_mm, false),
    'ham', COALESCE(has_asset_mgr, false)
  ) ORDER BY report_date), '[]'::jsonb)
  FROM agg
  WHERE has_legacy;
$function$;