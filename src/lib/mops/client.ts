import { supabase } from "@/integrations/supabase/client";
import type { MopsPath } from "./types";

export type MopsParams = Record<string, string | number | boolean | Array<string | number> | undefined | null>;

export interface MopsCallOpts {
  path: MopsPath | string;
  params?: MopsParams;
  method?: "GET" | "POST";
  body?: unknown;
}

// Normalize response envelope. Upstream returns either
//   { data: [...] } | { data: {...} } | [...] | scalar
// We surface the inner payload directly.
export async function mops<T = unknown>({ path, params = {}, method = "GET", body }: MopsCallOpts): Promise<T> {
  const cleanParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    cleanParams[k] = v;
  }

  const { data, error } = await supabase.functions.invoke("macro-ops-proxy", {
    body: { path, params: cleanParams, method, body },
  });

  if (error) throw new Error(error.message ?? "macro-ops-proxy error");
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const e = data as { error: string; status?: number; body?: string };
    throw new Error(`${e.error}${e.status ? ` (${e.status})` : ""}${e.body ? `: ${e.body.slice(0, 200)}` : ""}`);
  }

  if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
    return (data as { data: T }).data;
  }
  return data as T;
}

// Convenience wrappers ------------------------------------------------------
export const mopsGet = <T = unknown>(path: MopsPath | string, params: MopsParams = {}) =>
  mops<T>({ path, params });

export const mopsPipe = <T = unknown>(steps: Array<Record<string, unknown>>, date?: string) =>
  mops<T>({ path: "/v1/pipe", method: "POST", body: { steps, date } });
