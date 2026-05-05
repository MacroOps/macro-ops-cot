import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardData } from "./useDashboardData";
import type { Sector } from "@/lib/mockData";

export type DivergenceKind = "bull-news-down" | "bear-news-up" | "aligned" | "neutral";
export type Severity = "high" | "medium" | "low";

export interface NewsItem {
  id: string;
  symbol: string;
  name: string;
  sector: Sector;
  headline: string;
  source: string;
  url: string | null;
  publishedAt: string;
  expectedDirection: 1 | -1 | 0;
  observedReturn1d: number;
  netSpecPct3y: number;
  divergence: DivergenceKind;
  severity: Severity;
}

function classify(dir: number, ret: number): { div: DivergenceKind; sev: Severity } {
  if (Math.abs(ret) < 0.15 || dir === 0) return { div: "neutral", sev: "low" };
  const aligned = Math.sign(ret) === Math.sign(dir);
  if (aligned) return { div: "aligned", sev: "low" };
  const mag = Math.abs(ret);
  const sev: Severity = mag > 1.5 ? "high" : mag > 0.6 ? "medium" : "low";
  return { div: dir > 0 ? "bull-news-down" : "bear-news-up", sev };
}

export function useNewsFeed() {
  const { data: dash } = useDashboardData();
  const markets = dash?.markets ?? [];

  return useQuery({
    queryKey: ["news-feed-db", markets.length],
    enabled: markets.length > 0,
    queryFn: async (): Promise<NewsItem[]> => {
      const { data: marketRows } = await supabase
        .from("markets").select("id,symbol,name,sector").eq("is_active", true);
      const mById = new Map((marketRows ?? []).map(m => [m.id, m]));

      const { data: rows, error } = await supabase
        .from("news_events")
        .select("id,market_id,headline,source,url,published_at,expected_direction,observed_return_1d,is_divergence")
        .order("published_at", { ascending: false })
        .limit(300);
      if (error) throw error;

      const pctBySymbol = new Map(markets.map(m => [m.symbol, m.netSpecPct3y]));

      const out: NewsItem[] = [];
      for (const r of rows ?? []) {
        const m = r.market_id ? mById.get(r.market_id) : null;
        if (!m) continue;
        const dir = (r.expected_direction ?? 0) as 1 | -1 | 0;
        const ret = Number(r.observed_return_1d ?? 0);
        const { div, sev } = classify(dir, ret);
        out.push({
          id: r.id,
          symbol: m.symbol,
          name: m.name,
          sector: m.sector as Sector,
          headline: r.headline,
          source: r.source ?? "—",
          url: r.url,
          publishedAt: r.published_at,
          expectedDirection: dir,
          observedReturn1d: ret,
          netSpecPct3y: pctBySymbol.get(m.symbol) ?? 50,
          divergence: div,
          severity: sev,
        });
      }
      return out;
    },
  });
}
