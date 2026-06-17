// Types for TP Market Research tables. Field names mirror the upstream /schema.

export interface TpBreadthRow {
  date: string;
  sector: string;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  close_price: number | null;
  total_issues: number | null;
  advances: number | null;
  declines: number | null;
  up_volume: number | null;
  down_volume: number | null;
  total_volume: number | null;
  overbought: number | null;
  oversold: number | null;
  new_highs_21d: number | null;
  new_lows_21d: number | null;
  new_highs_63d: number | null;
  new_lows_63d: number | null;
  new_highs_252d: number | null;
  new_lows_252d: number | null;
  ma_10d: number | null;
  ma_30d: number | null;
  ma_50d: number | null;
  ma_200d: number | null;
  slope_200d: number | null;
  ma_50_150d: number | null;
  slope_50d: number | null;
  pct_5: number | null;
  pct_out_p: number | null;
  pct_out_p2: number | null;
  down_20_pct: number | null;
}

export interface TpRiskCompositeRow {
  date: string;
  sector: string;
  composite_type: string; // 'LT' | 'ST' | ...
  composite_score: number | null;
  signal_state: string | null;
  signal_change: string | null;
  signal_start_date: string | null;
}

export interface TpTrendSignalRow {
  date: string;
  symbol: string;
  timeframe: string | null;
  signal_state: string | null;
  signal_change: string | null;
  signal_start_date: string | null;
  signal_score: number | null;
  close_price: number | null;
  sector: string | null;
  industry: string | null;
}

export interface TpSectorTrendRow {
  date: string;
  sector: string;
  timeframe: string | null;
  signal_state: string | null;
  signal_score: number | null;
  composite_score: number | null;
  close_price: number | null;
}

export interface TpCustomIndexRow {
  index_code: string;
  index_name: string;
  symbol: string;
  name: string | null;
  sector: string | null;
  category: string | null;
  date_added: string;
}

export type TpTable =
  | "calculated_breadth_full"
  | "custom_indexes"
  | "index_constituents"
  | "risk_composite_history"
  | "sector_trend_timeseries"
  | "symbol_metadata"
  | "symbol_trend_relative_signals"
  | "trend_relative_signals"
  | "trend_signals";
