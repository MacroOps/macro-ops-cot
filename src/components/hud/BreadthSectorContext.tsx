import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const BREADTH_SECTORS = [
  "SPX", "NDX", "RUT", "DJI",
  "XLF", "XLE", "XLK", "XLY", "XLP", "XLI", "XLV", "XLU", "XLB", "XLRE", "XLC",
] as const;
export type BreadthSector = typeof BREADTH_SECTORS[number];

const STORAGE_KEY = "mhud:breadth-sector";

interface Ctx {
  sector: BreadthSector;
  setSector: (s: BreadthSector) => void;
}

const BreadthSectorCtx = createContext<Ctx | null>(null);

export function BreadthSectorProvider({ children }: { children: ReactNode }) {
  const [sector, setSectorState] = useState<BreadthSector>(() => {
    if (typeof window === "undefined") return "SPX";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return (BREADTH_SECTORS as readonly string[]).includes(saved ?? "") ? (saved as BreadthSector) : "SPX";
  });
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, sector); } catch { /* ignore */ }
  }, [sector]);
  return (
    <BreadthSectorCtx.Provider value={{ sector, setSector: setSectorState }}>
      {children}
    </BreadthSectorCtx.Provider>
  );
}

export function useBreadthSector() {
  const ctx = useContext(BreadthSectorCtx);
  if (!ctx) throw new Error("useBreadthSector must be used inside BreadthSectorProvider");
  return ctx;
}

export function BreadthSectorPicker() {
  const { sector, setSector } = useBreadthSector();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mr-1">Sector</span>
      {BREADTH_SECTORS.map((s) => (
        <button
          key={s}
          onClick={() => setSector(s)}
          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm border transition-colors ${
            sector === s
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-surface-foreground hover:border-muted-foreground"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
