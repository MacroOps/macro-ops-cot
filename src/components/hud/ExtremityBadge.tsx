import type { ExtremityBand } from "@/lib/mockData";

interface Props {
  score: number;
  band: ExtremityBand;
  compact?: boolean;
}

function colorFor(band: ExtremityBand): string {
  switch (band) {
    case "euphoric":
    case "crowded-long":
      return "hsl(var(--pos-long))";
    case "capitulation":
    case "crowded-short":
      return "hsl(var(--pos-short))";
    case "leaning-long":
      return "hsl(var(--pos-long) / 0.55)";
    case "leaning-short":
      return "hsl(var(--pos-short) / 0.55)";
    default:
      return "hsl(var(--chart-axis))";
  }
}

function labelFor(band: ExtremityBand): string {
  switch (band) {
    case "euphoric": return "EUPHORIC";
    case "capitulation": return "CAPITULATION";
    case "crowded-long": return "CROWDED LONG";
    case "crowded-short": return "CROWDED SHORT";
    case "leaning-long": return "LEANING LONG";
    case "leaning-short": return "LEANING SHORT";
    default: return "NEUTRAL";
  }
}

export function ExtremityBadge({ score, band, compact }: Props) {
  const color = colorFor(band);
  const pulse = band === "euphoric" || band === "capitulation";
  const v = Math.max(-100, Math.min(100, score));
  // map [-100,100] -> [0,100]% along bar
  const markerPct = (v + 100) / 2;
  const fillLeftPct = v >= 0 ? 50 : markerPct;
  const fillWidthPct = Math.abs(v) / 2;

  return (
    <div className={`flex flex-col gap-1 ${pulse ? "animate-extremity-pulse" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[9px] uppercase tracking-[0.12em] font-semibold"
          style={{ color }}
        >
          {labelFor(band)}
        </span>
        <span
          className="font-mono tabular-nums text-[11px] font-semibold"
          style={{ color }}
        >
          {v > 0 ? "+" : ""}{v}
        </span>
      </div>
      <div
        className={`relative w-full overflow-hidden ${compact ? "h-1.5" : "h-2"}`}
        style={{
          background: "hsl(var(--chart-surface))",
          border: "1px solid hsl(var(--chart-grid))",
          borderRadius: 2,
        }}
      >
        {/* extreme zones at edges */}
        <div className="absolute inset-y-0 left-0 w-[12.5%]" style={{ background: "hsl(var(--pos-short) / 0.10)" }} />
        <div className="absolute inset-y-0 right-0 w-[12.5%]" style={{ background: "hsl(var(--pos-long) / 0.10)" }} />
        {/* center line */}
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "hsl(var(--chart-grid))" }} />
        {/* fill from center */}
        <div
          className="absolute inset-y-0"
          style={{ left: `${fillLeftPct}%`, width: `${fillWidthPct}%`, background: color }}
        />
        {/* marker */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px"
          style={{ left: `${markerPct}%`, background: "hsl(var(--chart-ink))" }}
        />
      </div>
    </div>
  );
}
