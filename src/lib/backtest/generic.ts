// Indicator-agnostic backtest engine. Takes a series of {t, v, price}
// and runs the same cohort / baseline / spaghetti analysis as useBacktest,
// but for ANY indicator (not just CoT positioning).

export type GenericCondition = "gte" | "lte";

export interface GenericBtParams {
  condition: GenericCondition;
  threshold: number;
  horizonBars: number;     // forward-bar horizon (interpretation depends on series cadence)
}

export interface GenericBtTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  entryValue: number;
  returnPct: number;
  path: number[];
}

export interface GenericBtBaseline {
  count: number;
  meanReturn: number;
  medianReturn: number;
  pctPositive: number;
  stdDev: number;
}

export interface GenericBtResult {
  trades: GenericBtTrade[];
  count: number;
  pctPositive: number;
  meanReturn: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  baseline: GenericBtBaseline;
  edgeMean: number;
  zScore: number;
  paths: Array<Record<string, number | string>>;
  current: {
    entryDate: string;
    entryValue: number;
    barsElapsed: number;
    path: number[];
  } | null;
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stddev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export interface IndSeries { t: string; v: number; price: number }

function computeBaseline(series: IndSeries[], h: number): GenericBtBaseline {
  const rets: number[] = [];
  for (let i = 0; i < series.length - h - 1; i++) {
    const p0 = series[i].price, p1 = series[i + h].price;
    if (p0 > 0 && p1 > 0) rets.push(((p1 - p0) / p0) * 100);
  }
  if (!rets.length) return { count: 0, meanReturn: 0, medianReturn: 0, pctPositive: 0, stdDev: 0 };
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  return {
    count: rets.length,
    meanReturn: mean,
    medianReturn: median(rets),
    pctPositive: (rets.filter((r) => r > 0).length / rets.length) * 100,
    stdDev: stddev(rets),
  };
}

export function runGenericBacktest(series: IndSeries[], p: GenericBtParams): GenericBtResult {
  const baseline = computeBaseline(series, p.horizonBars);
  const empty: GenericBtResult = {
    trades: [], count: 0, pctPositive: 0, meanReturn: 0, medianReturn: 0,
    bestReturn: 0, worstReturn: 0, baseline, edgeMean: 0, zScore: 0, paths: [], current: null,
  };
  if (series.length < p.horizonBars + 2) return empty;

  const trades: GenericBtTrade[] = [];
  for (let i = 0; i < series.length - p.horizonBars - 1; i++) {
    const v = series[i].v;
    const triggered = p.condition === "gte" ? v >= p.threshold : v <= p.threshold;
    if (!triggered || series[i].price <= 0) continue;
    const entry = series[i], exit = series[i + p.horizonBars];
    const raw = ((exit.price - entry.price) / entry.price) * 100;
    const path: number[] = [];
    for (let k = 0; k <= p.horizonBars; k++) {
      path.push(((series[i + k].price - entry.price) / entry.price) * 100);
    }
    trades.push({
      entryDate: entry.t, exitDate: exit.t,
      entryPrice: entry.price, exitPrice: exit.price,
      entryValue: v, returnPct: raw, path,
    });
  }

  // Latest active trigger inside the in-progress window
  let current: GenericBtResult["current"] = null;
  const startIdx = Math.max(0, series.length - p.horizonBars - 1);
  for (let i = startIdx; i <= series.length - 1; i++) {
    const v = series[i].v;
    const triggered = p.condition === "gte" ? v >= p.threshold : v <= p.threshold;
    if (!triggered || series[i].price <= 0) continue;
    const barsElapsed = series.length - 1 - i;
    const entry = series[i];
    const path: number[] = [];
    for (let k = 0; k <= barsElapsed; k++) {
      path.push(((series[i + k].price - entry.price) / entry.price) * 100);
    }
    current = { entryDate: entry.t, entryValue: v, barsElapsed, path };
    break;
  }

  const returns = trades.map((t) => t.returnPct);
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

  const paths: Array<Record<string, number | string>> = [];
  for (let k = 0; k <= p.horizonBars; k++) {
    const row: Record<string, number | string> = { bar: k };
    const vals: number[] = [];
    trades.forEach((t, idx) => {
      row[`t${idx}`] = Number(t.path[k].toFixed(3));
      vals.push(t.path[k]);
    });
    row.median = vals.length ? Number(median(vals).toFixed(3)) : 0;
    row.mean = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : 0;
    row.baseline = Number(((baseline.meanReturn * k) / Math.max(1, p.horizonBars)).toFixed(3));
    if (current && k <= current.barsElapsed) row.current = Number(current.path[k].toFixed(3));
    paths.push(row);
  }

  const edgeMean = mean - baseline.meanReturn;
  const zScore = trades.length > 0 && baseline.stdDev > 0
    ? edgeMean / (baseline.stdDev / Math.sqrt(trades.length))
    : 0;

  return {
    trades,
    count: trades.length,
    pctPositive: returns.length ? (returns.filter((r) => r > 0).length / returns.length) * 100 : 0,
    meanReturn: mean,
    medianReturn: median(returns),
    bestReturn: returns.length ? Math.max(...returns) : 0,
    worstReturn: returns.length ? Math.min(...returns) : 0,
    baseline,
    edgeMean,
    zScore,
    paths,
    current,
  };
}
