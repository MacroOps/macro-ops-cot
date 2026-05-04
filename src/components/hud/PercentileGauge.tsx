interface Props {
  value: number; // 0-100
  label: string;
  emphasize?: boolean;
}

// Compact horizontal percentile gauge with extreme zone markers.
// Designed to sit on a white chart surface (--chart-surface).
export function PercentileGauge({ value, label, emphasize }: Props) {
  const v = Math.max(0, Math.min(100, value));
  const extreme = v >= 85 || v <= 15;
  const fillColor =
    v >= 85 ? "hsl(var(--pos-long))"
    : v <= 15 ? "hsl(var(--pos-short))"
    : "hsl(var(--chart-ink))";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-[0.12em] font-medium"
          style={{ color: "hsl(var(--chart-axis))" }}
        >
          {label}
        </span>
        <span
          className={`font-mono tabular-nums ${emphasize ? "text-[12px] font-semibold" : "text-[11px]"}`}
          style={{
            color: extreme
              ? (v >= 85 ? "hsl(var(--pos-long))" : "hsl(var(--pos-short))")
              : "hsl(var(--chart-surface-foreground))",
          }}
        >
          {v.toFixed(0)}
        </span>
      </div>
      <div
        className={`relative w-full overflow-hidden ${emphasize ? "h-2" : "h-1.5"}`}
        style={{
          background: "hsl(var(--chart-surface))",
          border: "1px solid hsl(var(--chart-grid))",
          borderRadius: 2,
        }}
      >
        {/* extreme zones */}
        <div className="absolute inset-y-0 left-0 w-[15%]" style={{ background: "hsl(var(--pos-short) / 0.10)" }} />
        <div className="absolute inset-y-0 right-0 w-[15%]" style={{ background: "hsl(var(--pos-long) / 0.10)" }} />
        {/* fill */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${v}%`, background: fillColor }}
        />
        {/* current marker */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px"
          style={{ left: `${v}%`, background: "hsl(var(--chart-ink))" }}
        />
      </div>
    </div>
  );
}
