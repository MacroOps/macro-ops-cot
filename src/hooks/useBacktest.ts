import type { AssetSeriesPoint } from "./useAssetData";

export type BtDirection = "long" | "short";
export type BtWindow = "netSpecPct3y" | "netSpecPct6m";

export interface BtParams {
  direction: BtDirection;
  threshold: number;          // 0-100
  horizonWeeks: number;       // 1..52
  windowKey: BtWindow;
}

export interface BtTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  entryPct: number;
  returnPct: number;          // signed for direction (long: + when price up; short: + when price down)
  rawReturnPct: number;       // raw price return regardless of direction
}

export interface BtResult {
  trades: BtTrade[];
  count: number;
  hitRate: number;            // 0..100
  meanReturn: number;         // %
  medianReturn: number;       // %
  bestReturn: number;
  worstReturn: number;
  totalReturn: number;        // % cumulative compounded over all trades
  equityCurve: { date: string; equity: number }[];
  histogram: { bucket: string; count: number; lo: number; hi: number }[];
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function runBacktest(series: AssetSeriesPoint[], p: BtParams): BtResult {
  const trades: BtTrade[] = [];
  if (series.length < p.horizonWeeks + 2) {
    return {
      trades: [], count: 0, hitRate: 0, meanReturn: 0, medianReturn: 0,
      bestReturn: 0, worstReturn: 0, totalReturn: 0, equityCurve: [], histogram: [],
    };
  }

  let i = 0;
  while (i < series.length - p.horizonWeeks - 1) {
    const v = series[i][p.windowKey];
    const triggered =
      p.direction === "long" ? v >= p.threshold : v <= p.threshold;

    if (triggered) {
      const entry = series[i];
      const exit = series[i + p.horizonWeeks];
      const raw = (exit.price - entry.price) / entry.price;
      const ret = p.direction === "long" ? raw : -raw;
      trades.push({
        entryDate: entry.date,
        exitDate: exit.date,
        entryPrice: entry.price,
        exitPrice: exit.price,
        entryPct: v,
        returnPct: ret * 100,
        rawReturnPct: raw * 100,
      });
      i += p.horizonWeeks; // non-overlapping
    } else {
      i += 1;
    }
  }

  const returns = trades.map(t => t.returnPct);
  const hits = returns.filter(r => r > 0).length;
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

  // Compounded equity curve
  let equity = 100;
  const equityCurve: { date: string; equity: number }[] = [{ date: trades[0]?.entryDate ?? "", equity }];
  for (const t of trades) {
    equity = equity * (1 + t.returnPct / 100);
    equityCurve.push({ date: t.exitDate, equity: Number(equity.toFixed(2)) });
  }

  // Histogram (10 buckets across return range, padded)
  const min = returns.length ? Math.min(...returns) : 0;
  const max = returns.length ? Math.max(...returns) : 0;
  const span = Math.max(1, max - min);
  const buckets = 10;
  const histogram = Array.from({ length: buckets }, (_, b) => {
    const lo = min + (span * b) / buckets;
    const hi = min + (span * (b + 1)) / buckets;
    const count = returns.filter(r => r >= lo && (b === buckets - 1 ? r <= hi : r < hi)).length;
    return { bucket: `${lo.toFixed(1)}–${hi.toFixed(1)}`, count, lo, hi };
  });

  return {
    trades,
    count: trades.length,
    hitRate: returns.length ? (hits / returns.length) * 100 : 0,
    meanReturn: mean,
    medianReturn: median(returns),
    bestReturn: returns.length ? Math.max(...returns) : 0,
    worstReturn: returns.length ? Math.min(...returns) : 0,
    totalReturn: equity - 100,
    equityCurve,
    histogram,
  };
}
