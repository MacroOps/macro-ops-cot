CREATE OR REPLACE FUNCTION public.get_cot_normalized(
  p_market_id uuid,
  p_lookback int DEFAULT 156
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      r.report_date,
      COALESCE(
        MAX(CASE WHEN r.format='tff_combined'           AND s.category='leveraged_fund' THEN s.net_contracts END),
        MAX(CASE WHEN r.format='tff'                    AND s.category='leveraged_fund' THEN s.net_contracts END),
        MAX(CASE WHEN r.format='disaggregated_combined' AND s.category='managed_money'  THEN s.net_contracts END),
        MAX(CASE WHEN r.format='disaggregated'          AND s.category='managed_money'  THEN s.net_contracts END)
      ) AS net,
      CASE
        WHEN MAX(CASE WHEN r.format IN ('tff','tff_combined') AND s.category='leveraged_fund' THEN 1 ELSE 0 END) = 1
          THEN 'leveraged_fund'
        ELSE 'managed_money'
      END AS source_category
    FROM cot_reports r
    JOIN positioning_snapshots s ON s.report_id = r.id
    WHERE r.market_id = p_market_id
      AND r.format IN ('tff','tff_combined','disaggregated','disaggregated_combined')
      AND s.category IN ('leveraged_fund','managed_money')
    GROUP BY r.report_date
  ),
  filtered AS (
    SELECT * FROM base WHERE net IS NOT NULL
  ),
  win AS (
    SELECT
      report_date,
      net,
      source_category,
      MIN(net) OVER w AS w_min,
      MAX(net) OVER w AS w_max,
      AVG(net) OVER w AS w_mean,
      STDDEV_SAMP(net) OVER w AS w_sd,
      COUNT(*) OVER w AS w_n
    FROM filtered
    WINDOW w AS (ORDER BY report_date ROWS BETWEEN (p_lookback - 1) PRECEDING AND CURRENT ROW)
  ),
  ranked AS (
    SELECT
      f.report_date,
      f.net,
      f.source_category,
      f.w_min, f.w_max, f.w_mean, f.w_sd, f.w_n,
      (
        SELECT (SUM(CASE WHEN g.net <= f.net THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0)) * 100
        FROM filtered g
        WHERE g.report_date <= f.report_date
          AND g.report_date > f.report_date - (p_lookback * INTERVAL '7 days') - INTERVAL '1 day'
      ) AS pct_rank
    FROM win f
  ),
  scored AS (
    SELECT
      report_date,
      net,
      source_category,
      w_n,
      CASE WHEN w_max > w_min
        THEN ((net - w_min)::numeric / (w_max - w_min)) * 100
        ELSE 50
      END AS cot_index,
      CASE WHEN w_sd IS NOT NULL AND w_sd > 0
        THEN (net - w_mean) / w_sd
        ELSE 0
      END AS zscore,
      pct_rank AS percentile
    FROM ranked
  ),
  flagged AS (
    SELECT
      *,
      CASE
        WHEN cot_index >= 95 THEN 'extreme_long_strong'
        WHEN cot_index >= 90 THEN 'extreme_long'
        WHEN cot_index <= 5  THEN 'extreme_short_strong'
        WHEN cot_index <= 10 THEN 'extreme_short'
        ELSE 'neutral'
      END AS tier,
      CASE WHEN cot_index >= 90 OR cot_index <= 10 THEN 1 ELSE 0 END AS in_extreme,
      CASE
        WHEN cot_index >= 90 THEN 'long'
        WHEN cot_index <= 10 THEN 'short'
        ELSE NULL
      END AS extreme_side,
      LAG(cot_index, 4) OVER (ORDER BY report_date) AS idx_4w_ago
    FROM scored
  ),
  streaks AS (
    SELECT
      *,
      ROW_NUMBER() OVER (ORDER BY report_date)
        - ROW_NUMBER() OVER (PARTITION BY in_extreme, extreme_side ORDER BY report_date) AS grp
    FROM flagged
  ),
  weeks AS (
    SELECT
      *,
      CASE WHEN in_extreme = 1
        THEN ROW_NUMBER() OVER (PARTITION BY in_extreme, extreme_side, grp ORDER BY report_date)
        ELSE 0
      END AS weeks_in_extreme
    FROM streaks
  ),
  regime AS (
    SELECT
      *,
      CASE
        WHEN in_extreme = 0 OR idx_4w_ago IS NULL THEN NULL
        WHEN extreme_side = 'long'  AND cot_index > idx_4w_ago + 1 THEN 'FAILING'
        WHEN extreme_side = 'long'  AND cot_index < idx_4w_ago - 3 THEN 'RESOLVING'
        WHEN extreme_side = 'short' AND cot_index < idx_4w_ago - 1 THEN 'FAILING'
        WHEN extreme_side = 'short' AND cot_index > idx_4w_ago + 3 THEN 'RESOLVING'
        ELSE 'STALLING'
      END AS regime_tag,
      CASE
        WHEN cot_index >= 90 THEN 'BEARISH'
        WHEN cot_index <= 10 THEN 'BULLISH'
        ELSE 'NEUTRAL'
      END AS signal
    FROM weeks
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'd', report_date,
    'net', net,
    'src', source_category,
    'n', w_n,
    'idx', ROUND(cot_index::numeric, 2),
    'z', ROUND(zscore::numeric, 3),
    'pct', ROUND(percentile::numeric, 2),
    'tier', tier,
    'side', extreme_side,
    'wks', weeks_in_extreme,
    'regime', regime_tag,
    'sig', signal,
    'lookback', p_lookback
  ) ORDER BY report_date), '[]'::jsonb)
  FROM regime;
$$;

GRANT EXECUTE ON FUNCTION public.get_cot_normalized(uuid, int) TO anon, authenticated, service_role;