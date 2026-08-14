// Live dual-trend rows for the sector-ETF universe.
// The Macro Ops Signal API carries index-level (S5xxx) relative-trend series;
// each maps 1:1 to its SPDR sector ETF proxy.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";

export interface EtfMeta {
  code: string;   // index entity in the API
  etf: string;    // ETF proxy ticker
  name: string;
  category: string;
}

export const ETF_UNIVERSE: EtfMeta[] = [
  { code: "S5TELS", etf: "XLC", name: "Communication Services Select Sector SPDR", category: "US Sector" },
  { code: "S5COND", etf: "XLY", name: "Consumer Discretionary Select Sector SPDR", category: "US Sector" },
  { code: "S5CONS", etf: "XLP", name: "Consumer Staples Select Sector SPDR", category: "US Sector" },
  { code: "S5ENRS", etf: "XLE", name: "Energy Select Sector SPDR", category: "US Sector" },
  { code: "S5FINL", etf: "XLF", name: "Financial Select Sector SPDR", category: "US Sector" },
  { code: "S5HLTH", etf: "XLV", name: "Health Care Select Sector SPDR", category: "US Sector" },
  { code: "S5INDU", etf: "XLI", name: "Industrial Select Sector SPDR", category: "US Sector" },
  { code: "S5INFT", etf: "XLK", name: "Technology Select Sector SPDR", category: "US Sector" },
  { code: "S5MATR", etf: "XLB", name: "Materials Select Sector SPDR", category: "US Sector" },
  { code: "S5RLST", etf: "XLRE", name: "Real Estate Select Sector SPDR", category: "US Sector" },
  { code: "S5UTIL", etf: "XLU", name: "Utilities Select Sector SPDR", category: "US Sector" },
];

export type Signal = "Bullish" | "Bearish" | "Neutral";

export interface EtfDualTrendRow extends EtfMeta {
  ltTrend: number;
  ltRelative: number;
  ltSignal: Signal;
  ltDays: number;
  ltDate: string;
  stTrend: number;
  stRelative: number;
  stSignal: Signal;
  stDays: number;
  stDate: string;
  riskLtSignal: Signal;
  riskStSignal: Signal;
}

export interface EtfDualTrend {
  asOf: string;
  rows: EtfDualTrendRow[];
}

const KEYS = [
  "trend_rel_lt_value1", "trend_rel_lt_value2", "trend_rel_lt_state", "trend_rel_lt_days", "trend_rel_lt_start",
  "trend_rel_st_value1", "trend_rel_st_value2", "trend_rel_st_state", "trend_rel_st_days", "trend_rel_st_start",
  "risk_lt_state", "risk_st_state",
] as const;

type Maps = Record<(typeof KEYS)[number], Map<string, number>>;

function toMap(rows: MopsSignalRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isNaN(v)) m.set(r.entity, v);
  }
  return m;
}

// Signal-start dates arrive as days since the Unix epoch.
function dateLabel(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  const d = new Date(v * 86_400_000);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${String(d.getUTCFullYear()).slice(2)}`;
}

const sig = (v: number | undefined): Signal =>
  v === undefined || v === 0 ? "Neutral" : v > 0 ? "Bullish" : "Bearish";

// value fields are 0-10 upstream; published tables use 0-100.
const level = (v: number | undefined) => (v === undefined ? 0 : Math.round(v * 10));

async function fetchEtfDualTrend(): Promise<EtfDualTrend> {
  const results = await Promise.all(
    KEYS.map((key) => mopsGet<MopsSignalRow[]>("/v1/signal", { key, entity_type: "index", limit: 100 })),
  );
  const asOf = results.flat().find((r) => r?.date)?.date ?? "";
  const m = {} as Maps;
  KEYS.forEach((k, i) => { m[k] = toMap(results[i]); });

  const rows = ETF_UNIVERSE.map((e) => ({
    ...e,
    ltTrend: level(m.trend_rel_lt_value1.get(e.code)),
    ltRelative: level(m.trend_rel_lt_value2.get(e.code)),
    ltSignal: sig(m.trend_rel_lt_state.get(e.code)),
    ltDays: Math.round(m.trend_rel_lt_days.get(e.code) ?? 0),
    ltDate: dateLabel(m.trend_rel_lt_start.get(e.code)),
    stTrend: level(m.trend_rel_st_value1.get(e.code)),
    stRelative: level(m.trend_rel_st_value2.get(e.code)),
    stSignal: sig(m.trend_rel_st_state.get(e.code)),
    stDays: Math.round(m.trend_rel_st_days.get(e.code) ?? 0),
    stDate: dateLabel(m.trend_rel_st_start.get(e.code)),
    riskLtSignal: sig(m.risk_lt_state.get(e.code)),
    riskStSignal: sig(m.risk_st_state.get(e.code)),
  }));

  return { asOf, rows };
}

export const useEtfDualTrend = () =>
  useQuery({
    queryKey: ["mops", "etf-dual-trend"],
    queryFn: fetchEtfDualTrend,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
