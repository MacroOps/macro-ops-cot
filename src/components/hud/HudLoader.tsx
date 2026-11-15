/**
 * Official page loading state: the tan ledger line from Classic HUD.
 * Use for whole pages or panels. For tables, use <Skeleton /> blocks instead.
 */
export function HudLoader({ eyebrow, label = "Loading" }: { eyebrow?: string; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12">
      {eyebrow && (
        <div className="text-[10px] uppercase tracking-[0.22em] text-accent-deep">{eyebrow}</div>
      )}
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="relative h-px w-40 overflow-hidden bg-ledger">
        <div className="absolute inset-y-0 w-1/3 bg-accent animate-hud-ledger" />
      </div>
    </div>
  );
}
