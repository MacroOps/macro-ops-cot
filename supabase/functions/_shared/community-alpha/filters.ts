// Pre-AI message filters. Runs in code before any AI step.

export interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
  files?: unknown[];
}

export interface FilterResult {
  kept: SlackMessage[];
  /** Team-author messages removed -> team_excluded_count. */
  teamExcluded: number;
  /** Private-list messages removed -> folded into tactical_excluded_count only. */
  privateExcluded: number;
  botOrSystem: number;
  emptyOrEmoji: number;
}

/** Subtypes that are still real human posts. Everything else is system noise. */
const HUMAN_SUBTYPES = new Set([undefined, "", "thread_broadcast", "file_share", "me_message"]);

/** True when text has no content beyond whitespace, :shortcodes:, and emoji. */
export function isEmptyOrEmojiOnly(text: string | undefined): boolean {
  if (!text) return true;
  const stripped = text
    .replace(/:[a-z0-9_+\-']+:/gi, "") // :emoji: and :skin-tone-2:
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u200D\uFE0E\uFE0F\u20E3]/gu, "")
    .replace(/\s+/g, "");
  return stripped.length === 0;
}

export function filterMessages(
  messages: SlackMessage[],
  teamIds: ReadonlySet<string>,
  privateIds: ReadonlySet<string>,
): FilterResult {
  const r: FilterResult = { kept: [], teamExcluded: 0, privateExcluded: 0, botOrSystem: 0, emptyOrEmoji: 0 };
  for (const m of messages) {
    if (m.bot_id || m.subtype === "bot_message" || !HUMAN_SUBTYPES.has(m.subtype) || !m.user) {
      r.botOrSystem++;
      continue;
    }
    if (teamIds.has(m.user)) {
      r.teamExcluded++;
      continue;
    }
    if (privateIds.has(m.user)) {
      r.privateExcluded++;
      continue;
    }
    if (isEmptyOrEmojiOnly(m.text)) {
      r.emptyOrEmoji++;
      continue;
    }
    r.kept.push(m);
  }
  return r;
}
