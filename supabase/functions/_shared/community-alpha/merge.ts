// Weekly merge: replace per week, keep a failed channel's previous ideas,
// dedupe by permalink + tickers, cap at 50 (non-#general first, then newest).
import { CA_CHANNELS, CA_MAX_IDEAS_PER_WEEK, channelById } from "./config.ts";
import type { CaIdea } from "./validate.ts";

export type WeekSource = "archive" | "job";

export interface ChannelResult {
  channelId: string;
  ok: boolean;
  /** Validated ideas (ignored when ok = false). */
  ideas: CaIdea[];
}

export interface MergeResult {
  ideas: CaIdea[];
  capDropped: number;
  /** Channels whose previous ideas were kept because they failed this run. */
  keptPrevious: string[];
}

/** Idea identity: permalink + sorted, normalized tickers. */
export function ideaKey(i: Pick<CaIdea, "permalink" | "tickers">): string {
  const t = i.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).sort().join(",");
  return `${i.permalink}|${t}`;
}

const channelRank = (id: string) => {
  const i = CA_CHANNELS.findIndex((c) => c.id === id);
  return i < 0 ? CA_CHANNELS.length : i;
};
const postedMs = (i: CaIdea) => Date.parse(i.posted_at_iso);

export function mergeWeek(
  previous: CaIdea[],
  results: ChannelResult[],
  cap = CA_MAX_IDEAS_PER_WEEK,
): MergeResult {
  const byChannel = new Map(results.map((r) => [r.channelId, r]));
  const keptPrevious: string[] = [];
  const pool: CaIdea[] = [];

  // Failed channels (and channels not in this run) keep their previous ideas.
  const prevChannels = new Set(previous.map((i) => i.channel_id));
  for (const ch of new Set([...prevChannels, ...byChannel.keys()])) {
    const r = byChannel.get(ch);
    if (r && r.ok) pool.push(...r.ideas);
    else {
      const prev = previous.filter((i) => i.channel_id === ch);
      if (r && !r.ok && prev.length) keptPrevious.push(ch);
      pool.push(...prev);
    }
  }

  // Dedupe (first occurrence wins).
  const seen = new Set<string>();
  const unique = pool.filter((i) => {
    const k = ideaKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Cap: non-strict (#general last), then newest first.
  const prioritized = [...unique].sort((a, b) => {
    const sa = channelById(a.channel_id)?.strict ? 1 : 0;
    const sb = channelById(b.channel_id)?.strict ? 1 : 0;
    return sa - sb || postedMs(b) - postedMs(a);
  });
  const kept = prioritized.slice(0, cap);

  // Stable display order: channel order, then newest first.
  kept.sort((a, b) => channelRank(a.channel_id) - channelRank(b.channel_id) || postedMs(b) - postedMs(a));
  return { ideas: kept, capDropped: unique.length - kept.length, keptPrevious };
}

/** Archive protection: 'archive' weeks are only reprocessed on explicit request. */
export function canReprocessWeek(
  existing: { source: WeekSource } | null | undefined,
  opts: { forceArchive?: boolean } = {},
): boolean {
  if (!existing) return true;
  if (existing.source === "archive") return opts.forceArchive === true;
  return true;
}
