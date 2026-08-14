// Per-symbol dual-trend detail: current signal run length and signal date,
// derived from the Macro Ops state history (the API's *_days key is not populated).
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";

export interface TrendRun {
  signal: "Bullish" | "Bearish" | null;
  days: number;          // trading sessions in current signal
  signalDate: string;    // ISO date the signal started
}

export interface SymbolTrendDetail {
  asOf: string;
  lt: TrendRun;
  st: TrendRun;
}

const EMPTY: TrendRun = { signal: null, days: 0, signalDate: "" };

function run(rows: MopsSignalRow[]): TrendRun {
  // rows are newest-first
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!sorted.length) return EMPTY;
  const sign = Math.sign(Number(sorted[0].value));
  if (!sign) return EMPTY;
  let i = 0;
  while (i < sorted.length && Math.sign(Number(sorted[i].value)) === sign) i++;
  return {
    signal: sign > 0 ? "Bullish" : "Bearish",
    days: i - 1,
    signalDate: sorted[i - 1].date,
  };
}

export const useSymbolTrendDetail = (symbol: string, enabled: boolean) =>
  useQuery({
    queryKey: ["mops", "symbol-trend-detail", symbol],
    enabled: enabled && !!symbol,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<SymbolTrendDetail> => {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 3);
      const params = { entity: symbol, from_date: from.toISOString().slice(0, 10), limit: 1000 };
      const [ltRows, stRows] = await Promise.all([
        mopsGet<MopsSignalRow[]>("/v1/signal", { key: "trend_rel_lt_state", ...params }),
        mopsGet<MopsSignalRow[]>("/v1/signal", { key: "trend_rel_st_state", ...params }),
      ]);
      return {
        asOf: ltRows[0]?.date ?? stRows[0]?.date ?? "",
        lt: run(ltRows),
        st: run(stRows),
      };
    },
  });
