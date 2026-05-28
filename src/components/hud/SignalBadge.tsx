import { cn } from "@/lib/utils";

type Variant = "BULLISH" | "BEARISH" | "NEUTRAL" | "Triggered" | "Neutral";

export function SignalBadge({
  value,
  className,
}: {
  value: Variant | string;
  className?: string;
}) {
  const v = value as Variant;
  const styles =
    v === "BULLISH" || v === "Triggered"
      ? "bg-success/15 text-success border-success/30"
      : v === "BEARISH"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : "bg-warning/15 text-warning border-warning/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        styles,
        className,
      )}
    >
      {value}
    </span>
  );
}

export function DeltaCell({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const color =
    value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cn("font-mono tabular-nums text-xs", color)}>
      {sign}
      {value}
    </span>
  );
}

export function LevelBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 60 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-sm bg-muted/40 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono tabular-nums text-[10px] text-surface-foreground w-6 text-right">
        {pct}
      </span>
    </div>
  );
}
