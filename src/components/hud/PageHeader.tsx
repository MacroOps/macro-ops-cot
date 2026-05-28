import { type ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 px-4 py-4 border-b border-border bg-surface/30">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
            {eyebrow}
          </div>
        )}
        <h2 className="text-lg font-semibold text-surface-foreground truncate">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
