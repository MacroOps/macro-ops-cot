// Pinned footer bar with global as-of date scrubber + "Live" toggle.
import { useGlobalDate } from "./GlobalDateProvider";
import { Slider } from "@/components/ui/slider";
import { Circle, Rewind } from "lucide-react";

export function GlobalScrubber() {
  const { asOfIdx, setAsOfIdx, asOfDate, isLive, reset, totalWeeks } = useGlobalDate();
  const dateLabel = asOfDate.toISOString().slice(0, 10);

  return (
    <div className="h-9 border-t border-border bg-surface/60 backdrop-blur-sm px-3 flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
        <Rewind className="h-3 w-3" />
        As of
      </div>
      <div className="font-mono text-[11px] tabular-nums w-[88px] shrink-0 text-surface-foreground">
        {dateLabel}
      </div>
      <div className="flex-1 max-w-2xl">
        <Slider
          value={[asOfIdx]}
          min={0}
          max={totalWeeks - 1}
          step={1}
          onValueChange={(v) => setAsOfIdx(v[0])}
        />
      </div>
      <div className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
        wk {asOfIdx + 1}/{totalWeeks}
      </div>
      <button
        onClick={reset}
        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm transition-colors shrink-0 ${
          isLive
            ? "border-success/40 text-success bg-success/5"
            : "border-border hover:bg-muted"
        }`}
      >
        <Circle className={`h-2 w-2 ${isLive ? "fill-success text-success" : "text-muted-foreground"}`} />
        {isLive ? "Live" : "Jump to live"}
      </button>
    </div>
  );
}
