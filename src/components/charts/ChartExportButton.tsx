import { useRef, useState, type RefObject } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chartFilename, exportNodeToPng } from "@/lib/exportChart";

interface ChartExportButtonProps {
  title: string;
  /** Node to capture. Defaults to the closest ancestor marked with `data-chart-export`. */
  targetRef?: RefObject<HTMLElement | null>;
  /** Icon-only button sized for dense card toolbars. */
  compact?: boolean;
  className?: string;
}

export function ChartExportButton({ title, targetRef, compact, className }: ChartExportButtonProps) {
  const selfRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const node =
      targetRef?.current ?? selfRef.current?.closest<HTMLElement>("[data-chart-export]") ?? null;
    if (!node) return;
    setBusy(true);
    try {
      await exportNodeToPng(node, chartFilename(title));
    } catch (err) {
      toast.error("Could not export chart", { description: (err as Error)?.message });
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        ref={selfRef}
        type="button"
        data-export-ignore=""
        disabled={busy}
        onClick={onClick}
        title="Export chart as PNG"
        className={cn(
          "h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50",
          className,
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      </button>
    );
  }

  return (
    <Button
      ref={selfRef}
      type="button"
      variant="outline"
      size="sm"
      data-export-ignore=""
      disabled={busy}
      onClick={onClick}
      title="Export chart as PNG"
      className={cn("h-7 px-2 text-[10px] uppercase tracking-wider gap-1 [&_svg]:size-3", className)}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />} PNG
    </Button>
  );
}
