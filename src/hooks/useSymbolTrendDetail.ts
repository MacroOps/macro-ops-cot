// Per-symbol dual-trend detail: current signal run length, signal date and
// since-signal returns. Days/date derive from the Macro Ops state history
// (the API's *_days key is not populated); returns come from the symbol-returns function.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import { supabase } from "@/integrations/supabase/client";
import type { MopsSignalRow } from "@/lib/mops/types";

export interface TrendRun {
  signal: "Bullish" | "Bearish" | null;
  days: number;          // trading sessions in current signal
  signalDate: string;    // ISO date the signal started
  ret: number | null;    // % return since signal date
  net: number | null;    // % return vs S&P 500 since signal date
}

export interface SymbolTrendDetail {
  asOf: string;
  lt: TrendRun;
  st: TrendRun;
}

const EMPTY: TrendRun = { signal: null, days: 0, signalDate: "", ret: null, net: null };

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
    ret: null,
    net: null,
  };
}

type ReturnsMap = Record<string, { ret: number | null; net: number | null }>;

async function fetchReturns(symbol: string, dates: string[]): Promise<ReturnsMap> {
  const unique = [...new Set(dates.filter(Boolean))];
  if (!unique.length) return {};
  try {
    const { data, error } = await supabase.functions.invoke<{ returns: ReturnsMap }>(
      `symbol-returns?symbol=${encodeURIComponent(symbol)}&dates=${unique.join(",")}`,
      { method: "GET" },
    );
    if (error) return {};
    return data?.returns ?? {};
  } catch {
    return {};
  }
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
