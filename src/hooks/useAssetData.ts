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
  netManagedMoney: number;
  netSpec: number;
  largeSpecPct: number;
  largeSpecPct6m: number;
  smallSpecPct: number;
  smallSpecPct6m: number;
  levFundPct: number;
  levFundPct6m: number;
  assetMgrPct: number;
  assetMgrPct6m: number;
  mmPct: number;
  mmPct6m: number;
  netSpecPct3y: number;
  netSpecPct6m: number;
  extremityScore: number;
  openInterest: number;
  hasLev: boolean;
  hasAssetMgr: boolean;
  hasMm: boolean;
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AssetData | null> => {
      const { data: market, error: mErr } = await supabase
        .from("markets")
        .select("id,symbol,name,sector,exchange")
        .eq("symbol", symbol)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!market) return null;

      const [cotRes, priceRes, newsRes] = await Promise.all([
        supabase.rpc("get_asset_cot_series", { p_market_id: market.id }),
        supabase.rpc("get_asset_price_series", { p_market_id: market.id }),
        supabase
          .from("news_events")
          .select("id,headline,source,url,published_at,expected_direction,observed_return_1d,is_divergence,divergence_note")
          .eq("market_id", market.id)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);
      if (cotRes.error) throw cotRes.error;
      if (priceRes.error) throw priceRes.error;

      type CotRow = { d: string; oi: number; nl: number; ns: number; nc: number; nlv: number; nmm: number; nam: number; hl: boolean; hlv: boolean; hmm: boolean; ham: boolean };
      type PriceRow = { d: string; c: number | string };
      const cotRows = ((cotRes.data ?? []) as CotRow[]);
      const priceRows = ((priceRes.data ?? []) as PriceRow[]);
      const news = newsRes.data;

      const priceByDate = new Map<string, number>();
      const priceDatesSorted: string[] = [];
      const priceCloses: number[] = [];
      for (const p of priceRows) {
        const c = Number(p.c);
        priceByDate.set(p.d, c);
        priceDatesSorted.push(p.d);
        priceCloses.push(c);
      }
      function priceOn(date: string): number {
        const v = priceByDate.get(date);
        if (v != null) return v;
        let lo = 0, hi = priceDatesSorted.length - 1, best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (priceDatesSorted[mid] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        return priceCloses.length ? priceCloses[best] : 0;
      }

      const netLargeArr = cotRows.map(r => r.nl);
      const netSmallArr = cotRows.map(r => r.ns);
      const netSpecArr = cotRows.map(r => r.nl + r.ns);
      const netLevArr = cotRows.map(r => r.nlv);
      const netAssetMgrArr = cotRows.map(r => r.nam);

      const largePct = percentileWindow(netLargeArr, 156);
      const largePct6m = percentileWindow(netLargeArr, 26);
      const smallPct = percentileWindow(netSmallArr, 156);
      const smallPct6m = percentileWindow(netSmallArr, 26);
      const levPct = percentileWindow(netLevArr, 156);
      const levPct6m = percentileWindow(netLevArr, 26);
      const assetMgrPct = percentileWindow(netAssetMgrArr, 156);
      const assetMgrPct6m = percentileWindow(netAssetMgrArr, 26);
      const spec3y = percentileWindow(netSpecArr, 156);
      const spec6m = percentileWindow(netSpecArr, 26);

      // Rolling extremity score: blended 6M %ile, 3Y %ile, and WoW z-score (matches dashboard).
      const W6M = 0.40 / 0.85;
      const W3Y = 0.25 / 0.85;
      const WWOW = 0.20 / 0.85;
      const deltas: number[] = new Array(netSpecArr.length).fill(0);
      for (let i = 1; i < netSpecArr.length; i++) deltas[i] = netSpecArr[i] - netSpecArr[i - 1];
      const extremityArr: number[] = new Array(netSpecArr.length).fill(0);
      for (let i = 0; i < netSpecArr.length; i++) {
        const start = Math.max(1, i - 25);
        const win = deltas.slice(start, i + 1);
        let mean = 0;
        for (const x of win) mean += x;
        mean /= Math.max(1, win.length);
        let v = 0;
        for (const x of win) v += (x - mean) ** 2;
        const sd = win.length > 1 ? Math.sqrt(v / win.length) : 0;
        const wowZ = sd > 0 ? Math.max(-100, Math.min(100, (deltas[i] / sd) * 33.3)) : 0;
        const s3y = (spec3y[i] - 50) * 2;
        const s6m = (spec6m[i] - 50) * 2;
        extremityArr[i] = Math.round(W6M * s6m + W3Y * s3y + WWOW * wowZ);
      }

      const series: AssetSeriesPoint[] = cotRows.map((r, i) => ({
        date: r.d,
        price: priceOn(r.d),
        netLargeSpec: r.nl,
        netSmallSpec: r.ns,
        netCommercial: r.nc,
        netLevFunds: r.nlv,
        netAssetMgr: r.nam,
        netSpec: r.nl + r.ns,
        largeSpecPct: largePct[i],
        largeSpecPct6m: largePct6m[i],
        smallSpecPct: smallPct[i],
        smallSpecPct6m: smallPct6m[i],
        levFundPct: levPct[i],
        levFundPct6m: levPct6m[i],
        assetMgrPct: assetMgrPct[i],
        assetMgrPct6m: assetMgrPct6m[i],
        netSpecPct3y: spec3y[i],
        netSpecPct6m: spec6m[i],
        extremityScore: extremityArr[i],
        openInterest: r.oi,
        hasLev: r.hlv,
        hasAssetMgr: r.ham,
      }));

      const lastReportDate = series.length ? series[series.length - 1].date : null;
      const priceSeries: PricePoint[] = priceRows.map(p => ({ date: p.d, price: Number(p.c) }));

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
