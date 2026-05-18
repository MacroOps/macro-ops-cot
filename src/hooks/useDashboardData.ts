import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bandOf, type MarketSnapshot, type Sector } from "@/lib/mockData";

// Weights renormalized from 0.40 / 0.25 / 0.20 so score stays in [-100, +100].
const W6M = 0.40 / 0.85;
const W3Y = 0.25 / 0.85;
const WWOW = 0.20 / 0.85;

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function percentileOf(values: number[], target: number) {
  if (!values.length) return 50;
  let below = 0;
  for (const v of values) if (v <= target) below++;
  return Math.round((below / values.length) * 100);
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: async (): Promise<{ markets: MarketSnapshot[]; reportDate: string | null }> => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const cutoff = threeYearsAgo.toISOString().slice(0, 10);

      const { data: markets, error: mErr } = await supabase
        .from("markets").select("id,symbol,name,sector").eq("is_active", true);
      if (mErr) throw mErr;
      if (!markets) return { markets: [], reportDate: null };

      // Paginated fetch of all COT reports in window (10k cap would truncate history per market).
      const reports: { id: string; market_id: string; report_date: string; format: string }[] = [];
      for (let from = 0; from < 200000; from += 1000) {
        const { data, error } = await supabase
          .from("cot_reports")
          .select("id,market_id,report_date,format")
          .gte("report_date", cutoff)
          .order("report_date", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        reports.push(...data as any);
        if (data.length < 1000) break;
      }

      // Paginated price history (most recent ~2 obs per market needed).
      const prices: { market_id: string; observed_on: string; close: number }[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data, error } = await supabase
          .from("price_history").select("market_id,observed_on,close")
          .order("observed_on", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        prices.push(...data as any);
        if (data.length < 1000) break;
        // Stop once we have plenty per market
        if (prices.length > 20000) break;
      }

      const reportIds = reports.map(r => r.id);
      const snapRows: { report_id: string; category: string; net_contracts: number | null }[] = [];
      const CHUNK = 200;
      for (let i = 0; i < reportIds.length; i += CHUNK) {
        const chunk = reportIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("positioning_snapshots")
          .select("report_id,category,net_contracts")
          .in("report_id", chunk);
        if (error) throw error;
        if (data) snapRows.push(...data);
      }

      // report_id -> category -> net
      const snapMap = new Map<string, Map<string, number>>();
      for (const s of snapRows) {
        let m = snapMap.get(s.report_id);
        if (!m) { m = new Map(); snapMap.set(s.report_id, m); }
        m.set(s.category, s.net_contracts ?? 0);
      }

      // Per market: ordered (oldest→newest) net-spec history from legacy reports,
      // lev-fund history from disagg, and TFF asset_manager / leveraged_fund history.
      type Hist = { date: string; netSpec: number | null; netLev: number | null };
      const histByMarket = new Map<string, Hist[]>();
      const tffByMarket = new Map<string, { date: string; netLev: number; netAM: number }[]>();
      const reportsAsc = [...(reports ?? [])].sort((a, b) => a.report_date.localeCompare(b.report_date));
      for (const r of reportsAsc) {
        const cats = snapMap.get(r.id);
        if (!cats) continue;
        if (r.format === "tff") {
          let arr = tffByMarket.get(r.market_id);
          if (!arr) { arr = []; tffByMarket.set(r.market_id, arr); }
          arr.push({
            date: r.report_date,
            netLev: cats.get("leveraged_fund") ?? 0,
            netAM: cats.get("asset_manager") ?? 0,
          });
          continue;
        }
        let arr = histByMarket.get(r.market_id);
        if (!arr) { arr = []; histByMarket.set(r.market_id, arr); }
        if (r.format === "legacy") {
          const nc = cats.get("non_commercial") ?? 0;
          const nr = cats.get("non_reportable") ?? 0;
          const same = arr.find(x => x.date === r.report_date);
          if (same) same.netSpec = nc + nr;
          else arr.push({ date: r.report_date, netSpec: nc + nr, netLev: null });
        } else if (r.format === "disaggregated") {
          const lev = cats.get("leveraged_fund") ?? cats.get("managed_money") ?? 0;
          const same = arr.find(x => x.date === r.report_date);
          if (same) same.netLev = lev;
          else arr.push({ date: r.report_date, netSpec: null, netLev: lev });
        }
      }

      // Two latest prices per market
      const priceByMarket = new Map<string, number[]>();
      for (const p of prices ?? []) {
        const arr = priceByMarket.get(p.market_id) ?? [];
        if (arr.length < 2) arr.push(Number(p.close));
        priceByMarket.set(p.market_id, arr);
      }

      const out: MarketSnapshot[] = markets.map(m => {
        const hist = (histByMarket.get(m.id) ?? []).filter((h): h is { date: string; netSpec: number; netLev: number | null } => h.netSpec != null);
        const specSeries = hist.map(h => h.netSpec);
        const levSeries = hist.map(h => h.netLev).filter((v): v is number => v != null);
        const last = hist[hist.length - 1];
        const netSpecContracts = last?.netSpec ?? 0;
        const netLevContracts = last?.netLev ?? 0;

        const px = priceByMarket.get(m.id) ?? [];
        const lastPx = px[0] ?? 0;
        const prevPx = px[1] ?? lastPx;
        const wkPct = prevPx ? ((lastPx - prevPx) / prevPx) * 100 : 0;

        const last156Spec = specSeries.slice(-156);
        const last26Spec = specSeries.slice(-26);
        const prevSpec = specSeries.length > 1 ? specSeries[specSeries.length - 2] : netSpecContracts;
        const wow = netSpecContracts - prevSpec;

        // Weekly deltas for fever-pitch z-score
        const deltas: number[] = [];
        for (let i = 1; i < specSeries.length; i++) deltas.push(specSeries[i] - specSeries[i - 1]);
        const recentDeltas = deltas.slice(-26);
        const sd = stddev(recentDeltas);
        let wowZ = 0;
        if (sd > 0) wowZ = Math.max(-100, Math.min(100, (wow / sd) * 33.3));

        const netSpecPct3y = percentileOf(last156Spec, netSpecContracts);
        const netSpecPct6m = percentileOf(last26Spec, netSpecContracts);
        const s3y = (netSpecPct3y - 50) * 2;
        const s6m = (netSpecPct6m - 50) * 2;
        const extremityScore = Math.round(W6M * s6m + W3Y * s3y + WWOW * wowZ);
        const extremityBand = bandOf(extremityScore);


        const tff = tffByMarket.get(m.id) ?? [];
        const tff26 = tff.slice(-26);
        const lastTff = tff[tff.length - 1];
        let netLevPct6m: number | null = tff26.length && lastTff
          ? percentileOf(tff26.map(x => x.netLev), lastTff.netLev)
          : null;
        const netAssetMgrPct6m = tff26.length && lastTff
          ? percentileOf(tff26.map(x => x.netAM), lastTff.netAM)
          : null;
        // Fallback for commodities (no TFF report): use managed_money from disaggregated.
        if (netLevPct6m == null && levSeries.length) {
          const lev26 = levSeries.slice(-26);
          netLevPct6m = percentileOf(lev26, netLevContracts);
        }

        return {
          id: m.id,
          symbol: m.symbol,
          name: m.name,
          sector: m.sector as Sector,
          price: lastPx,
          weekChangePct: wkPct,
          largeSpecPercentile: percentileOf(specSeries, netSpecContracts),
          leveragedFundPercentile: percentileOf(levSeries, netLevContracts),
          netSpecContracts,
          netSpecPct3y: percentileOf(last156Spec, netSpecContracts),
          netSpecPct6m: percentileOf(last26Spec, netSpecContracts),
          netLevPct6m,
          netAssetMgrPct6m,
          netContracts: netSpecContracts,
          wowChange: wow,
        };
      });

      const reportDate = reports?.[0]?.report_date ?? null;
      return { markets: out, reportDate };
    },
  });
}
