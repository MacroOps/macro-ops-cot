import { useDashboardData } from "./useDashboardData";
import type { MarketSnapshot, Sector } from "@/lib/mockData";
import { SECTORS } from "@/lib/mockData";

export interface SectorRollup {
  sector: Sector;
  count: number;
  netContracts: number;          // = sum of net spec
  wowChange: number;
  avgLevPct: number;
  avgSpecPct: number;            // legacy large spec percentile (kept for ref)
  avgNetSpecPct3y: number;       // PRIMARY default
  avgNetSpecPct6m: number;
  crowdedLong: number;           // # markets with netSpecPct3y >= 85
  crowdedShort: number;          // # markets with netSpecPct3y <= 15
  avgWeekChangePct: number;
  markets: MarketSnapshot[];
}

export function useSectorData() {
  const q = useDashboardData();
  const markets = q.data?.markets ?? [];

  const rollups: SectorRollup[] = SECTORS.map(sector => {
    const ms = markets.filter(m => m.sector === sector);
    const n = ms.length || 1;
    return {
      sector,
      count: ms.length,
      markets: ms,
      netContracts: ms.reduce((a, m) => a + m.netSpecContracts, 0),
      wowChange: ms.reduce((a, m) => a + m.wowChange, 0),
      avgLevPct: Math.round(ms.reduce((a, m) => a + m.leveragedFundPercentile, 0) / n),
      avgSpecPct: Math.round(ms.reduce((a, m) => a + m.largeSpecPercentile, 0) / n),
      avgNetSpecPct3y: Math.round(ms.reduce((a, m) => a + m.netSpecPct3y, 0) / n),
      avgNetSpecPct6m: Math.round(ms.reduce((a, m) => a + m.netSpecPct6m, 0) / n),
      crowdedLong: ms.filter(m => m.netSpecPct3y >= 85).length,
      crowdedShort: ms.filter(m => m.netSpecPct3y <= 15).length,
      avgWeekChangePct: ms.reduce((a, m) => a + m.weekChangePct, 0) / n,
    };
  });

  return { ...q, rollups, reportDate: q.data?.reportDate ?? null };
}
