import { supabase } from "@/integrations/supabase/client";
import type { TpTable } from "./types";

export type TpParams = Record<string, string | number | undefined | null>;

export async function tpFetch<T = unknown>(table: TpTable, params: TpParams = {}): Promise<T[]> {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    cleaned[k] = String(v);
  }

  const { data, error } = await supabase.functions.invoke("tp-proxy", {
    body: { table, params: cleaned },
  });

  if (error) throw new Error(error.message ?? "tp-proxy error");
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const e = data as { error: string; status?: number; body?: string };
    throw new Error(`${e.error}${e.status ? ` (${e.status})` : ""}${e.body ? `: ${e.body}` : ""}`);
  }

  // Upstream returns either an array of rows or { rows: [...] } / { data: [...] }
  if (Array.isArray(data)) return data as T[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj?.rows)) return obj.rows as T[];
  if (Array.isArray(obj?.data)) return obj.data as T[];
  return [] as T[];
}
