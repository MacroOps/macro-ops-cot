import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generateSignalsTape, type ModelSignal } from "@/lib/signals";
import { useCopilot } from "./CopilotContext";
import { Sparkles, ArrowUpRight, ArrowDownRight, AlertTriangle, Radio, Pin, PinOff } from "lucide-react";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

const PINS_KEY = "mhud:signal-pins:v1";
function readPins(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(PINS_KEY) ?? "[]")); } catch { return new Set(); }
}
function writePins(p: Set<string>) {
  localStorage.setItem(PINS_KEY, JSON.stringify([...p]));
}

type SeverityFilter = "all" | "critical" | "warning";
type DirectionFilter = "all" | "bullish" | "bearish";

const CATEGORY_GROUPS: Array<{ id: string; label: string; match: (m: string) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "trend", label: "Trend", match: (m) => /trend/i.test(m) },
  { id: "risk", label: "Risk", match: (m) => /risk|recession/i.test(m) },
  { id: "breadth", label: "Breadth", match: (m) => /breadth|thrust/i.test(m) },
  { id: "tctm", label: "TCTM", match: (m) => /tctm/i.test(m) },
  { id: "liquidity", label: "Liquidity", match: (m) => /liquidity/i.test(m) },
];

export function SignalsTape({ limit = 40 }: { limit?: number }) {
  const all = useMemo(() => generateSignalsTape(limit), [limit]);
  const { openCopilot } = useCopilot();
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [pins, setPins] = useState<Set<string>>(() => readPins());

  function togglePin(id: string) {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writePins(next);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const cat = CATEGORY_GROUPS.find((g) => g.id === category) ?? CATEGORY_GROUPS[0];
    return all.filter((s) => {
      if (severity !== "all" && s.severity !== severity) return false;
      if (direction !== "all" && s.direction !== direction) return false;
      if (!cat.match(s.model)) return false;
      return true;
    });
  }, [all, severity, direction, category]);

  const pinned = filtered.filter((s) => pins.has(s.id));
  const rest = filtered.filter((s) => !pins.has(s.id));
  const ordered = [...pinned, ...rest];

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
      prompt: `Explain the ${sig.model} signal that just fired (${sig.title}). What's the historical base rate and what regime tends to follow?`,
    });
  }

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-primary animate-pulse" />
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-surface-foreground">
            Signals Tape
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            · {filtered.length}/{all.length} fires · last 14d
          </span>
        </div>
        <button
          onClick={() => openCopilot({ prompt: "Summarize the most material model signals that fired in the last 14 days, grouped by regime implication." })}
          className="text-[10px] uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Ask Copilot
        </button>
      </div>

      <div className="px-3 py-1.5 border-b border-border bg-surface/30 flex items-center gap-2 flex-wrap text-[10px]">
        <FilterChips
          options={[{ id: "all", label: "All sev" }, { id: "critical", label: "Critical" }, { id: "warning", label: "Approaching" }]}
          value={severity}
          onChange={(v) => setSeverity(v as SeverityFilter)}
        />
        <span className="text-muted-foreground">·</span>
        <FilterChips
          options={[{ id: "all", label: "Any dir" }, { id: "bullish", label: "Bullish" }, { id: "bearish", label: "Bearish" }]}
          value={direction}
          onChange={(v) => setDirection(v as DirectionFilter)}
        />
        <span className="text-muted-foreground">·</span>
        <FilterChips
          options={CATEGORY_GROUPS.map((c) => ({ id: c.id, label: c.label }))}
          value={category}
          onChange={setCategory}
        />
      </div>

      <div className="max-h-[360px] overflow-auto divide-y divide-border/60">
        {ordered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground italic">No signals match filters.</div>
        )}
        {ordered.map((s) => {
          const isPin = pins.has(s.id);
          const Icon = s.severity === "warning" ? AlertTriangle : s.direction === "bullish" ? ArrowUpRight : ArrowDownRight;
          const tone =
            s.severity === "warning" ? "text-warning" :
            s.direction === "bullish" ? "text-success" : "text-destructive";
          return (
            <div
              key={s.id}
              className={`px-3 py-2 flex items-center gap-3 hover:bg-surface-2/40 group ${isPin ? "bg-primary/5" : ""}`}
            >
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => togglePin(s.id)}
                  className={`text-[10px] grid place-items-center h-5 w-5 rounded-sm transition-opacity ${
                    isPin ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary"
                  }`}
                  title={isPin ? "Unpin" : "Pin"}
                >
                  {isPin ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => ask(s)}
                  className="opacity-0 group-hover:opacity-100 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-opacity"
                >
                  explain
                </button>
                {s.href && (
                  <Link
                    to={s.href}
                    className="opacity-0 group-hover:opacity-100 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded-sm hover:border-primary transition-opacity"
                  >
                    open
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-sm border border-border overflow-hidden">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-1.5 py-0.5 uppercase tracking-wider font-mono transition-colors ${
            value === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
