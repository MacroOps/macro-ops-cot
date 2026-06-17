import { useQuery } from "@tanstack/react-query";
import { tpFetch, type TpParams } from "@/lib/tp/client";
import type {
  TpBreadthRow,
  TpRiskCompositeRow,
  TpTrendSignalRow,
  TpSectorTrendRow,
  TpCustomIndexRow,
  TpTable,
} from "@/lib/tp/types";

function useTp<T>(table: TpTable, params: TpParams = {}) {
  return useQuery({
    queryKey: ["tp", table, params],
    queryFn: () => tpFetch<T>(table, params),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export const useTpBreadth = (params: TpParams = {}) =>
  useTp<TpBreadthRow>("calculated_breadth_full", { limit: 5000, ...params });

export const useTpRiskComposite = (params: TpParams = {}) =>
  useTp<TpRiskCompositeRow>("risk_composite_history", { limit: 5000, ...params });

export const useTpTrendSignals = (params: TpParams = {}) =>
  useTp<TpTrendSignalRow>("trend_signals", { limit: 5000, ...params });

export const useTpSectorTrend = (params: TpParams = {}) =>
  useTp<TpSectorTrendRow>("sector_trend_timeseries", { limit: 5000, ...params });

export const useTpCustomIndexes = (params: TpParams = {}) =>
  useTp<TpCustomIndexRow>("custom_indexes", { limit: 5000, ...params });
