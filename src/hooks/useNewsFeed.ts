import { useQuery } from "@tanstack/react-query";
import { useDashboardData } from "./useDashboardData";
import type { MarketSnapshot, Sector } from "@/lib/mockData";

export type DivergenceKind = "bull-news-down" | "bear-news-up" | "aligned" | "neutral";
export type Severity = "high" | "medium" | "low";

export interface NewsItem {
  id: string;
  symbol: string;
  name: string;
  sector: Sector;
  headline: string;
  source: string;
  publishedAt: string;     // ISO
  expectedDirection: 1 | -1 | 0;   // sentiment of the news
  observedReturn1d: number;        // % move that day
  netSpecPct3y: number;            // current crowding context
  divergence: DivergenceKind;
  severity: Severity;
}

const HEADLINES: Record<string, Array<{ h: string; src: string; dir: 1 | -1 | 0 }>> = {
  ES:  [{ h: "Fed minutes signal patient stance; soft-landing odds firm", src: "Reuters", dir: 1 },
        { h: "S&P breadth narrows as megacaps drive index higher", src: "Bloomberg", dir: -1 }],
  NQ:  [{ h: "AI capex guidance lifts hyperscaler outlook", src: "WSJ", dir: 1 },
        { h: "Semis warn on inventory normalization into Q1", src: "FT", dir: -1 }],
  RTY: [{ h: "Small-cap earnings revisions turn negative", src: "Bloomberg", dir: -1 }],
  YM:  [{ h: "Industrials beat on order backlog", src: "Reuters", dir: 1 }],
  ZN:  [{ h: "Treasury auction tails; demand softens at long end", src: "Bloomberg", dir: -1 },
        { h: "Cooler CPI revives duration bid", src: "Reuters", dir: 1 }],
  ZB:  [{ h: "30Y supply digested smoothly; indirects strong", src: "WSJ", dir: 1 }],
  ZF:  [{ h: "Fed pricing shifts dovish on labor data", src: "FT", dir: 1 }],
  "6E":[{ h: "ECB officials push back on early cuts", src: "Reuters", dir: 1 },
        { h: "Eurozone PMI slips back below 50", src: "Bloomberg", dir: -1 }],
  "6J":[{ h: "BoJ signals readiness to act on yen weakness", src: "Nikkei", dir: 1 }],
  "6B":[{ h: "UK services inflation sticky; BoE patient", src: "FT", dir: 1 }],
  DXY: [{ h: "Dollar firms on safe-haven bid", src: "Bloomberg", dir: 1 }],
  CL:  [{ h: "OPEC+ extends voluntary cuts through Q2", src: "Reuters", dir: 1 },
        { h: "US crude inventories build sharply", src: "EIA", dir: -1 }],
  NG:  [{ h: "Cold snap forecast lifts heating demand", src: "Bloomberg", dir: 1 }],
  RB:  [{ h: "Refinery utilization climbs into driving season", src: "Platts", dir: 1 }],
  GC:  [{ h: "Central-bank gold buying hits record pace", src: "WGC", dir: 1 },
        { h: "Real yields back up as ETF outflows persist", src: "Bloomberg", dir: -1 }],
  SI:  [{ h: "Industrial silver demand outlook upgraded", src: "Reuters", dir: 1 }],
  HG:  [{ h: "China property stimulus disappoints traders", src: "Bloomberg", dir: -1 }],
  ZC:  [{ h: "USDA raises corn yield estimate", src: "USDA", dir: -1 }],
  ZS:  [{ h: "Brazil soy harvest accelerates ahead of pace", src: "Reuters", dir: -1 }],
  ZW:  [{ h: "Black Sea export corridor disruption resurfaces", src: "Bloomberg", dir: 1 }],
  BTC: [{ h: "Spot ETF inflows top $1B in single session", src: "CoinDesk", dir: 1 },
        { h: "Long-term holders distributing, on-chain data shows", src: "Glassnode", dir: -1 }],
  ETH: [{ h: "Layer-2 throughput hits new high post-upgrade", src: "The Block", dir: 1 }],
};

function classify(dir: number, ret: number): { div: DivergenceKind; sev: Severity } {
  if (Math.abs(ret) < 0.15 || dir === 0) return { div: "neutral", sev: "low" };
  const aligned = Math.sign(ret) === Math.sign(dir);
  if (aligned) return { div: "aligned", sev: "low" };
  const mag = Math.abs(ret);
  const sev: Severity = mag > 1.5 ? "high" : mag > 0.6 ? "medium" : "low";
  return { div: dir > 0 ? "bull-news-down" : "bear-news-up", sev };
}

function buildFeed(markets: MarketSnapshot[]): NewsItem[] {
  const out: NewsItem[] = [];
  const now = Date.now();
  let i = 0;
  for (const m of markets) {
    const set = HEADLINES[m.symbol];
    if (!set) continue;
    for (const item of set) {
      i++;
      // Synthesize a daily return: jitter around weekly w/ deterministic seed
      const seed = (m.symbol.charCodeAt(0) + i * 13) % 100;
      const jitter = ((Math.sin(seed) + 1) / 2) * 1.6 - 0.8;
      const ret = +(m.weekChangePct / 5 + jitter).toFixed(2);
      const { div, sev } = classify(item.dir, ret);
      out.push({
        id: `${m.symbol}-${i}`,
        symbol: m.symbol,
        name: m.name,
        sector: m.sector,
        headline: item.h,
        source: item.src,
        publishedAt: new Date(now - i * 3 * 3600 * 1000).toISOString(),
        expectedDirection: item.dir,
        observedReturn1d: ret,
        netSpecPct3y: m.netSpecPct3y,
        divergence: div,
        severity: sev,
      });
    }
  }
  return out.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

export function useNewsFeed() {
  const { data: dash } = useDashboardData();
  const markets = dash?.markets ?? [];
  return useQuery({
    queryKey: ["news-feed", markets.length],
    enabled: markets.length > 0,
    queryFn: async () => buildFeed(markets),
  });
}
