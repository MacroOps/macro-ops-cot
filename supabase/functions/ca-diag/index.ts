// TEMPORARY diagnostic. Returns ts/status/labels only, never message text. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CA_TEAM_IDS, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { isEmptyOrEmojiOnly } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";

const TOKEN_SHA256 = "d35fc8b23439729597bf6b3a36e2c8aae4b2ae0c3021c0780b9e3d3a169420c2";
const HUMAN = new Set([undefined, "", "thread_broadcast", "file_share", "me_message"]);
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const tsOf = (p: string) => { const m = p.match(/\/p(\d+)(\d{6})/); return m ? `${m[1]}.${m[2]}` : ""; };

Deno.serve(async (req) => {
  if ((await sha256(req.headers.get("x-ca-token") ?? "")) !== TOKEN_SHA256) return new Response("forbidden", { status: 403 });
  const { week, channels, run_id } = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const priv = parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"));
  const { data: wk } = await sb.from("community_alpha_weeks").select("ideas").eq("week_date", week).single();
  const { data: tasks } = await sb.from("community_alpha_tasks").select("channel_id,ideas").eq("run_id", run_id).eq("anchor_date", week);
  const w = windowForWeekDate(week);
  const out: any[] = [];
  for (const cid of channels) {
    const ch = channelById(cid)!;
    const f = await fetchChannelWindow(token, cid, w);
    const all = [...f.topLevel, ...f.replies];
    const byTs = new Map(all.map((m) => [m.ts, m]));
    const ai = ((tasks ?? []).find((t: any) => t.channel_id === cid)?.ideas ?? []) as any[];
    for (const a of (wk!.ideas as any[]).filter((i) => i.channel_id === cid)) {
      const ts = tsOf(a.permalink);
      const m: any = byTs.get(ts);
      let status: string, thread: string | null = null;
      if (!m) {
        // Not fetched: is it a reply to a thread started before the window?
        let parent = "unknown";
        try {
          const h = await slackCall(token, "conversations.history", { channel: cid, latest: ts, oldest: ts, inclusive: "true", limit: "1" });
          parent = (h.messages ?? []).some((x: any) => x.ts === ts) ? "top-level (?)" : "thread reply, parent outside window or not top-level";
        } catch (e) { parent = String(e); }
        status = `not fetched: ${parent}`;
      } else {
        thread = m.thread_ts && m.thread_ts !== m.ts ? `reply to ${m.thread_ts} (parent in fetch: ${byTs.has(m.thread_ts)})` : (m.thread_ts ? "thread parent" : "top-level");
        if (m.bot_id || !HUMAN.has(m.subtype) || !m.user) status = "removed: bot/system";
        else if (CA_TEAM_IDS.has(m.user)) status = "removed: team";
        else if (priv.has(m.user)) status = "removed: private list";
        else if (isEmptyOrEmojiOnly(m.text)) status = `removed: empty/emoji (files=${(m.files ?? []).length})`;
        else {
          const same = ai.filter((i) => tsOf(i.permalink) === ts);
          status = same.length ? `sent to AI; AI returned same message as: ${same.map((i) => `${i.tickers}/${i.direction}`).join("; ")}` : "sent to AI, not returned";
        }
      }
      const aiSameTs = ai.some((i) => tsOf(i.permalink) === ts);
      out.push({ channel: ch.name, label: a.label, tickers: a.tickers, direction: a.direction, ts, status, thread, aiSameTs });
    }
  }
  return Response.json(out);
});
