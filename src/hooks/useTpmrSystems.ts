// Live index/sector "systems" snapshot for the TPMR Market Overview page.
// Source: Macro Ops Signal API (entity_type=index) — risk ST/LT and the
// long-term relative trend model for SPX and the 11 GICS sector indices.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";
import { SECTOR_NAMES } from "@/hooks/useSectorOverview";

export type Dir = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface SystemSnapshot {
  level: number; // 0-100
  signal: Dir;
  date: string; // MM/DD/YY or "—"
  days: number;
}

export interface SystemsRow {
  code: string;
  label: string;
  riskST: SystemSnapshot;
  riskLT: SystemSnapshot;
  trend: SystemSnapshot & { tLevel: number; rLevel: number };
}

export interface TpmrSystems {
  asOf: string;
  spx?: SystemsRow;
  sectors: SystemsRow[];
}

const KEYS = [
  "risk_st_state", "risk_st_score", "risk_st_days", "risk_st_start",
  "risk_lt_state", "risk_lt_score", "risk_lt_days", "risk_lt_start",
  "trend_rel_lt_state", "trend_rel_lt_days", "trend_rel_lt_start",
  "trend_rel_lt_value1", "trend_rel_lt_value2",
] as const;

type KeyMaps = Record<(typeof KEYS)[number], Map<string, number>>;

function toMap(rows: MopsSignalRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isNaN(v)) m.set(r.entity, v);
  }
  return m;
}

// Upstream encodes signal-start dates as days since the Unix epoch.
function epochDaysToLabel(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  const d = new Date(v * 86_400_000);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${String(d.getUTCFullYear()).slice(2)}`;
}

const dir = (v: number | undefined): Dir =>
  v === undefined || v === 0 ? "NEUTRAL" : v > 0 ? "BULLISH" : "BEARISH";

// score/value fields arrive on a 0-10 scale; the published tables show 0-100.
const level = (v: number | undefined) => (v === undefined ? 0 : Math.round(v * 10));

function buildRow(code: string, label: string, m: KeyMaps): SystemsRow {
  return {
    code,
    label,
    riskST: {
      level: level(m.risk_st_score.get(code)),
      signal: dir(m.risk_st_state.get(code)),
      date: epochDaysToLabel(m.risk_st_start.get(code)),
      days: Math.round(m.risk_st_days.get(code) ?? 0),
    },
    riskLT: {
      level: level(m.risk_lt_score.get(code)),
      signal: dir(m.risk_lt_state.get(code)),
      date: epochDaysToLabel(m.risk_lt_start.get(code)),
      days: Math.round(m.risk_lt_days.get(code) ?? 0),
    },
    trend: {
      level: level(m.trend_rel_lt_value1.get(code)),
      signal: dir(m.trend_rel_lt_state.get(code)),
      date: epochDaysToLabel(m.trend_rel_lt_start.get(code)),
      days: Math.round(m.trend_rel_lt_days.get(code) ?? 0),
      tLevel: level(m.trend_rel_lt_value1.get(code)),
      rLevel: level(m.trend_rel_lt_value2.get(code)),
    },
  };
}

async function fetchTpmrSystems(): Promise<TpmrSystems> {
  const results = await Promise.all(
    KEYS.map((key) =>
      mopsGet<MopsSignalRow[]>("/v1/signal", { key, entity_type: "index", limit: 100 }),
    ),
  );
  const asOf = results.flat().find((r) => r?.date)?.date ?? "";
  const maps = {} as KeyMaps;
  KEYS.forEach((k, i) => {
    maps[k] = toMap(results[i]);
  });

  const sectors = Object.entries(SECTOR_NAMES)
    .map(([code, name]) => buildRow(code, name, maps))
    .sort((a, b) => a.label.localeCompare(b.label));

  const spx = maps.risk_lt_state.has("SPX") ? buildRow("SPX", "S&P 500", maps) : undefined;

  return { asOf, spx, sectors };
}

export const useTpmrSystems = () =>
  useQuery({
    queryKey: ["mops", "tpmr-systems"],
    queryFn: fetchTpmrSystems,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
