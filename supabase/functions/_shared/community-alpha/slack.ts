// Slack reader for Community Alpha. Uses the bot token (CA_SLACK_BOT_TOKEN) directly.
// Returns raw messages for one channel + window; judging each reply by its own ts.
import type { SlackMessage } from "./filters.ts";
import { type CaWindow, isInWindow } from "./window.ts";

const API = "https://slack.com/api";

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
}

/**
 * Matches the old system: only threads whose PARENT is inside the window are read,
 * and each reply is then kept only if its own ts is inside the window.
 * Replies to older parents are not fetched (may be added after the parallel run).
 */
export async function fetchChannelWindow(token: string, channelId: string, w: CaWindow): Promise<ChannelFetch> {
  const startSec = Number(w.startMicros / 1_000_000n);
  const endSec = Number(w.endMicros / 1_000_000n) + 1;
  const history: RawMsg[] = [];
  let cursor = "";
  do {
    const p: Record<string, string> = {
      channel: channelId,
      oldest: String(startSec),
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
  const parents = topLevel.filter((m) => (m.reply_count ?? 0) > 0);
  for (const parent of parents) {
    let c = "";
    do {
      const p: Record<string, string> = { channel: channelId, ts: parent.ts, limit: "200" };
      if (c) p.cursor = c;
      const b = await slackCall(token, "conversations.replies", p);
      for (const r of (b.messages ?? []) as RawMsg[]) {
        if (r.ts !== r.thread_ts && isInWindow(r.ts, w)) replies.push(r);
      }
      c = b.response_metadata?.next_cursor ?? "";
    } while (c);
  }
  return { topLevel, replies };
}
