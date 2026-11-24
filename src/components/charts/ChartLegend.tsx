import { cn } from "@/lib/utils";

export interface ChartLegendItem {
  label: string;
  /** Same CSS color as the line's `stroke` or the cell's fill, so the key matches the drawn mark. */
  color: string;
}

interface ChartLegendProps {
  items: ChartLegendItem[];
  /** "line" for line and area charts, "square" for colour-scale heatmaps. */
  shape?: "line" | "square";
  className?: string;
}

/**
 * Chart key shown above the plot. Flagged `data-export-keep` so it survives the JPG export.
 */
export function ChartLegend({ items, shape = "line", className }: ChartLegendProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 text-[10px]", className)}
      style={{ color: "hsl(var(--chart-axis))" }}
      data-export-keep=""
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {shape === "square" ? (
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: item.color, border: "1px solid hsl(var(--chart-grid))" }}
            />
          ) : (
            <span className="inline-block h-0.5 w-3 rounded-sm" style={{ background: item.color }} />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
