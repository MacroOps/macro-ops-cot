// Since-signal returns for Dual Trend tables. The daily dual-trend-returns-job
// saves return + net per symbol + start date + as-of date in dual_trend_returns;
// the table only reads that table (no price calls on page load). When today's
// job hasn't run, the newest earlier row for the SAME start date is used and its
// as-of date is shown; a start date with no saved row stays blank (dash).
import { outsetaEdgePostStatus } from "@/lib/outseta/edge";

export type Ret = { ret: number | null; net: number | null; asOf: string };
export interface ReturnRequest { symbol: string; start: string }
export interface SavedReturn { symbol: string; start_date: string; as_of: string; ret: number | null; net: number | null }

export const BATCH_SIZE = 40;   // symbols per read (≤ 2 starts × ~10 days each, under the 1000-row cap)
const LOOKBACK_DAYS = 15;

export const returnsCacheKey = (symbol: string, start: string, asOf: string) =>
  `${symbol.toUpperCase()}|${start}|${asOf}`;

const mem = new Map<string, Ret | null>();

export function getCachedReturn(symbol: string, start: string, asOf: string): Ret | undefined {
  return mem.get(returnsCacheKey(symbol, start, asOf)) ?? undefined;
}

/** Newest saved row on or before asOf for each symbol + start date. Never crosses start dates. */
export function pickLatest(rows: SavedReturn[], asOf: string): Map<string, Ret> {
  const out = new Map<string, Ret>();
  for (const r of rows) {
    if (r.as_of > asOf) continue;
    const k = `${r.symbol.toUpperCase()}|${r.start_date}`;
    const cur = out.get(k);
    if (!cur || r.as_of > cur.asOf) {
      out.set(k, {
        ret: r.ret === null ? null : Number(r.ret),
        net: r.net === null ? null : Number(r.net),
        asOf: r.as_of,
      });
    }
  }
  return out;
}

export type ReturnsFetcher = (symbols: string[], from: string, asOf: string) => Promise<SavedReturn[]>;

const defaultFetcher: ReturnsFetcher = async (symbols, from, asOf) => {
  const { rows } = await outsetaEdgePostStatus<{ rows: SavedReturn[] }>("dual-trend-read", { op: "returns", symbols, from, asOf });
  return rows ?? [];
};

const minusDays = (iso: string, d: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") - d * 86_400_000).toISOString().slice(0, 10);

/** Read saved returns for every request not already cached for this as-of date. */
export async function loadReturns(
  reqs: ReturnRequest[],
  asOf: string,
  onBatch?: () => void,
  fetcher: ReturnsFetcher = defaultFetcher,
): Promise<void> {
  const pending = reqs.filter((r) => r.start && !mem.has(returnsCacheKey(r.symbol, r.start, asOf)));
  const symbols = [...new Set(pending.map((r) => r.symbol.toUpperCase()))];
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) chunks.push(symbols.slice(i, i + BATCH_SIZE));
  const from = minusDays(asOf, LOOKBACK_DAYS);
  await Promise.all(chunks.map(async (chunk) => {
    let rows: SavedReturn[] = [];
    try { rows = await fetcher(chunk, from, asOf); } catch { return; }
    const picked = pickLatest(rows, asOf);
    const inChunk = new Set(chunk);
    for (const r of pending) {
      if (!inChunk.has(r.symbol.toUpperCase())) continue;
      mem.set(returnsCacheKey(r.symbol, r.start, asOf), picked.get(`${r.symbol.toUpperCase()}|${r.start}`) ?? null);
    }
    onBatch?.();
  }));
}

/** Newest as-of date among the returns shown (for the "returns as of" label). */
export function returnsAsOf(reqs: ReturnRequest[], asOf: string): string {
  let best = "";
  for (const r of reqs) {
    const v = getCachedReturn(r.symbol, r.start, asOf);
    if (v && v.asOf > best) best = v.asOf;
  }
  return best;
}

export function __resetReturnsMemory() { mem.clear(); }
