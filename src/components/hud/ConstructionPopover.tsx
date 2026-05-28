import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ComponentSpec, IndicatorSpec } from "@/lib/indicatorSpecs";

interface Props {
  spec: ComponentSpec | IndicatorSpec["composite"] & { inputs?: string[] };
  title?: string;
}

/**
 * Compact info popover: shows inputs + step-by-step formula for one
 * component or composite. Closed by default.
 */
export function ConstructionPopover({ spec, title }: Props) {
  const inputs = "inputs" in spec ? spec.inputs : undefined;
  const heading = title ?? ("title" in spec ? spec.title : "Construction");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How this is built"
          className="rounded-sm p-0.5 text-muted-foreground hover:text-surface-foreground hover:bg-muted/50"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 p-3 text-xs leading-relaxed"
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          How this is built
        </div>
        <div className="mt-1 font-semibold text-surface-foreground">{heading}</div>

        {inputs && inputs.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Inputs
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-surface-foreground/90">
              {inputs.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Steps
          </div>
          <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-surface-foreground/90">
            {spec.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        {"thresholds" in spec && spec.thresholds && (
          <div className="mt-3 text-[10px] text-muted-foreground">
            Thresholds:{" "}
            {spec.thresholds.hi != null && <>hi {spec.thresholds.hi}</>}
            {spec.thresholds.hi != null && spec.thresholds.lo != null && " · "}
            {spec.thresholds.lo != null && <>lo {spec.thresholds.lo}</>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
