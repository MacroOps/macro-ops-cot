// TEMPORARY diagnostic for step 4c. Deleted after use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CA_TEAM_IDS, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { filterMessages } from "../_shared/community-alpha/filters.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { CA_MODEL, extractIdeas, toRawIdea } from "../_shared/community-alpha/extract.ts";
import { validateIdeas } from "../_shared/community-alpha/validate.ts";

const HASH = "b4941d9b1419351571e1a52f4a518c7179fe6fefb5913292c52fafe302453927";
const WEEK = "2026-09-25";
const CH = "C6Q4C2WR1";

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if ((await sha(req.headers.get("x-ca-token") ?? "")) !== HASH) return new Response("no", { status: 401 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cleanup failed test runs (no tasks attached).
  const del = await db.from("community_alpha_runs").delete().eq("mode", "staging").eq("status", "failed").like("summary", "step4b%").select("id");

  const token = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const channel = channelById(CH)!;
  const w = windowForWeekDate(WEEK);
  const f = await fetchChannelWindow(token, CH, w);
  const fr = filterMessages([...f.topLevel, ...f.replies], CA_TEAM_IDS, parsePrivateList(Deno.env.get("CA_PRIVATE_IDS")));
  const names = new Map<string, string>();
  for (const id of new Set(fr.kept.map((m) => m.user!))) {
    try { const u = await slackCall(token, "users.info", { user: id }); names.set(id, u.user?.profile?.display_name || u.user?.real_name || id); } catch { /* */ }
  }
  const fetched = new Map(fr.kept.map((m) => [m.ts, m]));
  const excluded = new Set([...CA_TEAM_IDS, ...parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"))]);

  // Source texts for the technical check.
  const want = ["PRLB", "GRAL", "MAN", "LLY"];
  const sources: Record<string, { ts: string; text: string }[]> = {};
  for (const t of want) {
    sources[t] = fr.kept.filter((m) => new RegExp(`\\b\\$?${t}\\b`, "i").test(m.text ?? "")).map((m) => ({ ts: m.ts, text: (m.text ?? "").slice(0, 1200) }));
  }

  const one = async (label: string) => {
    const { data: run } = await db.from("community_alpha_runs").insert({ mode: "staging", trigger: "manual", anchors: [WEEK], summary: `step4c ${label}` }).select("id").single();
    const started = new Date().toISOString();
    const r = await extractIdeas(Deno.env.get("LOVABLE_API_KEY")!, channel, fr.kept, names);
    const v = validateIdeas(r.ideas.map(toRawIdea), { channel, fetched, excludedIds: excluded, names });
    await db.from("community_alpha_tasks").insert({
      run_id: run!.id, anchor_date: WEEK, channel_id: CH, channel_name: channel.name, status: "done", attempts: 1,
      messages_fetched: f.topLevel.length + f.replies.length, team_excluded: fr.teamExcluded, tactical_author_excluded: fr.privateExcluded,
      tactical_dropped: r.tactical_dropped, ideas: v.ideas, rejected: v.rejected, input_tokens: r.input_tokens, output_tokens: r.output_tokens,
      started_at: started, finished_at: new Date().toISOString(),
    });
    await db.from("community_alpha_runs").update({ status: "done", finished_at: new Date().toISOString(), token_usage: { model: CA_MODEL, method: r.method, input: r.input_tokens, output: r.output_tokens, aig_run_id: r.runId } }).eq("id", run!.id);
    return { label, runId: r.runId, method: r.method, input: r.input_tokens, output: r.output_tokens, tactical_dropped: r.tactical_dropped, ideas: v.ideas, rejected: v.rejected, warnings: v.warnings };
  };
  const runs = await Promise.all([one("run A"), one("run B")]);

  const { data: wk } = await db.from("community_alpha_weeks").select("ideas").eq("week_date", WEEK).single();
  const archive = ((wk?.ideas ?? []) as any[]).filter((i) => i.channel_id === CH);
  return Response.json({ deleted: del.data, kept: fr.kept.length, sources, runs, archive });
});
