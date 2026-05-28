import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bandOf, type MarketSnapshot, type Sector } from "@/lib/mockData";

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

type MarketRow = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  specSeries: number[];
  levSeries: number[];
  tffSeries: { l: number; a: number }[];
  px: number[];
};

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ markets: MarketSnapshot[]; reportDate: string | null }> => {
      const { data, error } = await supabase.rpc("get_dashboard_payload");
      if (error) throw error;
      const payload = (data ?? { markets: [], reportDate: null }) as {
        reportDate: string | null;
        markets: MarketRow[];
      };

      const out: MarketSnapshot[] = payload.markets.map(m => {
        const specSeries = m.specSeries ?? [];
        const levSeries = m.levSeries ?? [];
        const tff = m.tffSeries ?? [];
        const px = m.px ?? [];

        const netSpecContracts = specSeries.length ? specSeries[specSeries.length - 1] : 0;
        const netLevContracts = levSeries.length ? levSeries[levSeries.length - 1] : 0;

        const lastPx = px[0] ?? 0;
        const prevPx = px[1] ?? lastPx;
        const wkPct = prevPx ? ((lastPx - prevPx) / prevPx) * 100 : 0;

        const last156Spec = specSeries.slice(-156);
        const last26Spec = specSeries.slice(-26);
        const prevSpec = specSeries.length > 1 ? specSeries[specSeries.length - 2] : netSpecContracts;
        const wow = netSpecContracts - prevSpec;

        const deltas: number[] = [];
        for (let i = 1; i < specSeries.length; i++) deltas.push(specSeries[i] - specSeries[i - 1]);
        const sd = stddev(deltas.slice(-26));
        let wowZ = 0;
        if (sd > 0) wowZ = Math.max(-100, Math.min(100, (wow / sd) * 33.3));

        const netSpecPct3y = percentileOf(last156Spec, netSpecContracts);
        const netSpecPct6m = percentileOf(last26Spec, netSpecContracts);
        const s3y = (netSpecPct3y - 50) * 2;
        const s6m = (netSpecPct6m - 50) * 2;
        const extremityScore = Math.round(W6M * s6m + W3Y * s3y + WWOW * wowZ);
        const extremityBand = bandOf(extremityScore);

        const tff26 = tff.slice(-26);
        const lastTff = tff[tff.length - 1];
        let netLevPct6m: number | null = tff26.length && lastTff
          ? percentileOf(tff26.map(x => x.l), lastTff.l)
          : null;
        const netAssetMgrPct6m = tff26.length && lastTff
          ? percentileOf(tff26.map(x => x.a), lastTff.a)
          : null;
        if (netLevPct6m == null && levSeries.length) {
          netLevPct6m = percentileOf(levSeries.slice(-26), netLevContracts);
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
          netSpecPct3y,
          netSpecPct6m,
          netLevPct6m,
          netAssetMgrPct6m,
          netContracts: netSpecContracts,
          wowChange: wow,
          extremityScore,
          extremityBand,
        };
      });

      return { markets: out, reportDate: payload.reportDate };
    },
  });
}
