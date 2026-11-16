// Since-signal returns for whole tables: batched calls to the symbol-returns
// function, cached by symbol + start date + as-of date (memory + localStorage),
// so returns refresh each trading day and repeat visits that day refetch nothing.
import { supabase } from "@/integrations/supabase/client";

export type Ret = { ret: number | null; net: number | null };
export interface ReturnRequest { symbol: string; start: string }

export const BATCH_SIZE = 50;
const PARALLEL_BATCHES = 3;
const LS_PREFIX = "dt-ret:v1:";

export const returnsCacheKey = (symbol: string, start: string, asOf: string) =>
  `${symbol.toUpperCase()}|${start}|${asOf}`;

const mem = new Map<string, Ret>();

function readLs(k: string): Ret | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + k);
    return raw ? (JSON.parse(raw) as Ret) : undefined;
  } catch {
    return undefined;
  }
}
function writeLs(k: string, v: Ret) {
  try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch { /* quota */ }
}

/** Drop cached entries from earlier as-of dates. */
export function pruneReturnsCache(asOf: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX) && !k.endsWith(`|${asOf}`)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

export function getCachedReturn(symbol: string, start: string, asOf: string): Ret | undefined {
  const k = returnsCacheKey(symbol, start, asOf);
  const m = mem.get(k);
  if (m) return m;
  const l = readLs(k);
  if (l) mem.set(k, l);
  return l;
}

export type BatchFetcher = (items: { symbol: string; dates: string[] }[]) =>
  Promise<Record<string, Record<string, Ret>>>;

const defaultFetcher: BatchFetcher = async (items) => {
  const { data, error } = await supabase.functions.invoke<{ results: Record<string, Record<string, Ret>> }>(
    "symbol-returns",
    { body: { items } },
  );
  if (error) throw error;
  return data?.results ?? {};
};

/**
 * Load returns for all requests not already cached. Calls onBatch after each
 * batch so tables fill in progressively.
 */
export async function loadReturns(
  reqs: ReturnRequest[],
  asOf: string,
  onBatch?: () => void,
  fetcher: BatchFetcher = defaultFetcher,
): Promise<void> {
  const bySymbol = new Map<string, Set<string>>();
  for (const r of reqs) {
    if (!r.start || getCachedReturn(r.symbol, r.start, asOf)) continue;
    const s = bySymbol.get(r.symbol) ?? new Set<string>();
    s.add(r.start);
    bySymbol.set(r.symbol, s);
  }
  const items = [...bySymbol].map(([symbol, dates]) => ({ symbol, dates: [...dates] }));
  const chunks: typeof items[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) chunks.push(items.slice(i, i + BATCH_SIZE));
  let next = 0;
  const run = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      let res: Record<string, Record<string, Ret>> = {};
      try { res = await fetcher(chunk); } catch { continue; }
    for (const it of chunk) {
      for (const d of it.dates) {
        const v = res[it.symbol.toUpperCase()]?.[d];
        if (!v) continue;
        const k = returnsCacheKey(it.symbol, d, asOf);
        mem.set(k, v);
        writeLs(k, v);
      }
    }
    onBatch?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_BATCHES, chunks.length) }, run));
}

export function __resetReturnsMemory() { mem.clear(); }
