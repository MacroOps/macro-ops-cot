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
import { type SlackMessage, summarizeAttachments } from "./filters.ts";
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
  /** ts of context_only messages (pre-window thread parents). Never a valid source. */
  contextTs?: ReadonlySet<string>;
}

export type RejectReason =
  | "unknown_source"
  | "context_only_source"
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
  rejected: { source_ts: string; reason: RejectReason; [k: string]: unknown }[];
  /** Internal-only warnings (e.g. long one-liner). Never shown to members. */
  warnings: { source_ts: string; warning: string }[];
  /** Aligned with ideas[]: source ts per kept idea (for the direction check). */
  review: { source_ts: string; tickers: string; direction: string }[];
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

/** Tickers may be symbols OR names/themes ("Copper", "EU banks"). Only non-empty strings. */
export function normalizeTickers(t: unknown): string[] | null {
  if (!Array.isArray(t)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of t) {
    if (typeof x !== "string") return null;
    const t0 = x.trim();
    // "$nvda" cashtag -> "NVDA"; names/themes ("Copper", "EU banks") keep their case.
    const v = /^\$[A-Za-z]/.test(t0) ? t0.slice(1).toUpperCase() : t0;
    if (!v) return null;
    const k = v.toUpperCase();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export interface IdeaFields {
  idea_type: unknown;
  direction: unknown;
  tickers: unknown; // string[]
  label: unknown;
  one_liner: unknown;
  technical: unknown;
}

export type FieldCheck =
  | { ok: false; reason: RejectReason }
  | { ok: true; tickers: string[]; warnings: string[] };

/** Field/value rules only (no Slack message needed). Shared by the worker and the archive regression test. */
export function checkFields(f: IdeaFields, channel: CaChannel): FieldCheck {
  const bad = (reason: RejectReason): FieldCheck => ({ ok: false, reason });
  if (!(CA_IDEA_TYPES as readonly string[]).includes(f.idea_type as string)) return bad("bad_idea_type");
  if (!(CA_DIRECTIONS as readonly string[]).includes(f.direction as string)) return bad("bad_direction");
  const tickers = normalizeTickers(f.tickers);
  if (!tickers) return bad("bad_tickers");
  if (f.idea_type === "ticker+direction" && tickers.length === 0) return bad("bad_tickers");
  if (channel.strict && (f.idea_type !== "ticker+direction" || tickers.length === 0)) {
    return bad("general_requires_ticker_direction");
  }
  if (typeof f.label !== "string" || !f.label.trim()) return bad("bad_label");
  if (typeof f.one_liner !== "string" || !f.one_liner.trim()) return bad("bad_one_liner");
  if (typeof f.technical !== "boolean") return bad("bad_technical");
  const warnings: string[] = [];
  const wc = wordCount(f.one_liner);
  if (wc > CA_ONE_LINER_MAX_WORDS) warnings.push(`one_liner_long:${wc}_words`);
  return { ok: true, tickers, warnings };
}

/** Slack mrkdwn -> plain words: decodes entities, keeps link labels, drops formatting and punctuation. Words must still match in order. */
export const normText = (s: string) => s
  .replace(/<([^>|]*)\|([^>]*)>/g, "$2")
  .replace(/<([^>]*)>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .toLowerCase()
  .replace(/[\u2018\u2019\u02bc`]/g, "'")
  .replace(/[^\p{L}\p{N}'$%.]+/gu, " ")
  .replace(/(^|\s)[.']+|[.']+(?=\s|$)/g, " ")
  .replace(/\s+/g, " ").trim();

/** Words in the text beyond tickers, cashtags, links, mentions and emoji codes. */
export function viewWords(text: string, tickers: string[]): string[] {
  const tk = new Set(tickers.map((t) => t.toLowerCase()));
  return text
    .replace(/<[^>]*>/g, " ")          // links, mentions
    .replace(/:[a-z0-9_+\-]+:/gi, " ")  // emoji codes
    .replace(/\$[A-Za-z][\w.]*/g, " ")  // cashtags
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w && !tk.has(w.toLowerCase()) && !/^\d+$/.test(w));
}

/** Loose quote check (log only): each "..."-separated part appears in the thread text, ignoring Slack formatting. */
export function quoteFoundLoosely(quote: string, thread: SlackMessage[]): boolean {
  const q = quote.trim().replace(/^["'\u201c]+|["'\u201d]+$/g, "");
  if (normText(q) === "chart only") return thread.some((m) => summarizeAttachments(m).length > 0);
  const hay = normText(thread.map((m) => m.text ?? "").join(" \n "));
  const parts = q.split(/\.{3,}|\u2026/).map(normText).filter(Boolean);
  return parts.length > 0 && parts.every((p) => hay.includes(p));
}

function check(raw: RawIdea, ctx: ValidateContext, warn: (w: string) => void): RejectReason | CaIdea {
  if (ctx.contextTs?.has(raw.source_ts)) return "context_only_source";
  const msg = ctx.fetched.get(raw.source_ts);
  if (!msg) return "unknown_source";
  if (!msg.user || raw.author_id !== msg.user) return "author_mismatch";
  if (ctx.excludedIds.has(msg.user)) return "excluded_author";
  const fc = checkFields(raw, ctx.channel);
  if (!fc.ok) return fc.reason;
  const tickers = fc.tickers;
  fc.warnings.forEach(warn);

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
  const res: ValidateResult = { ideas: [], rejected: [], warnings: [], review: [] };
  for (const raw of raws) {
    const ts = String(raw?.source_ts ?? "");
    const r = check(raw, ctx, (warning) => {
      res.warnings.push({ source_ts: ts, warning });
      console.warn(`[community-alpha] idea ${ts}: ${warning}`);
    });
    if (typeof r === "string") res.rejected.push({ source_ts: ts, reason: r });
    else { res.ideas.push(r); res.review.push({ source_ts: ts, tickers: r.tickers, direction: r.direction }); }
  }
  return res;
}
