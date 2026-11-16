// Saved Dual Trend data (written daily by dual-trend-returns-job). Pages read
// members and signals from the database only; no Macro Ops calls on page load.
// Only days marked "full" in dual_trend_signal_days are shown (never a half-saved day).
import { outsetaEdgePostStatus } from "@/lib/outseta/edge";
import type { DtKey } from "./build";

export interface SignalDay { as_of: string; kind: string }

/** Newest fully saved day (signals + members). "" when none yet. */
export const latestFullDay = (days: SignalDay[]) =>
  days.filter((d) => d.kind === "full").map((d) => d.as_of).sort().reverse()[0] ?? "";

/** Saved as-of date `n` trading days before asOf (any saved kind), or "" if not saved. */
export function priorSavedDay(days: SignalDay[], asOf: string, n = 5): string {
  const before = [...new Set(days.map((d) => d.as_of))].filter((d) => d < asOf).sort().reverse();
  return before[n - 1] ?? "";
}

export async function readSignalDays(): Promise<SignalDay[]> {
  const { rows } = await outsetaEdgePostStatus<{ rows: SignalDay[] }>("dual-trend-read", { op: "days" });
  return rows ?? [];
}

export interface SavedMember { universe: string; symbol: string; name: string | null; sub_group: string | null }

export const readMembers = async (asOf: string, universes: string[]) =>
  (await outsetaEdgePostStatus<{ rows: SavedMember[] }>("dual-trend-read", { op: "members", asOf, universes })).rows ?? [];

/** symbol -> key -> value, exactly as the API returned them. */
export async function readSignals(asOf: string): Promise<Record<DtKey, Map<string, number>>> {
  const { rows } = await outsetaEdgePostStatus<{ rows: { symbol: string; vals: Record<string, number> }[] }>(
    "dual-trend-read", { op: "signals", asOf });
  return toKeyMaps(rows);
}

export function toKeyMaps(rows: { symbol: string; vals: Record<string, number> | null }[]) {
  const maps = {} as Record<string, Map<string, number>>;
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.vals ?? {})) {
      if (v === null || v === undefined || !Number.isFinite(Number(v))) continue;
      (maps[k] ??= new Map()).set(r.symbol.toUpperCase(), Number(v));
    }
  }
  return new Proxy(maps, { get: (t, k: string) => t[k] ?? new Map() }) as Record<DtKey, Map<string, number>>;
}
