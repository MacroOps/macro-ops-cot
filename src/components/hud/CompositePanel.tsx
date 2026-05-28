import { IndicatorCard } from "@/components/hud/IndicatorCard";
import { ConstructionPopover } from "@/components/hud/ConstructionPopover";
import type { IndicatorSpec } from "@/lib/indicatorSpecs";

interface Props {
  spec: IndicatorSpec;
  seed: number;
  height?: number;
  drift?: number;
}

/**
 * Banner for a composite indicator: chart + the one-line "how it's built"
 * summary derived from spec.composite.steps.
 */
export function CompositePanel({ spec, seed, height = 240, drift = 0 }: Props) {
  const c = spec.composite;
  const summary = c.steps.join(" → ");
  return (
    <div className="px-3 pt-3">
      <IndicatorCard
        title={c.title}
        subtitle={summary}
        seed={seed}
        variant="area"
        height={height}
        min={c.scale?.min}
        max={c.scale?.max}
        drift={drift}
        thresholds={c.thresholds}
        actions={
          <ConstructionPopover
            title={c.title}
            spec={{ ...c, inputs: spec.inputs }}
          />
        }
      />
    </div>
  );
}
