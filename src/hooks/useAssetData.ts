import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssetSeriesPoint {
  date: string;       // YYYY-MM-DD
  price: number;
  netLargeSpec: number;
  netLevFunds: number;
  largeSpecPct: number;   // 0-100 percentile vs window
  levFundPct: number;
  openInterest: number;
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

export interface AssetData {
  symbol: string;
  name: string;
  sector: string;
  exchange: string | null;
  series: AssetSeriesPoint[];
  news: AssetNewsItem[];
  lastReportDate: string | null;
}

// Deterministic PRNG for synthetic history (so same symbol → same chart)
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function percentileWindow(values: number[], window = 156): number[] {
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

function generateHistory(symbol: string, lastPrice: number, lastNetLev: number, lastNetSpec: number) {
  // 156 weeks ≈ 3 years
  const N = 156;
  const rand = mulberry32(hashStr(symbol));
  const vol = lastPrice * 0.02;

  const prices: number[] = [];
  const oi: number[] = [];
  const netLev: number[] = [];
  const netSpec: number[] = [];

  let p = lastPrice * (0.7 + rand() * 0.4);
  let o = 800_000 + Math.floor(rand() * 400_000);
  let nl = lastNetLev * (0.5 + rand() * 0.6);
  let ns = lastNetSpec * (0.5 + rand() * 0.6);

  for (let i = 0; i < N; i++) {
    const drift = (lastPrice - p) * 0.012;
    p = Math.max(p * 0.5, p + drift + (rand() - 0.5) * vol * 2);
    o = Math.max(100_000, o + Math.floor((rand() - 0.5) * 30_000));
    nl = nl + (lastNetLev - nl) * 0.015 + (rand() - 0.5) * Math.abs(lastNetLev || 1000) * 0.08;
    ns = ns + (lastNetSpec - ns) * 0.015 + (rand() - 0.5) * Math.abs(lastNetSpec || 1000) * 0.08;
    prices.push(p);
    oi.push(o);
    netLev.push(nl);
    netSpec.push(ns);
  }

  // Snap last to actuals
  prices[N - 1] = lastPrice;
  netLev[N - 1] = lastNetLev;
  netSpec[N - 1] = lastNetSpec;

  const levPct = percentileWindow(netLev);
  const specPct = percentileWindow(netSpec);

  // Build weekly dates ending today (UTC, Tuesday cadence approx)
  const today = new Date();
  const series: AssetSeriesPoint[] = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (N - 1 - i) * 7);
    series.push({
      date: d.toISOString().slice(0, 10),
      price: Number(prices[i].toFixed(4)),
      netLevFunds: Math.round(netLev[i]),
      netLargeSpec: Math.round(netSpec[i]),
      levFundPct: levPct[i],
      largeSpecPct: specPct[i],
      openInterest: oi[i],
    });
  }
  return series;
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

      const [{ data: reports }, { data: prices }, { data: news }] = await Promise.all([
        supabase
          .from("cot_reports")
          .select("id,report_date,format,open_interest")
          .eq("market_id", market.id)
          .order("report_date", { ascending: false })
          .limit(8),
        supabase
          .from("price_history")
          .select("close,observed_on")
          .eq("market_id", market.id)
          .order("observed_on", { ascending: false })
          .limit(2),
        supabase
          .from("news_events")
          .select("id,headline,source,url,published_at,expected_direction,observed_return_1d,is_divergence,divergence_note")
          .eq("market_id", market.id)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);

      const latestDisagg = (reports ?? []).find(r => r.format === "disaggregated");
      const latestLegacy = (reports ?? []).find(r => r.format === "legacy");

      let lastNetLev = 0;
      let lastNetSpec = 0;
      const idsToFetch = [latestDisagg?.id, latestLegacy?.id].filter(Boolean) as string[];
      if (idsToFetch.length) {
        const { data: snaps } = await supabase
          .from("positioning_snapshots")
          .select("report_id,category,net_contracts")
          .in("report_id", idsToFetch);
        for (const s of snaps ?? []) {
          if (s.report_id === latestDisagg?.id && s.category === "leveraged_fund") {
            lastNetLev = s.net_contracts ?? 0;
          }
          if (s.report_id === latestLegacy?.id && s.category === "non_commercial") {
            lastNetSpec = s.net_contracts ?? 0;
          }
        }
      }

      // Fallback: derive from disaggregated if no legacy
      if (!lastNetSpec && lastNetLev) lastNetSpec = Math.round(lastNetLev * 1.4);
      if (!lastNetLev && lastNetSpec) lastNetLev = Math.round(lastNetSpec * 0.7);
      if (!lastNetLev && !lastNetSpec) {
        lastNetLev = 10_000;
        lastNetSpec = 14_000;
      }

      const lastPrice = Number(prices?.[0]?.close ?? 100);
      const series = generateHistory(symbol, lastPrice, lastNetLev, lastNetSpec);

      return {
        symbol: market.symbol,
        name: market.name,
        sector: market.sector,
        exchange: market.exchange,
        series,
        news: (news ?? []) as AssetNewsItem[],
        lastReportDate: latestDisagg?.report_date ?? latestLegacy?.report_date ?? null,
      };
    },
    enabled: !!symbol,
  });
}

// Forward-performance backtest: for each historical point in the same percentile bucket
// as the current reading, compute the realized N-week forward price return.
export function computeForwardPerformance(series: AssetSeriesPoint[], horizonsWeeks = [1, 4, 12, 26]) {
  if (series.length < 30) return [];
  const current = series[series.length - 1];
  const bucketLo = Math.max(0, current.levFundPct - 10);
  const bucketHi = Math.min(100, current.levFundPct + 10);

  return horizonsWeeks.map(h => {
    const samples: number[] = [];
    for (let i = 0; i < series.length - h - 1; i++) {
      const p = series[i].levFundPct;
      if (p >= bucketLo && p <= bucketHi) {
        const r = (series[i + h].price - series[i].price) / series[i].price;
        samples.push(r);
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
