// S&P 500 / 400 / 600 sector overview: long/short-term relative-trend breadth per GICS sector.
// Built from live Macro Ops Signal API data (symbol-level trend_rel_*_state),
// aggregated client-side against sector membership.
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import { signalAll, signalSnapshot, toValueMap } from "@/lib/mops/paginate";
import { INDEX_LABELS, sectorGroups, type IndexCode } from "@/lib/dualTrend/config";

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

async function fetchSectorOverview(index: IndexCode): Promise<SectorOverview> {
  // 1. Recent trading dates (latest + 5 sessions back).
  const from = new Date();
  from.setDate(from.getDate() - 25);
  const calendar = await signalAll({ key: "trend_rel_lt_state", entity: "AAPL", from_date: iso(from) });
  const dates = Array.from(new Set(calendar.map((r) => r.date))).sort().reverse();
  const asOf = dates[0];
  const priorDate = dates[Math.min(5, dates.length - 1)];

  // 2. Index + sector membership from the API.
  const groups = sectorGroups(index);
  const [indexMembers, ...memberLists] = await Promise.all([
    mopsGet<string[]>("/v1/members", { parent: index }),
    ...groups.map((g) => mopsGet<string[]>("/v1/members", { parent: g.group })),
  ]);

  // 3. Symbol-level trend states, current + 5 sessions ago (paged, shared cache).
  const [ltRows, ltPrevRows, stRows, stPrevRows] = await Promise.all([
    signalSnapshot("trend_rel_lt_state", asOf),
    signalSnapshot("trend_rel_lt_state", priorDate),
    signalSnapshot("trend_rel_st_state", asOf),
    signalSnapshot("trend_rel_st_state", priorDate),
  ]);
  const lt = toValueMap(ltRows);
  const ltPrev = toValueMap(ltPrevRows);
  const st = toValueMap(stRows);
  const stPrev = toValueMap(stPrevRows);

  const sectors = groups
    .map((g, i) => countRow(g.group, g.name, memberLists[i] ?? [], lt, ltPrev, st, stPrev))
    .filter((r) => r.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = countRow(index, INDEX_LABELS[index], indexMembers ?? [], lt, ltPrev, st, stPrev);

  return { asOf, priorDate, total, sectors };
}

export const useSectorOverview = (index: IndexCode = "SPX") =>
  useQuery({
    queryKey: ["mops", "sector-overview", index],
    queryFn: () => fetchSectorOverview(index),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
