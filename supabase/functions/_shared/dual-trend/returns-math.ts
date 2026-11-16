// Pure math + helpers for the daily Dual Trend returns job (also unit-tested).
export interface PriceRow { date: string; close: number }
export type Ret = { ret: number | null; net: number | null };

/** Last close on or before `date` (rows sorted ascending). */
export function closeOnOrBefore(rows: PriceRow[], date: string): number | null {
  let v: number | null = null;
  for (const r of rows) {
    if (r.date > date) break;
    if (typeof r.close === "number" && r.close > 0) v = r.close;
  }
  return v;
}

/** Percent return from start to as-of; null when either close is missing. */
export function pctReturn(rows: PriceRow[], start: string, asOf: string): number | null {
  const a = closeOnOrBefore(rows, start);
  const b = closeOnOrBefore(rows, asOf);
  return a && b ? (b / a - 1) * 100 : null;
}

export function computeReturn(sym: PriceRow[], bench: PriceRow[], start: string, asOf: string): Ret {
  const ret = pctReturn(sym, start, asOf);
  const b = pctReturn(bench, start, asOf);
  return { ret, net: ret !== null && b !== null ? ret - b : null };
}

export function epochDaysToIso(v: unknown): string {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return "";
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** One entry per symbol (uppercased), merging start dates from every universe. */
export function buildWorkList(entries: { symbol: string; starts: string[] }[]) {
  const m = new Map<string, Set<string>>();
  for (const e of entries) {
    const s = String(e.symbol ?? "").trim().toUpperCase();
    if (!s) continue;
    const set = m.get(s) ?? new Set<string>();
    for (const d of e.starts) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
    m.set(s, set);
  }
  return [...m].map(([symbol, set]) => ({ symbol, starts: [...set].sort() })).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Spaces calls so no 60s window holds more than `perMinute` requests. */
export function makeThrottle(perMinute: number, now: () => number = Date.now, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  const gap = Math.ceil(60_000 / perMinute);
  let last = -Infinity;
  return async () => {
    const wait = last + gap - now();
    if (wait > 0) await sleep(wait);
    last = Math.max(now(), last + gap);
  };
}
