// S&P 500 sector overview: long/short-term relative-trend breadth per GICS sector.
// Built from live Macro Ops Signal API data (symbol-level trend_rel_*_state),
// aggregated client-side against sector membership.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";

export const SECTOR_NAMES: Record<string, string> = {
  S5TELS: "Communication Services",
  S5COND: "Consumer Discretionary",
  S5CONS: "Consumer Staples",
  S5ENRS: "Energy",
  S5FINL: "Financials",
  S5HLTH: "Health Care",
  S5INDU: "Industrials",
  S5INFT: "Information Technology",
  S5MATR: "Materials",
  S5RLST: "Real Estate",
  S5UTIL: "Utilities",
};

const SECTOR_CODES = Object.keys(SECTOR_NAMES);

export interface SectorOverviewRow {
  code: string;
  name: string;
  total: number;
  bullishLT: number;
  pctBullishLT: number;
  bullishLTChg: number;
  bearishLT: number;
  pctBearishLT: number;
  bearishLTChg: number;
  bullishST: number;
  pctBullishST: number;
  bullishSTChg: number;
  bearishST: number;
  pctBearishST: number;
  bearishSTChg: number;
}

export interface SectorOverview {
  asOf: string;
  priorDate: string;
  total: SectorOverviewRow;
  sectors: SectorOverviewRow[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function toMap(rows: MopsSignalRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isNaN(v)) m.set(r.entity, v);
  }
  return m;
}

function countRow(
  code: string,
  name: string,
  members: string[],
  lt: Map<string, number>,
  ltPrev: Map<string, number>,
  st: Map<string, number>,
  stPrev: Map<string, number>,
): SectorOverviewRow {
  const tally = (m: Map<string, number>, sign: 1 | -1) =>
    members.reduce((acc, s) => {
      const v = m.get(s);
      return acc + (v !== undefined && Math.sign(v) === sign ? 1 : 0);
    }, 0);

  // Total = full sector membership from the API (not just symbols with a signal today).
  const total = members.length;

  const bullishLT = tally(lt, 1);
  const bearishLT = tally(lt, -1);
  const bullishST = tally(st, 1);
  const bearishST = tally(st, -1);

  return {
    code,
    name,
    total,
    bullishLT,
    pctBullishLT: pct(bullishLT, total),
    bullishLTChg: bullishLT - tally(ltPrev, 1),
    bearishLT,
    pctBearishLT: pct(bearishLT, total),
    bearishLTChg: bearishLT - tally(ltPrev, -1),
    bullishST,
    pctBullishST: pct(bullishST, total),
    bullishSTChg: bullishST - tally(stPrev, 1),
    bearishST,
    pctBearishST: pct(bearishST, total),
    bearishSTChg: bearishST - tally(stPrev, -1),
  };
}

async function fetchSectorOverview(): Promise<SectorOverview> {
  // 1. Recent trading dates (latest + 5 sessions back).
  const from = new Date();
  from.setDate(from.getDate() - 25);
  const calendar = await mopsGet<MopsSignalRow[]>("/v1/signal", {
    key: "trend_rel_lt_state",
    entity: "AAPL",
    from_date: iso(from),
    limit: 40,
  });
  const dates = Array.from(new Set(calendar.map((r) => r.date))).sort().reverse();
  const asOf = dates[0];
  const priorDate = dates[Math.min(5, dates.length - 1)];

  // 2. Sector membership.
  const memberLists = await Promise.all(
    SECTOR_CODES.map((code) => mopsGet<string[]>("/v1/members", { parent: code })),
  );
  const members: Record<string, string[]> = {};
  SECTOR_CODES.forEach((code, i) => (members[code] = memberLists[i] ?? []));

  // 3. Symbol-level trend states, current + 5 sessions ago.
  const signal = (key: string, date: string) =>
    mopsGet<MopsSignalRow[]>("/v1/signal", { key, date, entity_type: "symbol", limit: 1000 });

  const [ltRows, ltPrevRows, stRows, stPrevRows] = await Promise.all([
    signal("trend_rel_lt_state", asOf),
    signal("trend_rel_lt_state", priorDate),
    signal("trend_rel_st_state", asOf),
    signal("trend_rel_st_state", priorDate),
  ]);

  const lt = toMap(ltRows);
  const ltPrev = toMap(ltPrevRows);
  const st = toMap(stRows);
  const stPrev = toMap(stPrevRows);

  const sectors = SECTOR_CODES.map((code) =>
    countRow(code, SECTOR_NAMES[code], members[code], lt, ltPrev, st, stPrev),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const all = Array.from(new Set(SECTOR_CODES.flatMap((c) => members[c])));
  const total = countRow("SPX", "S&P 500", all, lt, ltPrev, st, stPrev);

  return { asOf, priorDate, total, sectors };
}

export const useSectorOverview = () =>
  useQuery({
    queryKey: ["mops", "sector-overview"],
    queryFn: fetchSectorOverview,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
