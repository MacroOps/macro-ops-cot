import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssetSeriesPoint {
  date: string;
  price: number;
  netLargeSpec: number;
  netLevFunds: number;
  netSpec: number;
  largeSpecPct: number;
  levFundPct: number;
  netSpecPct3y: number;
  netSpecPct6m: number;
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

      const [{ data: reports }, { data: prices }, { data: news }] = await Promise.all([
        supabase
          .from("cot_reports")
          .select("id,report_date,format,open_interest")
          .eq("market_id", market.id)
          .order("report_date", { ascending: true })
          .limit(2000),
        supabase
          .from("price_history")
          .select("close,observed_on")
          .eq("market_id", market.id)
          .order("observed_on", { ascending: true })
          .limit(5000),
        supabase
          .from("news_events")
          .select("id,headline,source,url,published_at,expected_direction,observed_return_1d,is_divergence,divergence_note")
          .eq("market_id", market.id)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);

      const reportIds = (reports ?? []).map(r => r.id);
      const snapsRes = reportIds.length
        ? await supabase
            .from("positioning_snapshots")
            .select("report_id,category,net_contracts")
            .in("report_id", reportIds)
        : { data: [] as { report_id: string; category: string; net_contracts: number | null }[] };
      const snapMap = new Map<string, Map<string, number>>();
      for (const s of (snapsRes.data ?? [])) {
        let m = snapMap.get(s.report_id);
        if (!m) { m = new Map(); snapMap.set(s.report_id, m); }
        m.set(s.category, s.net_contracts ?? 0);
      }

      // Build per-date map: legacy + disagg merged
      const byDate = new Map<string, { netLarge: number; netSmall: number; netLev: number; oi: number }>();
      for (const r of reports ?? []) {
        const cats = snapMap.get(r.id);
        if (!cats) continue;
        const e = byDate.get(r.report_date) ?? { netLarge: 0, netSmall: 0, netLev: 0, oi: 0 };
        if (r.format === "legacy") {
          e.netLarge = cats.get("non_commercial") ?? 0;
          e.netSmall = cats.get("non_reportable") ?? 0;
        } else if (r.format === "disaggregated") {
          e.netLev = cats.get("leveraged_fund") ?? cats.get("managed_money") ?? 0;
        }
        e.oi = Math.max(e.oi, r.open_interest ?? 0);
        byDate.set(r.report_date, e);
      }

      const cotDates = Array.from(byDate.keys()).sort();
      const priceByDate = new Map<string, number>();
      for (const p of prices ?? []) priceByDate.set(p.observed_on, Number(p.close));

      // For each COT date, find the closest available price on or before that date.
      const priceDatesSorted = (prices ?? []).map(p => p.observed_on);
      function priceOn(date: string): number {
        if (priceByDate.has(date)) return priceByDate.get(date)!;
        // binary-ish search backward
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
      for (const d of cotDates) {
        const e = byDate.get(d)!;
        netLargeArr.push(e.netLarge);
        netSpecArr.push(e.netLarge + e.netSmall);
        netLevArr.push(e.netLev);
      }

      const largePct = percentileWindow(netLargeArr, 156);
      const levPct = percentileWindow(netLevArr, 156);
      const spec3y = percentileWindow(netSpecArr, 156);
      const spec6m = percentileWindow(netSpecArr, 26);

      const series: AssetSeriesPoint[] = cotDates.map((d, i) => {
        const e = byDate.get(d)!;
        return {
          date: d,
          price: priceOn(d),
          netLargeSpec: e.netLarge,
          netLevFunds: e.netLev,
          netSpec: e.netLarge + e.netSmall,
          largeSpecPct: largePct[i],
          levFundPct: levPct[i],
          netSpecPct3y: spec3y[i],
          netSpecPct6m: spec6m[i],
          openInterest: e.oi,
        };
      });

      const lastReportDate = cotDates.length ? cotDates[cotDates.length - 1] : null;

      return {
        symbol: market.symbol,
        name: market.name,
        sector: market.sector,
        exchange: market.exchange,
        series,
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
