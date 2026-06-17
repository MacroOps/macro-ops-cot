import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function MockBadge({ reason }: { reason?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm border border-warning/40 bg-warning/10 text-warning cursor-help">
            <span className="size-1.5 rounded-full bg-warning" />
            Mock
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[260px]">
          {reason ?? "No upstream data source is wired up yet. Series is generated for layout preview only."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
