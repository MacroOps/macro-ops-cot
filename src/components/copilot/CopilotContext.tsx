import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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

interface CopilotState {
  open: boolean;
  context: ChartContext | null;
  seedPrompt: string | null;
  openCopilot: (opts?: { context?: ChartContext; prompt?: string }) => void;
  close: () => void;
}

const Ctx = createContext<CopilotState | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ChartContext | null>(null);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);

  const openCopilot = useCallback((opts?: { context?: ChartContext; prompt?: string }) => {
    setContext(opts?.context ?? null);
    setSeedPrompt(opts?.prompt ?? null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ open, context, seedPrompt, openCopilot, close }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCopilot() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCopilot must be used inside <CopilotProvider>");
  return v;
}
