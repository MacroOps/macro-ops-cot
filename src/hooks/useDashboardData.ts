import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MarketSnapshot, Sector } from "@/lib/mockData";

// Deterministic 0-100 percentile derived from a numeric value.
// Stand-in until we have a true rolling history per market.
function pseudoPercentile(seed: number, salt: number) {
  const x = Math.sin(seed * 9301 + salt * 49297) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * 100);
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: async (): Promise<{ markets: MarketSnapshot[]; reportDate: string | null }> => {
      const [{ data: markets, error: mErr }, { data: reports, error: rErr }, { data: prices, error: pErr }] =
        await Promise.all([
          supabase.from("markets").select("id,symbol,name,sector").eq("is_active", true),
          supabase.from("cot_reports").select("id,market_id,report_date,format").order("report_date", { ascending: false }),
          supabase.from("price_history").select("market_id,observed_on,close").order("observed_on", { ascending: false }),
        ]);

      if (mErr) throw mErr;
      if (rErr) throw rErr;
      if (pErr) throw pErr;
      if (!markets) return { markets: [], reportDate: null };

      // Latest legacy + disaggregated report per market
      const latestLegacyByMarket = new Map<string, { id: string; report_date: string }>();
      const latestDisaggByMarket = new Map<string, { id: string; report_date: string }>();
      for (const r of reports ?? []) {
        if (r.format === "legacy" && !latestLegacyByMarket.has(r.market_id)) {
          latestLegacyByMarket.set(r.market_id, { id: r.id, report_date: r.report_date });
        }
        if (r.format === "disaggregated" && !latestDisaggByMarket.has(r.market_id)) {
          latestDisaggByMarket.set(r.market_id, { id: r.id, report_date: r.report_date });
        }
      }

      const reportIds = [
        ...Array.from(latestLegacyByMarket.values()).map(r => r.id),
        ...Array.from(latestDisaggByMarket.values()).map(r => r.id),
      ];
      const { data: snaps, error: sErr } = await supabase
        .from("positioning_snapshots")
        .select("report_id,category,long_contracts,short_contracts,net_contracts")
        .in("report_id", reportIds.length ? reportIds : ["00000000-0000-0000-0000-000000000000"]);
      if (sErr) throw sErr;

      const snapKey = (rid: string, cat: string) => `${rid}::${cat}`;
      const snapMap = new Map<string, { net: number }>();
      for (const s of snaps ?? []) {
        snapMap.set(snapKey(s.report_id, s.category), { net: s.net_contracts ?? 0 });
      }

      // Two latest prices per market for WoW change
      const priceByMarket = new Map<string, number[]>();
      for (const p of prices ?? []) {
        const arr = priceByMarket.get(p.market_id) ?? [];
        if (arr.length < 2) arr.push(Number(p.close));
        priceByMarket.set(p.market_id, arr);
      }

      const out: MarketSnapshot[] = markets.map((m, i) => {
        const legacy = latestLegacyByMarket.get(m.id);
        const disagg = latestDisaggByMarket.get(m.id);
        const nc = legacy ? snapMap.get(snapKey(legacy.id, "non_commercial")) : undefined;
        const nr = legacy ? snapMap.get(snapKey(legacy.id, "non_reportable")) : undefined;
        const lev = disagg ? snapMap.get(snapKey(disagg.id, "leveraged_fund")) : undefined;
        const px = priceByMarket.get(m.id) ?? [];
        const last = px[0] ?? 0;
        const prev = px[1] ?? last;
        const wkPct = prev ? ((last - prev) / prev) * 100 : 0;

        // Net Speculators = large (non_commercial) + small (non_reportable)
        const netSpec = (nc?.net ?? 0) + (nr?.net ?? 0);
        const fallbackNet = lev?.net ?? 0;
        const netSpecContracts = netSpec || fallbackNet;

        return {
          symbol: m.symbol,
          name: m.name,
          sector: m.sector as Sector,
          price: last,
          weekChangePct: wkPct,
          largeSpecPercentile: pseudoPercentile(i + 1, 13),
          leveragedFundPercentile: pseudoPercentile(i + 1, 71),
          netSpecContracts,
          netSpecPct3y: pseudoPercentile(i + 1, 211),
          netSpecPct6m: pseudoPercentile(i + 1, 397),
          netContracts: netSpecContracts,
          wowChange: Math.round(netSpecContracts * 0.05),
        };
      });

      const reportDate = reports?.[0]?.report_date ?? null;
      return { markets: out, reportDate };
    },
  });
}
