import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Sector } from "@/lib/mockData";

export interface SectorHistoryPoint {
  date: string;
  netContracts: number;       // sum of net specs across sector
  avgNetSpecPct3y: number;    // avg 156w percentile across markets
  avgNetSpecPct6m: number;    // avg 26w percentile
  crowdedLong: number;        // # markets with 3Y pct >= 85
  crowdedShort: number;       // # markets with 3Y pct <= 15
  count: number;              // # markets contributing
}

function percentileWindow(values: number[], window: number): number[] {
  const out: number[] = new Array(values.length).fill(50);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const v = values[i];
    let below = 0;
    for (const x of slice) if (x <= v) below++;
    out[i] = Math.round((below / slice.length) * 100);
  }
  return out;
}

export function useSectorHistory(sector: Sector | null) {
  return useQuery({
    queryKey: ["sector-history", sector],
    enabled: !!sector,
    queryFn: async (): Promise<SectorHistoryPoint[]> => {
      // 1. Markets in this sector
      const { data: markets, error: mErr } = await supabase
        .from("markets")
        .select("id,symbol")
        .eq("sector", sector!)
        .eq("is_active", true);
      if (mErr) throw mErr;
      if (!markets || markets.length === 0) return [];
      const marketIds = markets.map(m => m.id);

      // 2. Legacy COT reports across these markets (weekly).
      const reports: { id: string; market_id: string; report_date: string }[] = [];
      const CHUNK = 50;
      for (let i = 0; i < marketIds.length; i += CHUNK) {
        const chunk = marketIds.slice(i, i + CHUNK);
        // paginate to avoid the 1000-row cap
        for (let from = 0; from < 100000; from += 1000) {
          const { data, error } = await supabase
            .from("cot_reports")
            .select("id,market_id,report_date")
            .in("market_id", chunk)
            .eq("format", "legacy")
            .order("report_date", { ascending: true })
            .range(from, from + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          reports.push(...data);
          if (data.length < 1000) break;
        }
      }
      if (reports.length === 0) return [];

      // 3. Positioning snapshots for those reports
      const reportIds = reports.map(r => r.id);
      const snapRows: { report_id: string; category: string; net_contracts: number | null }[] = [];
      const SCHUNK = 200;
      for (let i = 0; i < reportIds.length; i += SCHUNK) {
        const chunk = reportIds.slice(i, i + SCHUNK);
        const { data, error } = await supabase
          .from("positioning_snapshots")
          .select("report_id,category,net_contracts")
          .in("report_id", chunk)
          .in("category", ["non_commercial", "non_reportable"]);
        if (error) throw error;
        if (data) snapRows.push(...data);
      }
      const netByReport = new Map<string, number>();
      for (const s of snapRows) {
        netByReport.set(s.report_id, (netByReport.get(s.report_id) ?? 0) + (s.net_contracts ?? 0));
      }

      // 4. Build per-market sorted series of (date, netSpec)
      const perMarket = new Map<string, { date: string; net: number }[]>();
      for (const r of reports) {
        const net = netByReport.get(r.id);
        if (net == null) continue;
        let arr = perMarket.get(r.market_id);
        if (!arr) { arr = []; perMarket.set(r.market_id, arr); }
        arr.push({ date: r.report_date, net });
      }

      // 5. Compute per-market rolling percentiles, then aggregate by date
      const agg = new Map<string, { sumNet: number; sumPct3y: number; sumPct6m: number; long: number; short: number; n: number }>();
      for (const arr of perMarket.values()) {
        arr.sort((a, b) => a.date.localeCompare(b.date));
        const nets = arr.map(p => p.net);
        const p3y = percentileWindow(nets, 156);
        const p6m = percentileWindow(nets, 26);
        for (let i = 0; i < arr.length; i++) {
          const d = arr[i].date;
          const e = agg.get(d) ?? { sumNet: 0, sumPct3y: 0, sumPct6m: 0, long: 0, short: 0, n: 0 };
          e.sumNet += arr[i].net;
          e.sumPct3y += p3y[i];
          e.sumPct6m += p6m[i];
          if (p3y[i] >= 85) e.long += 1;
          if (p3y[i] <= 15) e.short += 1;
          e.n += 1;
          agg.set(d, e);
        }
      }

      const out: SectorHistoryPoint[] = Array.from(agg.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, e]) => ({
          date,
          netContracts: e.sumNet,
          avgNetSpecPct3y: Math.round(e.sumPct3y / e.n),
          avgNetSpecPct6m: Math.round(e.sumPct6m / e.n),
          crowdedLong: e.long,
          crowdedShort: e.short,
          count: e.n,
        }));

      return out;
    },
    staleTime: 5 * 60 * 1000,
  });
}
