import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, BarChart3, Loader2, Brain, Wrench, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCopilot } from "./CopilotContext";
import { cn } from "@/lib/utils";
import { persistRun } from "@/lib/backtest/persistence";

type Role = "user" | "assistant";
interface ToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  ms: number;
}
interface Msg { role: Role; content: string; toolEvents?: ToolEvent[] }

const SUGGESTIONS = [
  "Scan for extreme readings right now.",
  "What's the read on Trend Fragility — and run a backtest at the current level.",
  "Find historical analogs to today's Risk-On Composite.",
  "Which breadth indicator is most stretched, and what typically happens next?",
];

export function CopilotDrawer() {
  const { open, close, context, pageContext, seedPrompt } = useCopilot();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput(seedPrompt ?? "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, seedPrompt, context?.seed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-agent", {
        body: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: context ?? undefined,
          page_context: pageContext,
        },
      });
      if (error) throw error;
      const payload = data as { text?: string; tool_events?: ToolEvent[]; error?: string };
      if (payload.error) throw new Error(payload.error);
      setMessages((m) => [...m, { role: "assistant", content: payload.text ?? "", toolEvents: payload.tool_events ?? [] }]);

      // Best-effort: persist any backtests the agent ran
      (payload.tool_events ?? [])
        .filter((e) => e.name === "run_backtest")
        .forEach((e) => {
          const r = e.result as Record<string, unknown>;
          if (!r || r.error) return;
          persistRun({
            source: "copilot",
            indicatorKey: String(r.key ?? "unknown"),
            symbol: null,
            params: { condition: r.condition, threshold: r.threshold, horizon_days: r.horizon_days },
            stats: {
              count: r.occurrences,
              mean_return: r.mean_return,
              hit_rate: r.hit_rate,
              sharpe: r.sharpe,
            },
            label: `${r.label} ${r.condition} ${r.threshold} · ${r.horizon_days}d`,
          }).then((row) => {
            if (row) window.dispatchEvent(new CustomEvent("mhud:bt-runs-changed"));
          });
        });
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function runContextBacktest() {
    if (!context) return;
    const dir = context.thresholdHi != null && context.value >= context.thresholdHi * 0.7 ? "above" : "below";
    send(`Run a backtest on ${context.title} when it's ${dir} ${dir === "above" ? (context.thresholdHi ?? 75) : (context.thresholdLo ?? 25)}${context.unit ?? ""} at 21-day horizon, then summarize positioning implications.`);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? close() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col bg-background border-l border-border">
        <SheetHeader className="px-4 py-3 border-b border-border space-y-1">
          <SheetTitle className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold">
            <Brain className="h-3.5 w-3.5 text-primary" /> Research Copilot
            <span className="ml-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded-sm px-1.5 py-0.5">
              agent · 5 tools
            </span>
          </SheetTitle>
          <SheetDescription className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {context ? `Context · ${context.title}` : "Asks live tools for indicator values, extremes, backtests & analogs"}
          </SheetDescription>
        </SheetHeader>

        {context && (
          <div className="px-4 py-2 border-b border-border bg-surface-2/40 text-[10px] font-mono tabular-nums flex items-center justify-between">
            <span className="text-muted-foreground uppercase tracking-wider">Value</span>
            <span className="text-surface-foreground font-semibold">{context.value.toFixed(2)}{context.unit ?? ""}</span>
            {context.thresholdHi != null && (<><span className="text-muted-foreground uppercase tracking-wider ml-3">Hi</span><span>{context.thresholdHi}</span></>)}
            {context.thresholdLo != null && (<><span className="text-muted-foreground uppercase tracking-wider ml-3">Lo</span><span>{context.thresholdLo}</span></>)}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 text-sm">
          {messages.length === 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Try asking</div>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs px-2.5 py-1.5 border border-border rounded-sm hover:border-primary hover:text-primary transition-colors"
                  >
                    <ChevronRight className="inline h-3 w-3 mr-1 opacity-60" />{s}
                  </button>
                ))}
              </div>
              {context && (
                <button
                  onClick={runContextBacktest}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider px-3 py-2 bg-primary text-primary-foreground rounded-sm hover:opacity-90"
                >
                  <BarChart3 className="h-3 w-3" /> Backtest This Chart
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
              {m.role === "assistant" && (
                <div className="space-y-2">
                  {m.toolEvents && m.toolEvents.length > 0 && (
                    <Accordion type="multiple" className="border border-border rounded-sm bg-surface-2/30">
                      {m.toolEvents.map((ev) => (
                        <AccordionItem key={ev.id} value={ev.id} className="border-b border-border last:border-b-0 px-2">
                          <AccordionTrigger className="py-1.5 hover:no-underline">
                            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                              <Wrench className="h-3 w-3 text-primary" />
                              <span className="text-primary">{ev.name}</span>
                              <span className="text-muted-foreground normal-case">
                                {summarizeToolResult(ev)}
                              </span>
                              <span className="ml-auto text-[9px] text-muted-foreground">{ev.ms}ms</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2">
                            <ToolBody event={ev} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                  {m.content && (
                    <div className="text-surface-foreground prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:text-surface-foreground prose-strong:text-surface-foreground prose-a:text-primary">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="animate-pulse">Thinking & calling tools…</span>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask the agent — it can scan, query, backtest, find analogs…"
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

function summarizeToolResult(ev: ToolEvent): string {
  const r = ev.result as Record<string, unknown>;
  if (!r) return "";
  if (r.error) return String(r.error);
  switch (ev.name) {
    case "list_indicators":  return `${r.count} indicators`;
    case "query_indicator":  return `${r.label} ${r.value}${r.unit ?? ""} · ${r.percentile}th %ile · ${r.flag}`;
    case "scan_extremes":    return `${r.count} extremes`;
    case "run_backtest":     return `${r.occurrences} fires · ${r.hit_rate}% hit · ${(r.mean_return as number) >= 0 ? "+" : ""}${r.mean_return}% mean · sharpe ${r.sharpe}`;
    case "find_analogs": {
      const an = r.analogs as unknown[];
      return `${an?.length ?? 0} analogs · fwd21d ${(r.fwd_21d_mean as number) >= 0 ? "+" : ""}${r.fwd_21d_mean}%`;
    }
    default: return "";
  }
}

function ToolBody({ event }: { event: ToolEvent }) {
  const r = event.result as Record<string, unknown>;
  if (!r) return null;
  if (r.error) return <div className="text-[11px] text-destructive font-mono">{String(r.error)}</div>;

  if (event.name === "scan_extremes") {
    const rows = r.extremes as Array<Record<string, unknown>>;
    return (
      <table className="w-full text-[11px] font-mono tabular-nums">
        <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="text-left">Indicator</th><th className="text-right">Value</th><th className="text-right">%ile</th><th className="text-right">Flag</th></tr>
        </thead>
        <tbody>
          {rows?.slice(0, 8).map((row, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="py-0.5">{String(row.label)}</td>
              <td className="text-right">{Number(row.value).toFixed(2)}{String(row.unit ?? "")}</td>
              <td className="text-right">{String(row.percentile)}</td>
              <td className="text-right text-[9px] uppercase">{String(row.flag)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (event.name === "run_backtest") {
    const ex = r.examples as Array<{ date: string; trigger: number; fwd: number }>;
    return (
      <div className="space-y-1.5 text-[11px] font-mono tabular-nums">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Hit" v={`${r.hit_rate}%`} />
          <Stat label="Mean" v={`${(r.mean_return as number) >= 0 ? "+" : ""}${r.mean_return}%`} />
          <Stat label="Sharpe" v={String(r.sharpe)} />
          <Stat label="N" v={String(r.occurrences)} />
        </div>
        {ex?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {ex.map((e, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 border border-border rounded-sm">
                {e.date} @ {e.trigger}
                <span className={`ml-1 ${e.fwd >= 0 ? "text-success" : "text-destructive"}`}>
                  {e.fwd >= 0 ? "+" : ""}{e.fwd}%
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (event.name === "find_analogs") {
    const an = r.analogs as Array<{ date: string; value: number; fwd_5d: number; fwd_21d: number }>;
    return (
      <table className="w-full text-[11px] font-mono tabular-nums">
        <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="text-left">Date</th><th className="text-right">Value</th><th className="text-right">Fwd 5d</th><th className="text-right">Fwd 21d</th></tr>
        </thead>
        <tbody>
          {an?.map((a, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="py-0.5">{a.date}</td>
              <td className="text-right">{a.value}</td>
              <td className={`text-right ${a.fwd_5d >= 0 ? "text-success" : "text-destructive"}`}>{a.fwd_5d >= 0 ? "+" : ""}{a.fwd_5d}%</td>
              <td className={`text-right ${a.fwd_21d >= 0 ? "text-success" : "text-destructive"}`}>{a.fwd_21d >= 0 ? "+" : ""}{a.fwd_21d}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (event.name === "query_indicator") {
    return (
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
        <Stat label="Value" v={`${r.value}${String(r.unit ?? "")}`} />
        <Stat label="%ile" v={String(r.percentile)} />
        <Stat label="Δ 1w" v={`${(r.delta_1w as number) >= 0 ? "+" : ""}${r.delta_1w}`} />
        <Stat label="Flag" v={String(r.flag)} />
      </div>
    );
  }
  return (
    <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
      {JSON.stringify(r, null, 2)}
    </pre>
  );
}
function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-surface-foreground">{v}</span>
    </div>
  );
}

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
