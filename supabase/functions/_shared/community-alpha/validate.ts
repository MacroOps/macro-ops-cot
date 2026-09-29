// Validates AI-extracted ideas before saving. Code, not the AI, builds
// permalink, timestamp, channel, and author name.
import { DateTime } from "npm:luxon@3";
import {
  CA_DIRECTIONS,
  CA_IDEA_TYPES,
  CA_ONE_LINER_MAX_WORDS,
  type CaChannel,
  SLACK_WORKSPACE_HOST,
} from "./config.ts";
import type { SlackMessage } from "./filters.ts";
import { CA_ZONE, slackTsToMicros } from "./window.ts";

/** Shape the AI returns (structured output). */
export interface RawIdea {
  source_ts: string;
  author_id: string;
  idea_type: string;
  tickers: string[];
  direction: string;
  label: string;
  one_liner: string;
  technical: boolean;
}

/** Stored idea — identical field set to the imported archive. */
export interface CaIdea {
  author_id: string;
  author_name: string;
  channel_id: string;
  channel_name: string;
  direction: string;
  idea_type: string;
  label: string;
  one_liner: string;
  permalink: string;
  posted_at_iso: string;
  technical: boolean;
  tickers: string;
}

export interface ValidateContext {
  channel: CaChannel;
  /** Messages we fetched and kept after filtering, keyed by ts. */
  fetched: Map<string, SlackMessage>;
  /** Team + private IDs combined. */
  excludedIds: ReadonlySet<string>;
  /** author_id -> display name (from users.info). */
  names: Map<string, string>;
}

export type RejectReason =
  | "unknown_source"
  | "author_mismatch"
  | "excluded_author"
  | "bad_idea_type"
  | "bad_direction"
  | "bad_tickers"
  | "bad_label"
  | "bad_one_liner"
  | "bad_technical"
  | "general_requires_ticker_direction";

export interface ValidateResult {
  ideas: CaIdea[];
  rejected: { source_ts: string; reason: RejectReason }[];
}

export function buildPermalink(channelId: string, msg: SlackMessage): string {
  const p = `https://${SLACK_WORKSPACE_HOST}/archives/${channelId}/p${msg.ts.replace(".", "")}`;
  if (msg.thread_ts && msg.thread_ts !== msg.ts) {
    return `${p}?thread_ts=${msg.thread_ts}&cid=${channelId}`;
  }
  return p;
}

export function tsToPtIso(ts: string): string {
  const ms = Number(slackTsToMicros(ts) / 1000n);
  // Archive format: whole seconds with PT offset, e.g. 2026-09-24T09:34:20-07:00
  return DateTime.fromMillis(Math.floor(ms / 1000) * 1000, { zone: CA_ZONE }).toISO({ suppressMilliseconds: true })!;
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-=/^!]{0,19}$/;

export function normalizeTickers(t: unknown): string[] | null {
  if (!Array.isArray(t)) return null;
  const out: string[] = [];
  for (const x of t) {
    if (typeof x !== "string") return null;
    const v = x.trim().replace(/^\$/, "").toUpperCase();
    if (!TICKER_RE.test(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function check(raw: RawIdea, ctx: ValidateContext): RejectReason | CaIdea {
  const msg = ctx.fetched.get(raw.source_ts);
  if (!msg) return "unknown_source";
  if (!msg.user || raw.author_id !== msg.user) return "author_mismatch";
  if (ctx.excludedIds.has(msg.user)) return "excluded_author";
  if (!(CA_IDEA_TYPES as readonly string[]).includes(raw.idea_type)) return "bad_idea_type";
  if (!(CA_DIRECTIONS as readonly string[]).includes(raw.direction)) return "bad_direction";
  const tickers = normalizeTickers(raw.tickers);
  if (!tickers) return "bad_tickers";
  if (raw.idea_type === "ticker+direction" && tickers.length === 0) return "bad_tickers";
  if (ctx.channel.strict && (raw.idea_type !== "ticker+direction" || tickers.length === 0)) {
    return "general_requires_ticker_direction";
  }
  if (typeof raw.label !== "string" || !raw.label.trim() || raw.label.length > 80) return "bad_label";
  if (
    typeof raw.one_liner !== "string" || !raw.one_liner.trim() ||
    wordCount(raw.one_liner) > CA_ONE_LINER_MAX_WORDS
  ) return "bad_one_liner";
  if (typeof raw.technical !== "boolean") return "bad_technical";

  return {
    author_id: msg.user,
    author_name: ctx.names.get(msg.user) ?? msg.user,
    channel_id: ctx.channel.id,
    channel_name: ctx.channel.name,
    direction: raw.direction,
    idea_type: raw.idea_type,
    label: raw.label.trim(),
    one_liner: raw.one_liner.trim(),
    permalink: buildPermalink(ctx.channel.id, msg),
    posted_at_iso: tsToPtIso(msg.ts),
    technical: raw.technical,
    tickers: tickers.join(", "),
  };
}

export function validateIdeas(raws: RawIdea[], ctx: ValidateContext): ValidateResult {
  const res: ValidateResult = { ideas: [], rejected: [] };
  for (const raw of raws) {
    const r = check(raw, ctx);
    if (typeof r === "string") res.rejected.push({ source_ts: String(raw?.source_ts ?? ""), reason: r });
    else res.ideas.push(r);
  }
  return res;
}
