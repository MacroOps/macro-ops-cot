// Paged /v1/signal list reads. The API caps limit at 1000 and meta.has_more is
// always false, so we keep requesting offset += limit until a short page.
import { mopsGet, type MopsParams } from "./client";
import type { MopsSignalRow } from "./types";

export const SIGNAL_PAGE_LIMIT = 1000;

export type PageFetcher = (params: MopsParams) => Promise<MopsSignalRow[]>;

const defaultFetcher: PageFetcher = (params) => mopsGet<MopsSignalRow[]>("/v1/signal", params);

export async function signalAll(
  params: MopsParams,
  fetchPage: PageFetcher = defaultFetcher,
  limit = SIGNAL_PAGE_LIMIT,
): Promise<MopsSignalRow[]> {
  const out: MopsSignalRow[] = [];
  for (let offset = 0; ; offset += limit) {
    const page = (await fetchPage({ ...params, limit, offset })) ?? [];
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

// Shared in-memory cache so sections (S&P 500/400/600, breadth) reuse the same
// full-universe snapshot for a key + date instead of refetching.
const TTL = 15 * 60_000;
const cache = new Map<string, { at: number; p: Promise<MopsSignalRow[]> }>();

export function signalSnapshot(key: string, date: string, entityType = "symbol"): Promise<MopsSignalRow[]> {
  const ck = `${key}|${date}|${entityType}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = signalAll({ key, date, entity_type: entityType });
  p.catch(() => cache.delete(ck));
  cache.set(ck, { at: Date.now(), p });
  return p;
}

export function toValueMap(rows: MopsSignalRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.value === null || r.value === undefined) continue;
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isNaN(v)) m.set(r.entity, v);
  }
  return m;
}
