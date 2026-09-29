// Slack reader for Community Alpha. Uses the bot token (CA_SLACK_BOT_TOKEN) directly.
// Returns raw messages for one channel + window; judging each reply by its own ts.
import type { SlackMessage } from "./filters.ts";
import { type CaWindow, isInWindow, slackTsToMicros } from "./window.ts";

const API = "https://slack.com/api";
/** How far back we look for thread parents that may have replies inside the window. */
export const PARENT_LOOKBACK_DAYS = 30;

export class SlackError extends Error {
  constructor(public method: string, public slackError: string) {
    super(`${method}: ${slackError}`);
  }
}

export async function slackCall(token: string, method: string, params: Record<string, string>): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}/${method}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "3");
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      continue;
    }
    const body = await res.json().catch(() => ({ ok: false, error: `http_${res.status}` }));
    if (!body.ok) throw new SlackError(method, body.error ?? "unknown_error");
    return body;
  }
  throw new SlackError(method, "rate_limited_after_retries");
}

interface RawMsg extends SlackMessage {
  reply_count?: number;
  latest_reply?: string;
}

export interface ChannelFetch {
  /** Top-level messages whose ts is in the window. */
  topLevel: SlackMessage[];
  /** Thread replies whose own ts is in the window (parent may be older). */
  replies: SlackMessage[];
  /**
   * Parents from BEFORE the window that have at least one in-window reply.
   * Background only (context_only): never an idea source, never counted.
   */
  contextParents: SlackMessage[];
}

/**
 * Top-level messages: ts inside the window. Threads: every parent (in the window, or up to
 * PARENT_LOOKBACK_DAYS before it with a latest_reply at/after the window start) is read, and
 * each reply is kept only if its own ts is inside the window.
 */
export async function fetchChannelWindow(token: string, channelId: string, w: CaWindow): Promise<ChannelFetch> {
  const startSec = Number(w.startMicros / 1_000_000n);
  const endSec = Number(w.endMicros / 1_000_000n) + 1;
  const history: RawMsg[] = [];
  let cursor = "";
  do {
    const p: Record<string, string> = {
      channel: channelId,
      oldest: String(startSec - PARENT_LOOKBACK_DAYS * 86400),
      latest: String(endSec),
      inclusive: "true",
      limit: "200",
    };
    if (cursor) p.cursor = cursor;
    const b = await slackCall(token, "conversations.history", p);
    history.push(...(b.messages ?? []));
    cursor = b.response_metadata?.next_cursor ?? "";
  } while (cursor);

  const topLevel = history.filter((m) => isInWindow(m.ts, w));
  const replies: SlackMessage[] = [];
  const contextParents: SlackMessage[] = [];
  const parents = history.filter((m) =>
    (m.reply_count ?? 0) > 0 &&
    (isInWindow(m.ts, w) || (m.latest_reply != null && slackTsToMicros(m.latest_reply) > w.startMicros))
  );
  for (const parent of parents) {
    let c = "";
    let hadReply = false;
    do {
      const p: Record<string, string> = { channel: channelId, ts: parent.ts, limit: "200" };
      if (c) p.cursor = c;
      const b = await slackCall(token, "conversations.replies", p);
      for (const r of (b.messages ?? []) as RawMsg[]) {
        if (r.ts !== r.thread_ts && isInWindow(r.ts, w)) { replies.push(r); hadReply = true; }
      }
      c = b.response_metadata?.next_cursor ?? "";
    } while (c);
    if (hadReply && !isInWindow(parent.ts, w)) contextParents.push(parent);
  }
  return { topLevel, replies, contextParents };
}
