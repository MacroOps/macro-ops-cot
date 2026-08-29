// Save / load backtest runs via Outseta JWT (same identity as watchlist).
// Returns null / [] when the user isn't signed in.

import { outsetaEdgePost } from "@/lib/outseta/edge";

export type BtSource = "lab" | "copilot" | "chart-toolbar";

export interface BtRunRow {
  id: string;
  user_id: string | null;
  outseta_person_uid?: string | null;
  source: BtSource;
  indicator_key: string;
  symbol: string | null;
  params: Record<string, unknown>;
  stats: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export interface PersistRunInput {
  source: BtSource;
  indicatorKey: string;
  symbol?: string | null;
  params: Record<string, unknown>;
  stats: Record<string, unknown>;
  label?: string | null;
}

export async function persistRun(input: PersistRunInput): Promise<BtRunRow | null> {
  try {
    const res = await outsetaEdgePost<{ run?: BtRunRow }>("backtest-runs", {
      action: "save",
      source: input.source,
      indicatorKey: input.indicatorKey,
      symbol: input.symbol ?? null,
      params: input.params,
      stats: input.stats,
      label: input.label ?? null,
    });
    return res.run ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Sign in required") return null;
    console.warn("[backtest] persistRun failed:", msg);
    return null;
  }
}

export async function listRuns(limit = 200): Promise<BtRunRow[]> {
  try {
    const res = await outsetaEdgePost<{ runs?: BtRunRow[] }>("backtest-runs", {
      action: "list",
      limit,
    });
    return res.runs ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Sign in required") return [];
    console.warn("[backtest] listRuns failed:", msg);
    return [];
  }
}

export async function deleteRun(id: string): Promise<boolean> {
  try {
    await outsetaEdgePost("backtest-runs", { action: "delete", id });
    return true;
  } catch (e) {
    console.warn("[backtest] deleteRun failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
