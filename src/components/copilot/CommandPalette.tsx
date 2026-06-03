import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useCopilot } from "./CopilotContext";
import { Sparkles, LayoutDashboard, Activity, TrendingDown, Layers, Newspaper, LineChart, Boxes, FlaskConical } from "lucide-react";

const ROUTES = [
  { label: "Overview", to: "/overview", icon: LayoutDashboard },
  { label: "Daily Briefing", to: "/briefing", icon: Sparkles },
  { label: "Backtests Lab", to: "/backtests", icon: FlaskConical },
  { label: "Backtests · History", to: "/backtests?tab=history", icon: FlaskConical },
  { label: "Global Positioning", to: "/", icon: Boxes },
  { label: "Trend Fragility", to: "/trend-fragility", icon: TrendingDown },
  { label: "Risk Cycle", to: "/risk-cycle", icon: Activity },
  { label: "Market Internals", to: "/market-internals", icon: LineChart },
  { label: "Breadth Overview", to: "/breadth/overview", icon: Layers },
  { label: "TPMR Market Overview", to: "/tpmr/market-overview", icon: LineChart },
  { label: "News", to: "/news", icon: Newspaper },
];

const ASKS = [
  "Scan for extreme readings right now.",
  "Run a backtest on Trend Fragility above 75.",
  "Find historical analogs to today's Risk-On Composite.",
  "Which breadth indicator is most stretched, and what typically happens next?",
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { openCopilot } = useCopilot();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, ask the copilot..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Ask the Copilot">
          {ASKS.map((q) => (
            <CommandItem
              key={q}
              onSelect={() => { setOpen(false); openCopilot({ prompt: q }); }}
            >
              <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
              {q}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {ROUTES.map((r) => (
            <CommandItem key={r.to} onSelect={() => { setOpen(false); nav(r.to); }}>
              <r.icon className="mr-2 h-3.5 w-3.5" />
              {r.label}
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">{r.to}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
