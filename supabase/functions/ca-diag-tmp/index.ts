import { CA_TEAM_IDS, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages, isEmptyOrEmojiOnly, summarizeAttachments } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";

const TOKEN_SHA256 = "4ccd1aeb0a9b6167f799418f24982c135238ab31f2241cdeee712b38b1c6965f";
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if ((await sha256(req.headers.get("x-ca-token") ?? "")) !== TOKEN_SHA256) return new Response("forbidden", { status: 403 });
  const { anchor, targets } = await req.json() as { anchor: string; targets: { channel: string; ts: string }[] };
  const tok = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const priv = parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"));
  const w = windowForWeekDate(anchor);
  const out = [];
  const cache = new Map<string, any>();
  for (const t of targets) {
    if (!cache.has(t.channel)) cache.set(t.channel, await fetchChannelWindow(tok, t.channel, w));
    const f = cache.get(t.channel);
    const all = [...f.topLevel, ...f.replies];
    const m = all.find((x: any) => x.ts === t.ts);
    const ctx = f.contextParents.find((x: any) => x.ts === t.ts);
    let status = "not_fetched";
    if (m) {
      const kept = filterMessages(all, CA_TEAM_IDS, priv).kept.some((x) => x.ts === t.ts);
      if (kept) status = "sent_to_ai";
      else if (m.bot_id || !m.user) status = "removed:bot_or_system";
      else if (CA_TEAM_IDS.has(m.user)) status = "removed:team";
      else if (priv.has(m.user)) status = "removed:private_list";
      else if (isEmptyOrEmojiOnly(m.text)) status = "removed:empty";
      else status = "removed:other(" + m.subtype + ")";
    } else if (ctx) status = "context_parent_only";
    const src = m ?? ctx;
    out.push({ ...t, status, is_reply: src ? !!src.thread_ts && src.thread_ts !== src.ts : null, text: src?.text?.slice(0, 500), att: src ? summarizeAttachments(src) : null, window: [String(w.startMicros), String(w.endMicros)] });
  }
  return Response.json(out);
});
