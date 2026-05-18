import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssetSeriesPoint {
  date: string;
  price: number;
  netLargeSpec: number;
  netSmallSpec: number;
  netCommercial: number;
  netLevFunds: number;
  netAssetMgr: number;
  netSpec: number;
  largeSpecPct: number;
  levFundPct: number;
  levFundPct6m: number;
  assetMgrPct: number;
  assetMgrPct6m: number;
  netSpecPct3y: number;
  netSpecPct6m: number;
  openInterest: number;
  hasLev: boolean;
  hasAssetMgr: boolean;
}

export interface AssetNewsItem {
  id: string;
  headline: string;
  source: string | null;
  url: string | null;
  published_at: string;
  expected_direction: number | null;
  observed_return_1d: number | null;
  is_divergence: boolean;
  divergence_note: string | null;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface AssetData {
  symbol: string;
  name: string;
  sector: string;
  exchange: string | null;
  series: AssetSeriesPoint[];
  priceSeries: PricePoint[];
  news: AssetNewsItem[];
  lastReportDate: string | null;
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

export function useAssetData(symbol: string) {
  return useQuery({
    queryKey: ["asset-data", symbol],
    queryFn: async (): Promise<AssetData | null> => {
      const { data: market, error: mErr } = await supabase
        .from("markets")
        .select("id,symbol,name,sector,exchange")
        .eq("symbol", symbol)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!market) return null;

      const [{ data: reports }, pricesAll, { data: news }] = await Promise.all([
        supabase
          .from("cot_reports")
          .select("id,report_date,format,open_interest")
          .eq("market_id", market.id)
          .order("report_date", { ascending: true })
          .limit(8000),
        (async () => {
          // Supabase caps responses at 1000 rows; paginate to get full price history.
          const PAGE = 1000;
          const out: { close: number; observed_on: string }[] = [];
          for (let from = 0; from < 20000; from += PAGE) {
            const { data, error } = await supabase
              .from("price_history")
              .select("close,observed_on")
              .eq("market_id", market.id)
              .order("observed_on", { ascending: true })
              .range(from, from + PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            out.push(...data.map(p => ({ close: Number(p.close), observed_on: p.observed_on })));
            if (data.length < PAGE) break;
          }
          return out;
        })(),
        supabase
          .from("news_events")
          .select("id,headline,source,url,published_at,expected_direction,observed_return_1d,is_divergence,divergence_note")
          .eq("market_id", market.id)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);
      const prices = pricesAll;

      const reportIds = (reports ?? []).map(r => r.id);
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
      const snapMap = new Map<string, Map<string, number>>();
      for (const s of snapRows) {
        let m = snapMap.get(s.report_id);
        if (!m) { m = new Map(); snapMap.set(s.report_id, m); }
        m.set(s.category, s.net_contracts ?? 0);
      }

      // Build per-date map: legacy + disagg + tff merged
      const byDate = new Map<string, { netLarge: number; netSmall: number; netCommercial: number; netLev: number; netAssetMgr: number; oi: number; hasLegacy: boolean; hasLev: boolean; hasAssetMgr: boolean }>();
      for (const r of reports ?? []) {
        const cats = snapMap.get(r.id);
        if (!cats) continue;
        const e = byDate.get(r.report_date) ?? { netLarge: 0, netSmall: 0, netCommercial: 0, netLev: 0, netAssetMgr: 0, oi: 0, hasLegacy: false, hasLev: false, hasAssetMgr: false };
        if (r.format === "legacy") {
          e.netLarge = cats.get("non_commercial") ?? 0;
          e.netSmall = cats.get("non_reportable") ?? 0;
          e.netCommercial = cats.get("commercial") ?? 0;
          e.hasLegacy = true;
        } else if (r.format === "disaggregated") {
          const mm = cats.get("managed_money");
          if (mm != null && !e.hasLev) {
            e.netLev = mm;
            e.hasLev = true;
          }
        } else if (r.format === "tff") {
          const lev = cats.get("leveraged_fund");
          if (lev != null) {
            e.netLev = lev;
            e.hasLev = true;
          }
          const am = cats.get("asset_manager");
          if (am != null) {
            e.netAssetMgr = am;
            e.hasAssetMgr = true;
          }
        }
        e.oi = Math.max(e.oi, r.open_interest ?? 0);
        byDate.set(r.report_date, e);
      }

      const cotDates = Array.from(byDate.entries())
        .filter(([, e]) => e.hasLegacy)
        .map(([date]) => date)
        .sort();
      const priceByDate = new Map<string, number>();
      for (const p of prices ?? []) priceByDate.set(p.observed_on, Number(p.close));

      const priceDatesSorted = (prices ?? []).map(p => p.observed_on);
      function priceOn(date: string): number {
        if (priceByDate.has(date)) return priceByDate.get(date)!;
        let lo = 0, hi = priceDatesSorted.length - 1, best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (priceDatesSorted[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return priceDatesSorted.length ? Number((prices ?? [])[best].close) : 0;
      }

      const netLargeArr: number[] = [];
      const netSpecArr: number[] = [];
      const netLevArr: number[] = [];
      const netAssetMgrArr: number[] = [];
      for (const d of cotDates) {
        const e = byDate.get(d)!;
        netLargeArr.push(e.netLarge);
        netSpecArr.push(e.netLarge + e.netSmall);
        netLevArr.push(e.netLev);
        netAssetMgrArr.push(e.netAssetMgr);
      }

      const largePct = percentileWindow(netLargeArr, 156);
      const levPct = percentileWindow(netLevArr, 156);
      const levPct6m = percentileWindow(netLevArr, 26);
      const assetMgrPct = percentileWindow(netAssetMgrArr, 156);
      const assetMgrPct6m = percentileWindow(netAssetMgrArr, 26);
      const spec3y = percentileWindow(netSpecArr, 156);
      const spec6m = percentileWindow(netSpecArr, 26);

      const series: AssetSeriesPoint[] = cotDates.map((d, i) => {
        const e = byDate.get(d)!;
        return {
          date: d,
          price: priceOn(d),
          netLargeSpec: e.netLarge,
          netSmallSpec: e.netSmall,
          netCommercial: e.netCommercial,
          netLevFunds: e.netLev,
          netAssetMgr: e.netAssetMgr,
          netSpec: e.netLarge + e.netSmall,
          largeSpecPct: largePct[i],
          levFundPct: levPct[i],
          levFundPct6m: levPct6m[i],
          assetMgrPct: assetMgrPct[i],
          assetMgrPct6m: assetMgrPct6m[i],
          netSpecPct3y: spec3y[i],
          netSpecPct6m: spec6m[i],
          openInterest: e.oi,
          hasLev: e.hasLev,
          hasAssetMgr: e.hasAssetMgr,
        };
      });

      const lastReportDate = cotDates.length ? cotDates[cotDates.length - 1] : null;

      const priceSeries: PricePoint[] = (prices ?? []).map(p => ({ date: p.observed_on, price: Number(p.close) }));

      return {
        symbol: market.symbol,
        name: market.name,
        sector: market.sector,
        exchange: market.exchange,
        series,
        priceSeries,
        news: (news ?? []) as AssetNewsItem[],
        lastReportDate,
      };
    },
    enabled: !!symbol,
  });
}

export function computeForwardPerformance(
  series: AssetSeriesPoint[],
  horizonsWeeks = [1, 4, 12, 26],
  windowKey: "netSpecPct3y" | "netSpecPct6m" = "netSpecPct3y",
) {
  if (series.length < 30) return [];
  const current = series[series.length - 1];
  const cur = current[windowKey];
  const bucketLo = Math.max(0, cur - 10);
  const bucketHi = Math.min(100, cur + 10);

  return horizonsWeeks.map(h => {
    const samples: number[] = [];
    for (let i = 0; i < series.length - h - 1; i++) {
      const p = series[i][windowKey];
      if (p >= bucketLo && p <= bucketHi) {
        const r = (series[i + h].price - series[i].price) / series[i].price;
        if (Number.isFinite(r)) samples.push(r);
      }
    }
    if (!samples.length) return { horizon: h, mean: 0, hitRate: 0, count: 0 };
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const hits = samples.filter(r => r > 0).length;
    return {
      horizon: h,
      mean: mean * 100,
      hitRate: (hits / samples.length) * 100,
      count: samples.length,
    };
  });
}
