import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type RangePreset = "1M" | "3M" | "6M" | "1Y" | "3Y" | "MAX";

interface ChartSyncState {
  hoverT: string | null;
  setHoverT: (t: string | null) => void;
  range: RangePreset;
  setRange: (r: RangePreset) => void;
  pointsFor: (totalPoints: number, stepDays?: number) => number;
}

const Ctx = createContext<ChartSyncState | null>(null);

const RANGE_DAYS: Record<RangePreset, number | null> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
  MAX: null,
};

export function ChartSyncProvider({ children }: { children: ReactNode }) {
  const [hoverT, setHoverT] = useState<string | null>(null);
  const [range, setRange] = useState<RangePreset>("1Y");

  const pointsFor = useCallback(
    (totalPoints: number, stepDays = 7) => {
      const days = RANGE_DAYS[range];
      if (days == null) return totalPoints;
      const n = Math.min(totalPoints, Math.max(8, Math.round(days / stepDays)));
      return n;
    },
    [range],
  );

  const value = useMemo(
    () => ({ hoverT, setHoverT, range, setRange, pointsFor }),
    [hoverT, range, pointsFor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChartSync() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChartSync must be used inside <ChartSyncProvider>");
  return v;
}

export const RANGE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "3Y", "MAX"];
