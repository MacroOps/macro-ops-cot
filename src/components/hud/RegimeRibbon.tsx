import { useMemo } from "react";
import { mockSeries, lastValue } from "@/lib/mockSeries";
import { TrendingUp, TrendingDown, Droplets, Flame, AlertTriangle, ShieldCheck } from "lucide-react";

type Tile = {
  label: string;
  value: number;
  hi: number;
  lo: number;
  iconUp: typeof TrendingUp;
  iconDown: typeof TrendingDown;
  upWord: string;
  downWord: string;
};

function useRegime(): Tile[] {
  return useMemo(() => {
    const growth = lastValue(mockSeries({ seed: 401, points: 26, drift: 0.2 }));
    const liquidity = lastValue(mockSeries({ seed: 402, points: 26, drift: -0.1 }));
    const inflation = lastValue(mockSeries({ seed: 403, points: 26, drift: -0.3 }));
    const risk = lastValue(mockSeries({ seed: 404, points: 26, drift: 0.15 }));
    return [
      { label: "Growth", value: growth, hi: 60, lo: 40, iconUp: TrendingUp, iconDown: TrendingDown, upWord: "Expanding", downWord: "Slowing" },
      { label: "Liquidity", value: liquidity, hi: 60, lo: 40, iconUp: Droplets, iconDown: Droplets, upWord: "Easing", downWord: "Tightening" },
      { label: "Inflation", value: inflation, hi: 60, lo: 40, iconUp: Flame, iconDown: Flame, upWord: "Re-accelerating", downWord: "Cooling" },
      { label: "Risk", value: risk, hi: 60, lo: 40, iconUp: ShieldCheck, iconDown: AlertTriangle, upWord: "Risk-On", downWord: "Risk-Off" },
    ];
  }, []);
}

export function RegimeRibbon() {
  const tiles = useRegime();
  return (
    <div className="flex items-stretch border-b border-border bg-surface/30 text-[10px] font-mono">
      {tiles.map((t) => {
        const up = t.value >= t.hi;
        const down = t.value <= t.lo;
        const Icon = up ? t.iconUp : down ? t.iconDown : t.iconUp;
        const tone = up
          ? t.label === "Inflation" ? "text-warning" : "text-success"
          : down
            ? t.label === "Inflation" ? "text-success" : "text-destructive"
            : "text-muted-foreground";
        return (
          <div
            key={t.label}
            className="flex-1 px-3 py-1.5 flex items-center gap-2 border-r border-border last:border-r-0 min-w-0"
          >
            <Icon className={`h-3 w-3 shrink-0 ${tone}`} />
            <span className="uppercase tracking-[0.14em] text-muted-foreground shrink-0">{t.label}</span>
            <span className={`font-semibold uppercase tracking-wider truncate ${tone}`}>
              {up ? t.upWord : down ? t.downWord : "Neutral"}
            </span>
            <span className="ml-auto tabular-nums text-muted-foreground hidden md:inline">
              {t.value.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
