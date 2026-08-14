// Live dual-trend (long-term / short-term relative trend) rows for S&P 500 constituents.
// All values come from the Macro Ops Signal API; names/sub-industries from the static universe.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";
import { SPX_UNIVERSE } from "@/lib/spxUniverse";

export const SECTOR_LABELS: Record<string, string> = {
  TELS: "Communication Services",
  COND: "Consumer Discretionary",
  CONS: "Consumer Staples",
  ENRS: "Energy",
  FINL: "Financials",
  HLTH: "Health Care",
  INDU: "Industrials",
  INFT: "Information Technology",
  MATR: "Materials",
  RLST: "Real Estate",
  UTIL: "Utilities",
};

export interface SpxDualTrendRow {
  symbol: string;
  name: string;
  sector: string;
  sectorLabel: string;
  subIndustry: string;
  ltTrend: number;
  ltRelative: number;
  ltSignal: "Bullish" | "Bearish";
  ltDays: number;
  stTrend: number;
  stRelative: number;
  stSignal: "Bullish" | "Bearish";
  stDays: number;
}

export interface SpxDualTrend {
  asOf: string;
  rows: SpxDualTrendRow[];
}

const KEYS = [
  "trend_rel_lt_value1",
  "trend_rel_lt_value2",
  "trend_rel_lt_state",
  "trend_rel_lt_days",
  "trend_rel_st_value1",
  "trend_rel_st_value2",
  "trend_rel_st_state",
  "trend_rel_st_days",
] as const;

function toMap(rows: MopsSignalRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isNaN(v)) m.set(r.entity, v);
  }
  return m;
}

// value1/value2 arrive on a 0-10 scale; the published tables show 0-100.
const level = (v: number | undefined) => (v === undefined ? 0 : Math.round(v * 10));

async function fetchSpxDualTrend(): Promise<SpxDualTrend> {
  const latest = await mopsGet<MopsSignalRow[]>("/v1/signal", {
    key: "trend_rel_lt_state",
    entity: "AAPL",
    limit: 1,
  });
  const asOf = latest[0]?.date ?? "";

  const results = await Promise.all(
    KEYS.map((key) =>
      mopsGet<MopsSignalRow[]>("/v1/signal", {
        key,
        date: asOf || undefined,
        entity_type: "symbol",
        limit: 1000,
      }).then(toMap),
    ),
  );
  const [ltV1, ltV2, ltState, ltDays, stV1, stV2, stState, stDays] = results;

  const rows: SpxDualTrendRow[] = Object.entries(SPX_UNIVERSE)
    .filter(([sym]) => ltState.has(sym) || stState.has(sym))
    .map(([symbol, [name, sector, subIndustry]]) => ({
      symbol,
      name,
      sector,
      sectorLabel: SECTOR_LABELS[sector] ?? sector,
      subIndustry,
      ltTrend: level(ltV1.get(symbol)),
      ltRelative: level(ltV2.get(symbol)),
      ltSignal: (ltState.get(symbol) ?? 0) > 0 ? "Bullish" : "Bearish",
      ltDays: Math.round(ltDays.get(symbol) ?? 0),
      stTrend: level(stV1.get(symbol)),
      stRelative: level(stV2.get(symbol)),
      stSignal: (stState.get(symbol) ?? 0) > 0 ? "Bullish" : "Bearish",
      stDays: Math.round(stDays.get(symbol) ?? 0),
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { asOf, rows };
}

export const useSpxDualTrend = () =>
  useQuery({
    queryKey: ["mops", "spx-dual-trend"],
    queryFn: fetchSpxDualTrend,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
