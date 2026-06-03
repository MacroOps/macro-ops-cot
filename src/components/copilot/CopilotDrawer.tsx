import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, BarChart3, Loader2, X, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCopilot } from "./CopilotContext";
import { cn } from "@/lib/utils";
import { persistRun } from "@/lib/backtest/persistence";

type Role = "user" | "assistant" | "tool";
interface Msg { role: Role; content: string; toolName?: string; }

interface BacktestResult {
  title: string;
  threshold: number;
  direction: "above" | "below";
  windowYears: number;
  occurrences: number;
  horizonStats: Array<{ horizonDays: number; meanRet: number; median: number; hitRate: number; stdev: number; maxDD: number; sharpe: number }>;
  examples: Array<{ date: string; triggerValue: number; fwd21d: number }>;
  regimeNote: string;
}

const SUGGESTIONS = [
  "What is this chart telling me right now?",
  "How does this compare to historical extremes?",
  "What macro conditions typically accompany this signal?",
  "Where does this rank vs the last 3 years?",
];

export function CopilotDrawer() {
  const { open, close, context, seedPrompt } = useCopilot();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [btBusy, setBtBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setBacktest(null);
      setInput(seedPrompt ?? "");
    }
  }, [open, seedPrompt, context?.seed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next = [...messages, { role: "user" as Role, content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/copilot-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content })),
          context: context ?? undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${(e as Error).message}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  async function runBacktest() {
    if (!context || btBusy) return;
    setBtBusy(true);
    setBacktest(null);
    try {
      const direction: "above" | "below" =
        context.thresholdHi != null && context.value >= (context.thresholdHi * 0.7) ? "above" : "below";
      const threshold = direction === "above" ? (context.thresholdHi ?? 75) : (context.thresholdLo ?? 25);
      const { data, error } = await supabase.functions.invoke("copilot-backtest", {
        body: { seed: context.seed, title: context.title, threshold, direction },
      });
      if (error) throw error;
      const result = data as BacktestResult;
      setBacktest(result);

      // Push as a tool message + auto-summarize
      const summary = `Backtest tool ran on ${result.title} (${result.direction} ${result.threshold}${context.unit ?? ""}): ${result.occurrences} historical fires across ${result.windowYears}y. ` +
        result.horizonStats.map((h) => `${h.horizonDays}d mean ${h.meanRet >= 0 ? "+" : ""}${h.meanRet}% hit ${h.hitRate}% sharpe ${h.sharpe}`).join(" · ");
      setMessages((m) => [...m, { role: "tool", toolName: "backtest", content: summary }]);
      await send("Summarize what this backtest implies for current positioning, in 3 bullets.");
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Backtest failed: ${(e as Error).message}` }]);
    } finally {
      setBtBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? close() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-background border-l border-border">
        <SheetHeader className="px-4 py-3 border-b border-border space-y-1">
          <SheetTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold">
            <Brain className="h-3.5 w-3.5 text-primary" /> Research Copilot
          </SheetTitle>
          <SheetDescription className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {context ? `Context · ${context.title}` : "Ask anything about the models, positioning, or macro regime"}
          </SheetDescription>
        </SheetHeader>

        {context && (
          <div className="px-4 py-2 border-b border-border bg-surface-2/40 text-[10px] font-mono tabular-nums flex items-center justify-between">
            <span className="text-muted-foreground uppercase tracking-wider">Value</span>
            <span className="text-surface-foreground font-semibold">{context.value.toFixed(2)}{context.unit ?? ""}</span>
            {context.thresholdHi != null && (
              <>
                <span className="text-muted-foreground uppercase tracking-wider ml-3">Hi</span>
                <span>{context.thresholdHi}</span>
              </>
            )}
            {context.thresholdLo != null && (
              <>
                <span className="text-muted-foreground uppercase tracking-wider ml-3">Lo</span>
                <span>{context.thresholdLo}</span>
              </>
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 text-sm">
          {messages.length === 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggestions</div>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs px-2.5 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {context && (
                <button
                  onClick={runBacktest}
                  disabled={btBusy}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider px-3 py-2 bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
                >
                  {btBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                  Run Historical Backtest
                </button>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs">
                    {m.content}
                  </div>
                </div>
              )}
              {m.role === "tool" && (
                <div className="border border-border bg-surface-2/40 rounded-sm p-2 text-[10px] font-mono">
                  <div className="uppercase tracking-wider text-primary mb-1">⚙ tool · {m.toolName}</div>
                  <div className="text-muted-foreground line-clamp-3">{m.content}</div>
                </div>
              )}
              {m.role === "assistant" && (
                <div className="text-surface-foreground prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:text-surface-foreground prose-strong:text-surface-foreground">
                  <ReactMarkdown>{m.content || (busy && i === messages.length - 1 ? "_Thinking..._" : "")}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {backtest && <BacktestPanel bt={backtest} unit={context?.unit} />}
        </div>

        <div className="border-t border-border p-3 flex items-end gap-2">
          {context && messages.length > 0 && (
            <button
              onClick={runBacktest}
              disabled={btBusy}
              title="Run backtest"
              className="h-8 w-8 grid place-items-center border border-border rounded-sm hover:border-primary text-muted-foreground hover:text-primary shrink-0"
            >
              {btBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
            </button>
          )}
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask the copilot..."
            className="flex-1 resize-none bg-surface border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
          />
          <Button onClick={() => send()} disabled={busy || !input.trim()} size="sm" className={cn("h-8 shrink-0")}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BacktestPanel({ bt, unit }: { bt: BacktestResult; unit?: string }) {
  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-primary" /> Backtest · {bt.title}
        </div>
        <span className="text-[9px] font-mono uppercase text-muted-foreground">
          {bt.occurrences} fires · {bt.windowYears}y
        </span>
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left py-1 pl-3">Horizon</th>
            <th className="text-right py-1">Mean</th>
            <th className="text-right py-1">Hit%</th>
            <th className="text-right py-1">Sharpe</th>
            <th className="text-right py-1 pr-3">MaxDD</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {bt.horizonStats.map((h) => (
            <tr key={h.horizonDays} className="border-t border-border/50">
              <td className="py-1 pl-3">{h.horizonDays}d</td>
              <td className={`py-1 text-right ${h.meanRet >= 0 ? "text-success" : "text-destructive"}`}>
                {h.meanRet >= 0 ? "+" : ""}{h.meanRet}%
              </td>
              <td className="py-1 text-right">{h.hitRate}%</td>
              <td className="py-1 text-right">{h.sharpe}</td>
              <td className="py-1 pr-3 text-right text-destructive">{h.maxDD}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground italic">
        {bt.regimeNote}
      </div>
      <div className="px-3 py-2 border-t border-border">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Recent fires</div>
        <div className="flex flex-wrap gap-1">
          {bt.examples.map((e, i) => (
            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-2/60 border border-border rounded-sm">
              {e.date} @ {e.triggerValue}{unit ?? ""}
              <span className={`ml-1 ${e.fwd21d >= 0 ? "text-success" : "text-destructive"}`}>
                {e.fwd21d >= 0 ? "+" : ""}{e.fwd21d}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Floating launcher
export function CopilotLauncher() {
  const { openCopilot, open } = useCopilot();
  if (open) return null;
  return (
    <button
      onClick={() => openCopilot()}
      className="fixed bottom-4 right-4 z-40 h-11 px-3.5 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 text-[11px] uppercase tracking-[0.16em] font-semibold"
      title="Open Research Copilot (⌘K)"
    >
      <Sparkles className="h-3.5 w-3.5" /> Copilot
      <kbd className="ml-1 text-[9px] opacity-80 font-mono">⌘K</kbd>
    </button>
  );
}
