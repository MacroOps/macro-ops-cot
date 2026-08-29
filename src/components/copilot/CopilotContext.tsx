import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams, matchPath } from "react-router-dom";
import { MARKET_LABELS } from "@/lib/marketLabels";
import { useCollectiveAccess } from "@/hooks/useCollectiveAccess";

export interface ChartContext {
  title: string;
  subtitle?: string;
  seed: number;
  value: number;
  min?: number;
  max?: number;
  thresholdHi?: number;
  thresholdLo?: number;
  unit?: string;
  href?: string;
  recent?: Array<{ t: string; v: number }>;
}

export interface PageContext {
  route: string;
  label: string;
  symbol?: string;
  marketName?: string;
}

interface CopilotState {
  open: boolean;
  context: ChartContext | null;
  pageContext: PageContext;
  seedPrompt: string | null;
  openCopilot: (opts?: { context?: ChartContext; prompt?: string }) => void;
  close: () => void;
}

const Ctx = createContext<CopilotState | null>(null);

const ROUTE_LABELS: Array<{ pattern: string; label: string }> = [
  { pattern: "/", label: "Global Positioning Dashboard" },
  { pattern: "/overview", label: "Overview" },
  { pattern: "/briefing", label: "Daily Briefing" },
  { pattern: "/alerts", label: "Alerts" },
  { pattern: "/analogs", label: "Analog Engine" },
  { pattern: "/heatmap", label: "Cross-Asset Heatmap" },
  { pattern: "/offsides", label: "Offsides Positioning" },
  { pattern: "/trend-fragility", label: "Trend Fragility" },
  { pattern: "/risk-cycle", label: "Risk Cycle" },
  { pattern: "/market-internals", label: "Market Internals" },
  { pattern: "/breadth/overview", label: "Breadth · Overview" },
  { pattern: "/breadth/components", label: "Breadth · Components" },
  { pattern: "/breadth/thrusts", label: "Breadth · Thrusts" },
  { pattern: "/breadth/capitulation", label: "Breadth · Capitulation" },
  { pattern: "/sectors", label: "Sector Aggregates" },
  { pattern: "/backtests", label: "Backtests" },
  { pattern: "/news", label: "News Feed" },
  { pattern: "/eurex", label: "Eurex Positioning" },
  { pattern: "/tpmr/market-overview", label: "TPMR · Market Overview" },
  { pattern: "/tpmr/dual-trend", label: "TPMR · Dual Trend" },
  { pattern: "/tpmr/tctm-guide", label: "TPMR · TCTM Guide" },
  { pattern: "/tp/breadth", label: "TP · Breadth" },
  { pattern: "/tp/trend-signals", label: "TP · Trend Signals" },
  { pattern: "/tp/risk-composite", label: "TP · Risk Composite" },
  { pattern: "/tp/sector-trends", label: "TP · Sector Trends" },
];

function derivePageContext(pathname: string, params: Record<string, string | undefined>): PageContext {
  const assetMatch = matchPath("/asset/:symbol", pathname);
  if (assetMatch) {
    const symbol = (params.symbol ?? assetMatch.params.symbol ?? "").toUpperCase();
    const name = MARKET_LABELS[symbol];
    return {
      route: pathname,
      symbol,
      marketName: name,
      label: name ? `Asset · ${name} (${symbol})` : `Asset · ${symbol}`,
    };
  }
  const hit = ROUTE_LABELS.find((r) => r.pattern === pathname);
  return { route: pathname, label: hit?.label ?? pathname };
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ChartContext | null>(null);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);

  const { hasAccess } = useCollectiveAccess();
  const location = useLocation();
  const params = useParams();
  const pageContext = useMemo(
    () => derivePageContext(location.pathname, params),
    [location.pathname, params],
  );

  const openCopilot = useCallback((opts?: { context?: ChartContext; prompt?: string }) => {
    if (!hasAccess) return;
    setContext(opts?.context ?? null);
    setSeedPrompt(opts?.prompt ?? null);
    setOpen(true);
  }, [hasAccess]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ open, context, pageContext, seedPrompt, openCopilot, close }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCopilot() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCopilot must be used inside <CopilotProvider>");
  return v;
}
