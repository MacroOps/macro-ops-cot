// S&P 500 / 400 / 600 sector overview: long/short-term relative-trend breadth per GICS sector.
// Built from saved daily data (dual_trend_members / dual_trend_signals), aggregated
// client-side; 5-day change compares with the saved day 5 trading days earlier.
import { useQuery } from "@tanstack/react-query";
import { latestFullDay, priorSavedDay, readMembers, readSignalDays, readSignals } from "@/lib/dualTrend/saved";
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
  // Saved data only: newest full day, and the saved day 5 trading days earlier.
  const days = await readSignalDays();
  const asOf = latestFullDay(days);
  const priorDate = priorSavedDay(days, asOf, 5);
  const groups = sectorGroups(index);
  const empty = new Map<string, number>();
  const [members, now, prev] = await Promise.all([
    asOf ? readMembers(asOf, [index, ...groups.map((g) => g.group)]) : Promise.resolve([]),
    asOf ? readSignals(asOf) : Promise.resolve(null),
    priorDate ? readSignals(priorDate) : Promise.resolve(null),
  ]);
  const of = (u: string) => members.filter((m) => m.universe === u).map((m) => m.symbol.toUpperCase());
  const lt = now?.trend_rel_lt_state ?? empty;
  const st = now?.trend_rel_st_state ?? empty;
  // No saved day 5 back -> change reads 0 against the current day, not a guess.
  const ltPrev = prev?.trend_rel_lt_state ?? lt;
  const stPrev = prev?.trend_rel_st_state ?? st;

  const sectors = groups
    .map((g) => countRow(g.group, g.name, of(g.group), lt, ltPrev, st, stPrev))
    .filter((r) => r.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = countRow(index, INDEX_LABELS[index], of(index), lt, ltPrev, st, stPrev);

  return { asOf, priorDate, total, sectors };
}

export const useSectorOverview = (index: IndexCode = "SPX") =>
  useQuery({
    queryKey: ["saved", "sector-overview", index],
    queryFn: () => fetchSectorOverview(index),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
