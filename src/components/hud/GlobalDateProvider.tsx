// Global "as-of" date context. The scrubber controls this; any chart can
// opt-in by reading useGlobalDate() and rendering only data up to asOfIdx.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface GlobalDateCtx {
  totalWeeks: number;          // canonical history length
  asOfIdx: number;             // 0..totalWeeks-1 (totalWeeks-1 = today)
  setAsOfIdx: (i: number) => void;
  asOfDate: Date;
  isLive: boolean;             // true when scrubber is parked on "now"
  reset: () => void;
}

const Ctx = createContext<GlobalDateCtx | null>(null);
const TOTAL = 156;

export function GlobalDateProvider({ children }: { children: ReactNode }) {
  const [asOfIdx, setAsOfIdx] = useState(TOTAL - 1);
  const value = useMemo<GlobalDateCtx>(() => {
    const today = Date.now();
    const asOfDate = new Date(today - (TOTAL - 1 - asOfIdx) * 7 * 86_400_000);
    return {
      totalWeeks: TOTAL,
      asOfIdx,
      setAsOfIdx,
      asOfDate,
      isLive: asOfIdx === TOTAL - 1,
      reset: () => setAsOfIdx(TOTAL - 1),
    };
  }, [asOfIdx]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlobalDate() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGlobalDate must be used inside GlobalDateProvider");
  return v;
}
