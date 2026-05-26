import type { AssetSeriesPoint } from "./useAssetData";

export type BtCondition = "gte" | "lte";

export type BtIndicator =
  | "netSpecPct3y"
  | "netSpecPct6m"
  | "largeSpecPct"
  | "largeSpecPct6m"
  | "smallSpecPct"
  | "smallSpecPct6m"
  | "levFundPct"
  | "levFundPct6m"
  | "mmPct"
  | "mmPct6m"
  | "assetMgrPct"
  | "assetMgrPct6m"
  | "extremityScore";

export const INDICATOR_OPTIONS: { key: BtIndicator; label: string; group: string; range: [number, number] }[] = [
  { key: "netSpecPct3y",   label: "Net Spec %ile (3Y)",      group: "Net Speculator", range: [0, 100] },
  { key: "netSpecPct6m",   label: "Net Spec %ile (6M)",      group: "Net Speculator", range: [0, 100] },
  { key: "extremityScore", label: "Extremity Score",         group: "Composite",      range: [-100, 100] },
  { key: "largeSpecPct",   label: "Large Spec %ile (3Y)",    group: "Legacy",         range: [0, 100] },
  { key: "largeSpecPct6m", label: "Large Spec %ile (6M)",    group: "Legacy",         range: [0, 100] },
  { key: "smallSpecPct",   label: "Small Spec %ile (3Y)",    group: "Legacy",         range: [0, 100] },
  { key: "smallSpecPct6m", label: "Small Spec %ile (6M)",    group: "Legacy",         range: [0, 100] },
  { key: "levFundPct",     label: "Lev Funds %ile (3Y)",     group: "TFF",            range: [0, 100] },
  { key: "levFundPct6m",   label: "Lev Funds %ile (6M)",     group: "TFF",            range: [0, 100] },
  { key: "assetMgrPct",    label: "Asset Mgr %ile (3Y)",     group: "TFF",            range: [0, 100] },
  { key: "assetMgrPct6m",  label: "Asset Mgr %ile (6M)",     group: "TFF",            range: [0, 100] },
  { key: "mmPct",          label: "Managed Money %ile (3Y)", group: "Disaggregated",  range: [0, 100] },
  { key: "mmPct6m",        label: "Managed Money %ile (6M)", group: "Disaggregated",  range: [0, 100] },
];

export interface BtParams {
  condition: BtCondition;
  threshold: number;
  horizonWeeks: number;
  indicator: BtIndicator;
}

export interface BtTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  entryValue: number;
  returnPct: number;        // raw forward return of underlying (positive = up)
  rawReturnPct: number;     // same; kept for compatibility
  path: number[];           // cumulative raw % return at each week 0..horizon (length = horizon+1, starts at 0)
}

export interface BtBaseline {
  count: number;
  meanReturn: number;
  medianReturn: number;
  pctPositive: number;
  stdDev: number;
}

export interface BtCurrentSignal {
  entryDate: string;
  entryValue: number;
  weeksElapsed: number;     // how many weeks of forward data we have so far (< horizon)
  path: number[];           // partial raw % return path from entry through latest data
}

export interface BtResult {
  trades: BtTrade[];
  count: number;
  pctPositive: number;       // % of cohort instances where market rose over horizon
  meanReturn: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  baseline: BtBaseline;
  edgeMean: number;          // meanReturn - baseline.meanReturn
  zScore: number;            // (mean - baseline.mean) / (baseline.std / sqrt(n))
  current: BtCurrentSignal | null;  // most recent active trigger (in-progress forward path)
  // Spaghetti: one row per week index 0..horizon. Each row has median/mean/baseline/current and one key per trade ("t0","t1"...).
  paths: Array<Record<string, number | string>>;
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

function computeBaseline(series: AssetSeriesPoint[], horizonWeeks: number): BtBaseline {
  const rets: number[] = [];
  for (let i = 0; i < series.length - horizonWeeks - 1; i++) {
    const p0 = series[i].price;
    const p1 = series[i + horizonWeeks].price;
    if (p0 > 0 && p1 > 0) {
      rets.push(((p1 - p0) / p0) * 100);
    }
  }
  if (!rets.length) {
    return { count: 0, meanReturn: 0, medianReturn: 0, pctPositive: 0, stdDev: 0 };
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const pos = rets.filter(r => r > 0).length;
  return {
    count: rets.length,
    meanReturn: mean,
    medianReturn: median(rets),
    pctPositive: (pos / rets.length) * 100,
    stdDev: stddev(rets),
  };
}

export function runBacktest(series: AssetSeriesPoint[], p: BtParams): BtResult {
  const baseline = computeBaseline(series, p.horizonWeeks);
  const empty: BtResult = {
    trades: [], count: 0, pctPositive: 0, meanReturn: 0, medianReturn: 0,
    bestReturn: 0, worstReturn: 0, baseline, edgeMean: 0, zScore: 0, paths: [],
  };
  if (series.length < p.horizonWeeks + 2) return empty;

  const trades: BtTrade[] = [];
  let i = 0;
  while (i < series.length - p.horizonWeeks - 1) {
    const v = series[i][p.indicator] as number;
    const triggered = p.condition === "gte" ? v >= p.threshold : v <= p.threshold;

    if (triggered && series[i].price > 0) {
      const entry = series[i];
      const exit = series[i + p.horizonWeeks];
      const raw = ((exit.price - entry.price) / entry.price) * 100;
      const path: number[] = [];
      for (let k = 0; k <= p.horizonWeeks; k++) {
        const r = ((series[i + k].price - entry.price) / entry.price) * 100;
        path.push(r);
      }
      trades.push({
        entryDate: entry.date,
        exitDate: exit.date,
        entryPrice: entry.price,
        exitPrice: exit.price,
        entryValue: v,
        returnPct: raw,
        rawReturnPct: raw,
        path,
      });
      i += p.horizonWeeks;
    } else {
      i += 1;
    }
  }

  const returns = trades.map(t => t.returnPct);
  const pos = returns.filter(r => r > 0).length;
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

  const paths: Array<Record<string, number | string>> = [];
  for (let k = 0; k <= p.horizonWeeks; k++) {
    const row: Record<string, number | string> = { week: k };
    const vals: number[] = [];
    trades.forEach((t, idx) => {
      row[`t${idx}`] = Number(t.path[k].toFixed(3));
      vals.push(t.path[k]);
    });
    row.median = vals.length ? Number(median(vals).toFixed(3)) : 0;
    row.mean = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : 0;
    // Linear baseline drift across the horizon (mean N-week return scaled by week/horizon)
    row.baseline = Number(((baseline.meanReturn * k) / Math.max(1, p.horizonWeeks)).toFixed(3));
    paths.push(row);
  }

  const edgeMean = mean - baseline.meanReturn;
  const zScore = trades.length > 0 && baseline.stdDev > 0
    ? edgeMean / (baseline.stdDev / Math.sqrt(trades.length))
    : 0;

  return {
    trades,
    count: trades.length,
    pctPositive: returns.length ? (pos / returns.length) * 100 : 0,
    meanReturn: mean,
    medianReturn: median(returns),
    bestReturn: returns.length ? Math.max(...returns) : 0,
    worstReturn: returns.length ? Math.min(...returns) : 0,
    baseline,
    edgeMean,
    zScore,
    paths,
  };
}
