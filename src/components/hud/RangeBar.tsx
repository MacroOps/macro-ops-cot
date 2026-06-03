import { useEffect } from "react";
import { useChartSync, RANGE_PRESETS, type RangePreset } from "./ChartSyncContext";
import { Clock } from "lucide-react";

export function RangeBar({ label = "Time range" }: { label?: string }) {
  const { range, setRange } = useChartSync();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack typing
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const i = RANGE_PRESETS.indexOf(range);
      if (e.key === "]") {
        e.preventDefault();
        setRange(RANGE_PRESETS[Math.min(i + 1, RANGE_PRESETS.length - 1)]);
      } else if (e.key === "[") {
        e.preventDefault();
        setRange(RANGE_PRESETS[Math.max(i - 1, 0)]);
      } else if (e.key === "\\") {
        e.preventDefault();
        setRange("1Y");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [range, setRange]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface/40">
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-sm border border-border overflow-hidden">
        {RANGE_PRESETS.map((p: RangePreset) => (
          <button
            key={p}
            onClick={() => setRange(p)}
            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
              range === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-2"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-muted-foreground hidden md:inline">
        [ / ] step · \ reset
      </span>
    </div>
  );
}
