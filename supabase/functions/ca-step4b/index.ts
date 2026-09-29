// TEMPORARY diagnostic for Community Alpha step 4b. Delete after use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { windowForWeekDate, isInWindow } from "../_shared/community-alpha/window.ts";
import { channelById, CA_TEAM_IDS, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { filterMessages, isEmptyOrEmojiOnly, type SlackMessage } from "../_shared/community-alpha/filters.ts";
import { extractIdeas, toRawIdea } from "../_shared/community-alpha/extract.ts";
import { validateIdeas } from "../_shared/community-alpha/validate.ts";
import { basePermalink, ideaKey } from "../_shared/community-alpha/merge.ts";

const HASH = "6bf4d06dd3b0dec6e4f5bc5cb5acd843992bd909525c476e94de1dc82c9211a4";
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const WEEK = "2026-09-25", CH = "C6Q4C2WR1";

Deno.serve(async (req) => {
  if ((await sha(req.headers.get("x-ca-token") ?? "")) !== HASH) return new Response("no", { status: 401 });
  const { phase, model, method } = await req.json();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const channel = channelById(CH)!;
  const w = windowForWeekDate(WEEK);
  const token = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const priv = parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"));
  const f = await fetchChannelWindow(token, CH, w);
  const all = [...f.topLevel, ...f.replies] as SlackMessage[];
  const fr = filterMessages(all, CA_TEAM_IDS, priv);
  const { data: wk } = await db.from("community_alpha_weeks").select("ideas").eq("week_date", WEEK).single();
  const arch = ((wk?.ideas ?? []) as any[]).filter((i) => i.channel_id === CH);

  if (phase === "diagnose") {
    const byTs = new Map(all.map((m) => [m.ts, m]));
    const keptTs = new Set(fr.kept.map((m) => m.ts));
    const out = [];
    for (const a of arch) {
      const p = basePermalink(a.permalink).split("/p").pop()!;
      const ts = p.slice(0, 10) + "." + p.slice(10);
      const m = byTs.get(ts);
      let status: string;
      if (!m) {
        // Is it a reply to a parent outside the window, or outside the window itself?
        let why = isInWindow(ts, w) ? "in window but not fetched" : "outside window";
        try {
          const r = await slackCall(token, "conversations.replies", { channel: CH, ts, limit: "1" });
          const msg = r.messages?.[0];
          if (msg && msg.thread_ts && msg.thread_ts !== msg.ts) {
            why += isInWindow(msg.thread_ts, w) ? "; reply, parent in window" : "; reply to a parent posted before the window";
          } else if (msg) why += "; top-level";
        } catch (e) { why += "; lookup error " + (e as Error).message; }
        status = "NOT FETCHED (" + why + ")";
      } else if (keptTs.has(ts)) status = "sent to AI";
      else if (m.bot_id || !m.user) status = "removed: bot/system";
      else if (CA_TEAM_IDS.has(m.user)) status = "removed: team";
      else if (priv.has(m.user)) status = "removed: private list";
      else if (isEmptyOrEmojiOnly(m.text)) status = "removed: empty/emoji";
      else status = "removed: other";
      out.push({ tickers: a.tickers, ts, isReply: !!(m?.thread_ts && m.thread_ts !== m.ts), status });
    }
    return Response.json(out);
  }

  // extract
  const names = new Map<string, string>();
  for (const u of new Set(fr.kept.map((m) => m.user!))) {
    try { const r = await slackCall(token, "users.info", { user: u }); names.set(u, r.user?.profile?.display_name || r.user?.real_name || u); } catch { names.set(u, u); }
  }
  const { data: run } = await db.from("community_alpha_runs").insert({ mode: "staging", trigger: "manual", anchors: [WEEK], summary: "step4b test " + model }).select("id").single();
  const ex = await extractIdeas(Deno.env.get("LOVABLE_API_KEY")!, channel, fr.kept, names, method ?? "forced_tool", model);
  const fetched = new Map(fr.kept.map((m) => [m.ts, m]));
  const excluded = new Set([...CA_TEAM_IDS, ...priv]);
  const v = validateIdeas(ex.ideas.map(toRawIdea), { channel, fetched, excludedIds: excluded, names });
  await db.from("community_alpha_tasks").insert({
    run_id: run!.id, anchor_date: WEEK, channel_id: CH, channel_name: channel.name, status: "done",
    messages_fetched: all.length, team_excluded: fr.teamExcluded, tactical_author_excluded: fr.privateExcluded,
    tactical_dropped: ex.tactical_dropped, ideas: v.ideas, rejected: v.rejected,
    input_tokens: ex.input_tokens, output_tokens: ex.output_tokens, started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  });
  await db.from("community_alpha_runs").update({ status: "done", finished_at: new Date().toISOString(), token_usage: { input: ex.input_tokens, output: ex.output_tokens } }).eq("id", run!.id);
  const tickKey = (i: any) => i.tickers.split(",").map((s: string) => s.trim().toUpperCase()).sort().join(",");
  const aKeys = new Map(arch.map((i) => [ideaKey(i), i]));
  const nKeys = new Map(v.ideas.map((i) => [ideaKey(i), i]));
  const pick = (i: any) => ({ tickers: i.tickers, direction: i.direction, technical: i.technical, author: i.author_name, link: basePermalink(i.permalink).split("/p").pop() });
  return Response.json({
    model, runId: ex.runId, sent: fr.kept.length, tokens: { in: ex.input_tokens, out: ex.output_tokens },
    tactical_dropped: ex.tactical_dropped, rejected: v.rejected, warnings: v.warnings,
    archive: arch.map(pick), ai: v.ideas.map(pick),
    both: [...nKeys.keys()].filter((k) => aKeys.has(k)).map((k) => ({ a: pick(aKeys.get(k)), n: pick(nKeys.get(k)) })),
    unused: tickKey,
  });
});
