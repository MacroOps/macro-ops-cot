// Registry of "backtestable" indicators that aren't CoT-positioning.
// Each entry knows how to synthesize its time series (mock for now)
// and its natural underlying market.
//
// CoT indicators are handled separately via useAssetData + INDICATOR_OPTIONS
// in src/hooks/useBacktest.ts.

import { mockSeries, type MockOptions } from "@/lib/mockSeries";

export type IndicatorCategory =
  | "Trend"
  | "Risk"
  | "Breadth"
  | "Internals"
  | "TPMR"
  | "Macro"
  | "Composite";

export interface RegistryIndicator {
  key: string;          // stable id (matches indicatorKey used on cards)
  label: string;
  category: IndicatorCategory;
  seed: number;
  min: number;
  max: number;
  drift?: number;
  volatility?: number;
  unit?: string;
  thresholdHi?: number;
  thresholdLo?: number;
  underlying: string;   // default underlying symbol
  // Optional explicit overrides for the mock series generator
  mock?: MockOptions;
}

export const REGISTRY: RegistryIndicator[] = [
  // Trend Fragility
  { key: "tf-score",        label: "Trend Fragility Score",   category: "Trend",     seed: 101, min: 0,  max: 100, thresholdHi: 75, thresholdLo: 25, unit: "",  underlying: "ES" },
  { key: "tf-zscore",       label: "Fragility Z-Score",        category: "Trend",     seed: 102, min: -3, max: 3,   thresholdHi: 2,  thresholdLo: -2, unit: "σ", underlying: "ES" },
  { key: "tf-regime-flips", label: "Regime Flip Rate",         category: "Trend",     seed: 103, min: 0,  max: 100, thresholdHi: 70, unit: "%",                 underlying: "ES" },

  // Risk Cycle
  { key: "rc-risk-on",     label: "Risk-On Composite",         category: "Risk",      seed: 201, min: 0,  max: 100, thresholdHi: 80, thresholdLo: 20, unit: "",  underlying: "ES" },
  { key: "rc-vol-of-vol",  label: "Vol-of-Vol",                category: "Risk",      seed: 202, min: 0,  max: 100, thresholdHi: 75, unit: "",                  underlying: "VX" },
  { key: "rc-credit-stress", label: "Credit Stress Index",     category: "Risk",      seed: 203, min: 0,  max: 100, thresholdHi: 70, unit: "",                  underlying: "TY" },

  // Breadth
  { key: "br-pct-200dma",  label: "% Stocks Above 200DMA",     category: "Breadth",   seed: 301, min: 0,  max: 100, thresholdHi: 80, thresholdLo: 20, unit: "%", underlying: "ES" },
  { key: "br-thrust",      label: "Breadth Thrust Score",      category: "Breadth",   seed: 302, min: 0,  max: 100, thresholdHi: 85, unit: "",                  underlying: "ES" },
  { key: "br-capitulation",label: "Capitulation Trigger",      category: "Breadth",   seed: 303, min: 0,  max: 100, thresholdHi: 90, unit: "",                  underlying: "ES" },

  // Internals
  { key: "mi-ad-line",     label: "Advance/Decline Momentum",  category: "Internals", seed: 401, min: -100, max: 100, thresholdHi: 60, thresholdLo: -60, unit: "", underlying: "ES" },
  { key: "mi-nhnl",        label: "New Highs − New Lows",      category: "Internals", seed: 402, min: -100, max: 100, thresholdHi: 50, thresholdLo: -50, unit: "", underlying: "ES" },

  // TPMR
  { key: "tpmr-dual-trend",   label: "Dual Trend Score",       category: "TPMR",      seed: 501, min: -100, max: 100, thresholdHi: 60, thresholdLo: -60, unit: "", underlying: "ES" },
  { key: "tpmr-tctm-stage",   label: "TCTM Stage Strength",    category: "TPMR",      seed: 502, min: 0, max: 100, thresholdHi: 75, unit: "", underlying: "ES" },

  // Macro
  { key: "mc-liquidity",  label: "Global Liquidity Pulse",     category: "Macro",     seed: 601, min: 0, max: 100, thresholdHi: 70, thresholdLo: 30, unit: "", underlying: "ES" },
  { key: "mc-inflation",  label: "Inflation Surprise",         category: "Macro",     seed: 602, min: -100, max: 100, thresholdHi: 50, thresholdLo: -50, unit: "", underlying: "ZN" },
  { key: "mc-recession",  label: "Recession Probability",      category: "Macro",     seed: 603, min: 0, max: 100, thresholdHi: 60, unit: "%", underlying: "ES" },
];

export const REGISTRY_BY_KEY: Record<string, RegistryIndicator> =
  Object.fromEntries(REGISTRY.map((r) => [r.key, r]));

/** Build a synthetic series of {t, v, price} for backtesting any registered indicator.
 *  Price is a related-but-distinct seeded random walk so we get a believable forward path. */
export function buildIndicatorSeries(ind: RegistryIndicator, points = 312) {
  const vs = mockSeries({
    seed: ind.seed,
    points,
    min: ind.min,
    max: ind.max,
    drift: ind.drift ?? 0,
    volatility: ind.volatility ?? 0.18,
    ...ind.mock,
  });
  // Price proxy: positive-drift random walk seeded off the indicator seed
  const prices = mockSeries({
    seed: ind.seed * 17 + 3,
    points,
    min: 80,
    max: 220,
    drift: 0.15,
    volatility: 0.12,
  });
  return vs.map((p, i) => ({ t: p.t, v: p.v, price: prices[i]?.v ?? 100 }));
}

export const CATEGORIES: IndicatorCategory[] = [
  "Trend", "Risk", "Breadth", "Internals", "TPMR", "Macro", "Composite",
];
