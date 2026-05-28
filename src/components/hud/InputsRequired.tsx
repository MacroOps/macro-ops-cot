import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  inputs: string[];
}

/**
 * Collapsible footer rail listing the raw data series a model needs.
 * Doubles as the ingestion checklist when wiring real data later.
 */
export function InputsRequired({ inputs }: Props) {
  return (
    <div className="px-3 pb-4">
      <Collapsible>
        <div className="hud-panel">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-left">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inputs Required ({inputs.length})
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-surface-foreground/90">
              {inputs.map((i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">·</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
