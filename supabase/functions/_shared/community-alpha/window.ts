// Community Alpha weekly window logic.
// A digest covers (previous Friday 14:00 PT, this Friday 14:00 PT]:
// exclusive start, inclusive end. The "anchor" is the window's end.
// DST is handled by Luxon with the IANA zone America/Los_Angeles.
import { DateTime } from "npm:luxon@3";

export const CA_ZONE = "America/Los_Angeles";
export const ANCHOR_HOUR = 14;

export interface CaWindow {
  /** Friday date (PT) of the window end, YYYY-MM-DD — the week_date. */
  weekDate: string;
  /** Exclusive start (UTC ISO). */
  startIso: string;
  /** Inclusive end = anchor (UTC ISO). */
  endIso: string;
  /** Start/end as Slack-style microsecond integers for exact comparison. */
  startMicros: bigint;
  endMicros: bigint;
}

function toMicros(dt: DateTime): bigint {
  return BigInt(dt.toMillis()) * 1000n;
}

/** Parse a Slack ts ("1727470800.123456") to exact integer microseconds. */
export function slackTsToMicros(ts: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(ts.trim());
  if (!m) throw new Error(`Invalid Slack ts: ${ts}`);
  const frac = (m[2] ?? "").padEnd(6, "0");
  return BigInt(m[1]) * 1_000_000n + BigInt(frac);
}

/** Anchor (Friday 14:00 PT) for a given Friday date string. */
export function anchorForWeekDate(weekDate: string): DateTime {
  const d = DateTime.fromISO(weekDate, { zone: CA_ZONE });
  if (!d.isValid) throw new Error(`Invalid date: ${weekDate}`);
  if (d.weekday !== 5) throw new Error(`${weekDate} is not a Friday`);
  return d.set({ hour: ANCHOR_HOUR, minute: 0, second: 0, millisecond: 0 });
}

/** Build the window that ends at the given Friday. */
export function windowForWeekDate(weekDate: string): CaWindow {
  const end = anchorForWeekDate(weekDate);
  // minus({weeks:1}) keeps local wall time, so DST weeks stay at 14:00 PT.
  const start = end.minus({ weeks: 1 });
  return {
    weekDate: end.toISODate()!,
    startIso: start.toUTC().toISO()!,
    endIso: end.toUTC().toISO()!,
    startMicros: toMicros(start),
    endMicros: toMicros(end),
  };
}

/** Most recent anchor that is <= now (i.e. the latest closed window end). */
export function latestClosedAnchor(now: Date): DateTime {
  const local = DateTime.fromJSDate(now, { zone: CA_ZONE });
  const daysBack = (local.weekday - 5 + 7) % 7; // days since Friday
  let anchor = local
    .minus({ days: daysBack })
    .set({ hour: ANCHOR_HOUR, minute: 0, second: 0, millisecond: 0 });
  if (anchor.toMillis() > local.toMillis()) anchor = anchor.minus({ weeks: 1 });
  return anchor;
}

/**
 * Windows due for processing: every Friday after `lastProcessedWeekDate`
 * whose window has closed by `now`, oldest first. Independent of run time
 * within a week.
 */
export function dueWindows(lastProcessedWeekDate: string, now: Date): CaWindow[] {
  const last = anchorForWeekDate(lastProcessedWeekDate);
  const latest = latestClosedAnchor(now);
  const out: CaWindow[] = [];
  let next = last.plus({ weeks: 1 });
  while (next.toMillis() <= latest.toMillis()) {
    out.push(windowForWeekDate(next.toISODate()!));
    next = next.plus({ weeks: 1 });
  }
  return out;
}

/** True when a Slack message ts falls inside the window (start, end]. */
export function isInWindow(ts: string, w: CaWindow): boolean {
  const t = slackTsToMicros(ts);
  return t > w.startMicros && t <= w.endMicros;
}

/** The Friday week_date whose window contains this Slack ts. */
export function weekDateForTs(ts: string): string {
  const t = slackTsToMicros(ts);
  const ms = Number(t / 1000n);
  const extra = t % 1000n; // sub-ms part
  // A ts exactly on an anchor belongs to the window ending there (inclusive).
  const onOrBefore = latestClosedAnchor(new Date(ms));
  const anchorMicros = BigInt(onOrBefore.toMillis()) * 1000n;
  if (t === anchorMicros || (t < anchorMicros + 1000n && extra === 0n && anchorMicros === t)) {
    return onOrBefore.toISODate()!;
  }
  if (t > anchorMicros) return onOrBefore.plus({ weeks: 1 }).toISODate()!;
  return onOrBefore.toISODate()!;
}
