// Slack reader for Community Alpha. Uses the bot token (CA_SLACK_BOT_TOKEN) directly.
// Returns raw messages for one channel + window; judging each reply by its own ts.
import type { SlackMessage } from "./filters.ts";
import { type CaWindow, isInWindow } from "./window.ts";

const API = "https://slack.com/api";
/** Thread parents older than the window can still get in-window replies. */
export const PARENT_LOOKBACK_DAYS = 14;

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

export async function fetchChannelWindow(token: string, channelId: string, w: CaWindow): Promise<ChannelFetch> {
  const endSec = Number(w.endMicros / 1_000_000n) + 1;
  const lookSec = Number(w.startMicros / 1_000_000n) - PARENT_LOOKBACK_DAYS * 86400;
  const history: RawMsg[] = [];
  let cursor = "";
  do {
    const p: Record<string, string> = {
      channel: channelId,
      oldest: String(lookSec),
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
  const parents = history.filter((m) =>
    (m.reply_count ?? 0) > 0 && m.latest_reply && BigInt(m.latest_reply.replace(".", "").padEnd(16, "0")) > 0n &&
    isAfterStart(m.latest_reply, w)
  );
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

function isAfterStart(ts: string, w: CaWindow): boolean {
  const [s, f = ""] = ts.split(".");
  return BigInt(s) * 1_000_000n + BigInt(f.padEnd(6, "0")) > w.startMicros;
}
