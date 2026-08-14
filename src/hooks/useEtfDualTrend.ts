// Dual-trend rows for the full ETF universe (127 ETFs).
// The Macro Ops Signal API carries index-level (S5xxx) relative-trend series;
// each maps 1:1 to its SPDR sector ETF proxy and is overlaid live on top of the
// published snapshot. All other ETFs render from the snapshot vintage.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";
import { ETF_SNAPSHOT, ETF_SNAPSHOT_DATE, type EtfSignal } from "@/lib/etfUniverse";

export type Signal = EtfSignal;

// index entity -> SPDR sector ETF proxy
export const SECTOR_INDEX_BY_ETF: Record<string, string> = {
  XLC: "S5TELS", XLY: "S5COND", XLP: "S5CONS", XLE: "S5ENRS", XLF: "S5FINL",
  XLV: "S5HLTH", XLI: "S5INDU", XLK: "S5INFT", XLB: "S5MATR", XLRE: "S5RLST",
  XLU: "S5UTIL",
};

export interface EtfDualTrendRow {
  etf: string;
  name: string;
  category: string;
  live: boolean;
  ltTrend: number;
  ltRelative: number;
  ltSignal: Signal;
  ltDays: number;
  ltDate: string;
  ltReturn: number | null;
  ltNet: number | null;
  stTrend: number;
  stRelative: number;
  stSignal: Signal;
  stDays: number;
  stDate: string;
  stReturn: number | null;
  stNet: number | null;
  riskLtSignal: Signal;
  riskStSignal: Signal;
}

export interface EtfDualTrend {
  asOf: string;
  liveCount: number;
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
  for (const r of rows ?? []) {
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
  let m = {} as Maps;
  let apiDate = "";
  try {
    const results = await Promise.all(
      KEYS.map((key) => mopsGet<MopsSignalRow[]>("/v1/signal", { key, entity_type: "index", limit: 100 })),
    );
    apiDate = results.flat().find((r) => r?.date)?.date ?? "";
    KEYS.forEach((k, i) => { m[k] = toMap(results[i]); });
  } catch {
    KEYS.forEach((k) => { m[k] = new Map(); });
  }

  let liveCount = 0;
  const rows: EtfDualTrendRow[] = ETF_SNAPSHOT.map((s) => {
    const code = SECTOR_INDEX_BY_ETF[s.etf];
    const hasLive = !!code && m.trend_rel_lt_state?.has(code);
    if (hasLive) liveCount += 1;
    return {
      etf: s.etf,
      name: s.name,
      category: s.category,
      live: hasLive,
      ltTrend: hasLive ? level(m.trend_rel_lt_value1.get(code)) : s.ltTrend,
      ltRelative: hasLive ? level(m.trend_rel_lt_value2.get(code)) : s.ltRelative,
      ltSignal: hasLive ? sig(m.trend_rel_lt_state.get(code)) : s.ltSignal,
      ltDays: hasLive ? Math.round(m.trend_rel_lt_days.get(code) ?? 0) : s.ltDays,
      ltDate: hasLive ? dateLabel(m.trend_rel_lt_start.get(code)) : "—",
      ltReturn: s.ltReturn,
      ltNet: s.ltNet,
      stTrend: hasLive ? level(m.trend_rel_st_value1.get(code)) : s.stTrend,
      stRelative: hasLive ? level(m.trend_rel_st_value2.get(code)) : s.stRelative,
      stSignal: hasLive ? sig(m.trend_rel_st_state.get(code)) : s.stSignal,
      stDays: hasLive ? Math.round(m.trend_rel_st_days.get(code) ?? 0) : s.stDays,
      stDate: hasLive ? dateLabel(m.trend_rel_st_start.get(code)) : "—",
      stReturn: s.stReturn,
      stNet: s.stNet,
      riskLtSignal: sig(m.risk_lt_state?.get(code ?? "")),
      riskStSignal: sig(m.risk_st_state?.get(code ?? "")),
    };
  });

  return { asOf: apiDate || ETF_SNAPSHOT_DATE, liveCount, rows };
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
