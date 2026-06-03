import { useMemo } from "react";
import { Link } from "react-router-dom";
import { generateSignalsTape, type ModelSignal } from "@/lib/signals";
import { useCopilot } from "./CopilotContext";
import { Sparkles, ArrowUpRight, ArrowDownRight, AlertTriangle, Radio } from "lucide-react";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function SignalsTape({ limit = 18 }: { limit?: number }) {
  const signals = useMemo(() => generateSignalsTape(limit), [limit]);
  const { openCopilot } = useCopilot();

  function ask(sig: ModelSignal) {
    openCopilot({
      context: {
        title: sig.model,
        seed: sig.seed,
        value: sig.value,
        thresholdHi: sig.direction === "bearish" ? sig.threshold : undefined,
        thresholdLo: sig.direction === "bullish" ? sig.threshold : undefined,
        href: sig.href,
      },
      prompt: `Explain the ${sig.model} signal that just fired (${sig.title}). What's the historical base rate?`,
    });
  }

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-primary animate-pulse" />
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-surface-foreground">
            Signals Tape
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            · {signals.length} fires · last 14d
          </span>
        </div>
        <button
          onClick={() => openCopilot({ prompt: "What are the most material signals that fired in the last 14 days?" })}
          className="text-[10px] uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Ask Copilot
        </button>
      </div>
      <div className="max-h-[320px] overflow-auto divide-y divide-border/60">
        {signals.map((s) => {
          const Icon = s.severity === "warning" ? AlertTriangle : s.direction === "bullish" ? ArrowUpRight : ArrowDownRight;
          const tone =
            s.severity === "warning" ? "text-warning" :
            s.direction === "bullish" ? "text-success" : "text-destructive";
          return (
            <div key={s.id} className="px-3 py-2 flex items-center gap-3 hover:bg-surface-2/40 group">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-medium text-surface-foreground truncate">
                  <span className={`uppercase tracking-wider text-[9px] ${tone}`}>
                    {s.severity === "warning" ? "Approaching" : s.direction}
                  </span>
                  <span className="truncate">{s.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{s.detail}</div>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                {timeAgo(s.ts)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {s.href && (
                  <Link to={s.href} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-sm hover:border-primary">
                    open
                  </Link>
                )}
                <button onClick={() => ask(s)} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground">
                  ask
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
