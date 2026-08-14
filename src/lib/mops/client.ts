import { supabase } from "@/integrations/supabase/client";
import type { MopsPath } from "./types";

export type MopsParams = Record<string, string | number | boolean | Array<string | number> | undefined | null>;

export interface MopsCallOpts {
  path: MopsPath | string;
  params?: MopsParams;
  method?: "GET" | "POST";
  body?: unknown;
}

// Upstream enforces 100 requests / rolling 60s per API key (shared across the
// whole app). Cap in-flight requests so a page that mounts a dozen hooks at
// once doesn't burn the budget in a single burst.
const MAX_CONCURRENT = 4;
const MIN_GAP_MS = 120; // ~8 rps ceiling, well under 100/min sustained
let active = 0;
let lastStart = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active++;
  const gap = MIN_GAP_MS - (Date.now() - lastStart);
  if (gap > 0) await sleep(gap);
  lastStart = Date.now();
}

function release() {
  active--;
  waiters.shift()?.();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MopsError extends Error {
  status?: number;
  retryAfter?: number | null;
  path?: string;
  constructor(message: string, opts: { status?: number; retryAfter?: number | null; path?: string } = {}) {
    super(message);
    this.name = "MopsError";
    this.status = opts.status;
    this.retryAfter = opts.retryAfter ?? null;
    this.path = opts.path;
  }
}

const MAX_ATTEMPTS = 4;
const isRetryable = (status?: number) => status === 429 || (status !== undefined && status >= 500);

// Normalize response envelope. Upstream returns either
//   { data: [...] } | { data: {...} } | [...] | scalar
// We surface the inner payload directly.
export async function mops<T = unknown>({ path, params = {}, method = "GET", body }: MopsCallOpts): Promise<T> {
  const cleanParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    cleanParams[k] = v;
  }

  let lastError: MopsError | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await acquire();
    let data: unknown;
    let error: { message?: string } | null;
    try {
      ({ data, error } = await supabase.functions.invoke("macro-ops-proxy", {
        body: { path, params: cleanParams, method, body },
      }));
    } finally {
      release();
    }

    if (error) {
      lastError = new MopsError(error.message ?? "macro-ops-proxy error", { path: String(path) });
      throw lastError;
    }

    if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
      const e = data as { error: string; status?: number; retry_after?: number | null; body?: string };
      lastError = new MopsError(
        `${e.error}${e.status ? ` (${e.status})` : ""}${e.body ? `: ${e.body.slice(0, 200)}` : ""}`,
        { status: e.status, retryAfter: e.retry_after ?? null, path: String(path) },
      );

      if (attempt < MAX_ATTEMPTS && isRetryable(e.status)) {
        // Honor Retry-After when the API sends one (it does on 429: 60s),
        // otherwise fall back to exponential backoff with jitter.
        const backoff = Math.min(30_000, 500 * 2 ** (attempt - 1)) + Math.random() * 250;
        const waitMs = lastError.retryAfter != null ? lastError.retryAfter * 1000 + 250 : backoff;
        await sleep(waitMs);
        continue;
      }
      throw lastError;
    }

    if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
      return (data as { data: T }).data;
    }
    return data as T;
  }

  throw lastError ?? new MopsError("macro-ops-proxy error", { path: String(path) });
}

// Convenience wrappers ------------------------------------------------------
export const mopsGet = <T = unknown>(path: MopsPath | string, params: MopsParams = {}) =>
  mops<T>({ path, params });

export const mopsPipe = <T = unknown>(steps: Array<Record<string, unknown>>, date?: string) =>
  mops<T>({ path: "/v1/pipe", method: "POST", body: { steps, date } });
