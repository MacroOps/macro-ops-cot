// Code-level guards around the AI steps: strict direction-check parsing and same-author merge.
import type { CheckAnswer } from "./extract.ts";

export class DirectionCheckError extends Error {}

const VIEWS = new Set(["positive", "negative", "unclear"]);

/**
 * Accepts the check tool's output only if every idea 0..n-1 has exactly one valid answer.
 * Tolerates `checks` arriving as a JSON string; anything else throws DirectionCheckError.
 */
export function parseCheckAnswers(parsed: unknown, n: number): Map<number, CheckAnswer> {
  let checks: unknown = (parsed as any)?.checks;
  if (typeof checks === "string") {
    try { checks = JSON.parse(checks); } catch { throw new DirectionCheckError("checks is unparseable text"); }
  }
  if (!Array.isArray(checks)) throw new DirectionCheckError("checks is not a list");
  const out = new Map<number, CheckAnswer>();
  for (const c of checks as any[]) {
    const id = Number(c?.id);
    if (!Number.isInteger(id) || id < 0 || id >= n) throw new DirectionCheckError(`bad id ${c?.id}`);
    if (out.has(id)) throw new DirectionCheckError(`duplicate id ${id}`);
    const view = String(c?.author_view ?? "");
    if (!VIEWS.has(view)) throw new DirectionCheckError(`bad author_view for ${id}`);
    out.set(id, { reason: String(c?.reason ?? ""), author_view: view, quote: String(c?.quote ?? "") });
  }
  if (out.size !== n) throw new DirectionCheckError(`answered ${out.size} of ${n}`);
  return out;
}

const firstInstrument = (tickers: string) => (tickers.split(",")[0] ?? "").replace(/\s+/g, "").toUpperCase();

/**
 * Same author + same first instrument (per task = channel + week): keep only the latest message's idea.
 * Returns kept indexes (original order) and dropped indexes.
 */
export function mergeSameAuthor(
  items: { author_id: string; tickers: string; source_ts: string }[],
): { keep: number[]; dropped: number[] } {
  const best = new Map<string, number>();
  items.forEach((it, i) => {
    const k = `${it.author_id}|${firstInstrument(it.tickers)}`;
    const j = best.get(k);
    if (j === undefined || Number(it.source_ts) > Number(items[j].source_ts)) best.set(k, i);
  });
  const keepSet = new Set(best.values());
  const keep: number[] = [], dropped: number[] = [];
  items.forEach((_, i) => (keepSet.has(i) ? keep : dropped).push(i));
  return { keep, dropped };
}

/**
 * Second look: messages that produced no kept idea are candidates; other messages in the
 * candidates' threads (first-pass sources) go along as context only.
 */
export function selectSecondLook<M extends { ts: string; thread_ts?: string }>(kept: M[], usedTs: ReadonlySet<string>) {
  const rootOf = (m: M) => (m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : m.ts);
  const candidates = kept.filter((m) => !usedTs.has(m.ts));
  const roots = new Set(candidates.map(rootOf));
  const mates = kept.filter((m) => usedTs.has(m.ts) && roots.has(rootOf(m)));
  return { candidates, mates };
}
