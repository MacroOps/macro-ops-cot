// Deterministic, indicator-aware Signals feed.
// Derives "model fired" events from indicatorSpecs + mockSeries so that the
// home-page Signals Tape always has fresh-looking, internally-consistent fires.

import { mockSeries, lastValue } from "@/lib/mockSeries";

export type SignalSeverity = "critical" | "warning" | "info";
export type SignalDirection = "bullish" | "bearish" | "neutral";

export interface ModelSignal {
  id: string;
  ts: string;              // ISO timestamp
  model: string;           // e.g. "Trend Fragility"
  title: string;           // headline
  detail: string;          // 1-line context
  value: number;
  threshold: number;
  direction: SignalDirection;
  severity: SignalSeverity;
  href?: string;           // deep link
  seed: number;
}

type Source = {
  model: string;
  seed: number;
  min?: number; max?: number; drift?: number;
  thresholdHi?: number; thresholdLo?: number;
  href: string;
  unit?: string;
};

const SOURCES: Source[] = [
  { model: "Trend Fragility",       seed: 11, thresholdHi: 90, thresholdLo: 20, drift: -0.4, href: "/trend-fragility" },
  { model: "Risk Cycle",            seed: 12, thresholdHi: 80, thresholdLo: 20, drift: 0.1,  href: "/risk-cycle" },
  { model: "Market Internals",      seed: 13, min: -80, max: 80, thresholdHi: 60, thresholdLo: -60, drift: 0.3, href: "/market-internals" },
  { model: "Breadth & Thrust",      seed: 14, min: 0, max: 15, thresholdHi: 11, thresholdLo: 3, href: "/breadth/overview" },
  { model: "MO Liquidity",          seed: 15, thresholdHi: 85, thresholdLo: 15, drift: 0.2, href: "/macro/liquidity" },
  { model: "Implied Recession 6m",  seed: 16, thresholdHi: 70, thresholdLo: 10, drift: -0.2, href: "/macro/recession" },
  { model: "TCTM Thrust",           seed: 74, min: 0, max: 7, thresholdHi: 5, drift: 0.4, href: "/tpmr/tctm/thrust", unit: "/7" },
  { model: "TCTM Capitulation",     seed: 72, min: 0, max: 7, thresholdHi: 4, drift: -0.2, href: "/tpmr/tctm/capitulation", unit: "/7" },
  { model: "TCTM Risk-Off",         seed: 71, min: 0, max: 7, thresholdHi: 5, drift: 0.1, href: "/tpmr/tctm/risk-off", unit: "/7" },
];

export function generateSignalsTape(limit = 24): ModelSignal[] {
  const all: ModelSignal[] = [];
  const now = Date.now();

  SOURCES.forEach((src) => {
    const series = mockSeries({
      seed: src.seed,
      points: 120,
      min: src.min ?? 0,
      max: src.max ?? 100,
      drift: src.drift ?? 0,
    });

    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].v;
      const v = series[i].v;
      let fired: { dir: SignalDirection; thr: number; sev: SignalSeverity } | null = null;
      if (src.thresholdHi != null && prev < src.thresholdHi && v >= src.thresholdHi) {
        fired = { dir: "bearish", thr: src.thresholdHi, sev: "critical" };
      } else if (src.thresholdLo != null && prev > src.thresholdLo && v <= src.thresholdLo) {
        fired = { dir: "bullish", thr: src.thresholdLo, sev: "critical" };
      }
      if (!fired) continue;

      // Spread events across the last 14 days for "live tape" feel.
      const ageDays = (series.length - i) * 0.6;
      const ts = new Date(now - ageDays * 86_400_000).toISOString();

      all.push({
        id: `${src.seed}-${i}`,
        ts,
        model: src.model,
        title: `${src.model} ${fired.dir === "bullish" ? "buy trigger" : "fade trigger"} @ ${v.toFixed(1)}${src.unit ?? ""}`,
        detail: `Crossed ${fired.dir === "bullish" ? "below" : "above"} threshold ${fired.thr}${src.unit ?? ""} (prev ${prev.toFixed(1)})`,
        value: v,
        threshold: fired.thr,
        direction: fired.dir,
        severity: fired.sev,
        href: src.href,
        seed: src.seed,
      });
    }
  });

  // Add a few "warning" near-miss approaches in the last 3 days
  SOURCES.slice(0, 5).forEach((src, idx) => {
    const series = mockSeries({ seed: src.seed + 100, points: 30, min: src.min ?? 0, max: src.max ?? 100 });
    const v = lastValue(series);
    if (src.thresholdHi != null && v > src.thresholdHi * 0.85 && v < src.thresholdHi) {
      all.push({
        id: `${src.seed}-approach`,
        ts: new Date(now - (idx + 1) * 3 * 3600_000).toISOString(),
        model: src.model,
        title: `${src.model} approaching extreme @ ${v.toFixed(1)}${src.unit ?? ""}`,
        detail: `Within ${(src.thresholdHi - v).toFixed(1)} of the ${src.thresholdHi}${src.unit ?? ""} threshold`,
        value: v, threshold: src.thresholdHi,
        direction: "neutral", severity: "warning",
        href: src.href, seed: src.seed,
      });
    }
  });

  return all.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, limit);
}
