interface Props {
  value: number; // 0-100
  label: string;
}

// Compact horizontal percentile gauge with extreme zone markers.
export function PercentileGauge({ value, label }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const extreme = v >= 85 || v <= 15;
  const color =
    v >= 85 ? "bg-pos-long"
    : v <= 15 ? "bg-pos-short"
    : "bg-foreground/60";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="hud-label">{label}</span>
        <span className={`font-mono text-[11px] tabular-nums ${extreme ? "text-primary font-semibold" : "text-surface-foreground"}`}>
          {v.toFixed(0)}
        </span>
      </div>
      <div className="relative h-1.5 w-full bg-background border border-border rounded-sm overflow-hidden">
        {/* extreme zones */}
        <div className="absolute inset-y-0 left-0 w-[15%] bg-pos-short/15" />
        <div className="absolute inset-y-0 right-0 w-[15%] bg-pos-long/15" />
        {/* fill */}
        <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${v}%` }} />
        {/* current marker */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px bg-primary"
          style={{ left: `${v}%` }}
        />
      </div>
    </div>
  );
}
