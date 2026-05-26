import type { AssetSeriesPoint } from "./useAssetData";

export type BtDirection = "long" | "short";

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
  direction: BtDirection;
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
  returnPct: number;        // signed for direction
  rawReturnPct: number;
  path: number[];           // cumulative signed % return at each week 0..horizon (length = horizon+1, starts at 0)
}

export interface BtResult {
  trades: BtTrade[];
  count: number;
  hitRate: number;
  meanReturn: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  // Spaghetti: one row per week index 0..horizon. Each row has median/mean and one key per trade ("t0","t1"...).
  paths: Array<Record<string, number | string>>;
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
    return { trades: [], count: 0, hitRate: 0, meanReturn: 0, medianReturn: 0, bestReturn: 0, worstReturn: 0, paths: [] };
  }

  let i = 0;
  while (i < series.length - p.horizonWeeks - 1) {
    const v = series[i][p.indicator] as number;
    const triggered = p.direction === "long" ? v >= p.threshold : v <= p.threshold;

    if (triggered && series[i].price > 0) {
      const entry = series[i];
      const exit = series[i + p.horizonWeeks];
      const raw = (exit.price - entry.price) / entry.price;
      const ret = p.direction === "long" ? raw : -raw;
      const path: number[] = [];
      for (let k = 0; k <= p.horizonWeeks; k++) {
        const r = (series[i + k].price - entry.price) / entry.price;
        path.push((p.direction === "long" ? r : -r) * 100);
      }
      trades.push({
        entryDate: entry.date,
        exitDate: exit.date,
        entryPrice: entry.price,
        exitPrice: exit.price,
        entryValue: v,
        returnPct: ret * 100,
        rawReturnPct: raw * 100,
        path,
      });
      i += p.horizonWeeks;
    } else {
      i += 1;
    }
  }

  const returns = trades.map(t => t.returnPct);
  const hits = returns.filter(r => r > 0).length;
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
    paths.push(row);
  }

  return {
    trades,
    count: trades.length,
    hitRate: returns.length ? (hits / returns.length) * 100 : 0,
    meanReturn: mean,
    medianReturn: median(returns),
    bestReturn: returns.length ? Math.max(...returns) : 0,
    worstReturn: returns.length ? Math.min(...returns) : 0,
    paths,
  };
}
