// Save / load backtest runs to Lovable Cloud.
// Falls back gracefully when the user isn't signed in (returns null).

import { supabase } from "@/integrations/supabase/client";

export type BtSource = "lab" | "copilot" | "chart-toolbar";

export interface BtRunRow {
  id: string;
  user_id: string;
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
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return null;
  // Type assertion: table was added via migration; types.ts may regen async.
  const { data, error } = await (supabase.from as any)("backtest_runs")
    .insert({
      user_id: userId,
      source: input.source,
      indicator_key: input.indicatorKey,
      symbol: input.symbol ?? null,
      params: input.params,
      stats: input.stats,
      label: input.label ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn("[backtest] persistRun failed:", error.message);
    return null;
  }
  return data as BtRunRow;
}

export async function listRuns(limit = 200): Promise<BtRunRow[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user?.id) return [];
  const { data, error } = await (supabase.from as any)("backtest_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[backtest] listRuns failed:", error.message);
    return [];
  }
  return (data ?? []) as BtRunRow[];
}

export async function deleteRun(id: string): Promise<boolean> {
  const { error } = await (supabase.from as any)("backtest_runs").delete().eq("id", id);
  if (error) {
    console.warn("[backtest] deleteRun failed:", error.message);
    return false;
  }
  return true;
}
