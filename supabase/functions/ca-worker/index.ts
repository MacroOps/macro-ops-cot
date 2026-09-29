// Community Alpha queue + worker chain (step 5).
// POST {action:"start", anchors:[YYYY-MM-DD], parallel?:n} -> creates a manual staging run + one task per channel/week, kicks workers.
// POST {action:"work", hops} -> claims one task, processes it, kicks the next hop while tasks remain.
// Never finalizes, never posts to Slack, never moves state.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CA_CHANNELS, CA_TEAM_IDS, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages, type SlackMessage } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { extractIdeas, toRawIdea } from "../_shared/community-alpha/extract.ts";
import { validateIdeas } from "../_shared/community-alpha/validate.ts";

const TOKEN_SHA256 = "d35fc8b23439729597bf6b3a36e2c8aae4b2ae0c3021c0780b9e3d3a169420c2";
const MAX_ATTEMPTS = 3;
const MAX_HOPS = 60;
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ca-worker`;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function kick(token: string, hops: number) {
  return fetch(SELF, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ca-token": token },
    body: JSON.stringify({ action: "work", hops }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("[ca-worker] kick failed", String(e)));
}

async function resolveNames(token: string, ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const id of ids) {
    try {
      const b = await slackCall(token, "users.info", { user: id });
      const p = b.user?.profile ?? {};
      m.set(id, p.display_name || b.user?.real_name || b.user?.name || id);
    } catch { m.set(id, id); }
  }
  return m;
}

async function processTask(task: any) {
  const slackToken = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const privateIds = parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"));
  const channel = channelById(task.channel_id)!;
  const w = windowForWeekDate(task.anchor_date);
  const f = await fetchChannelWindow(slackToken, channel.id, w);
  const all = [...f.topLevel, ...f.replies];
  const fr = filterMessages(all, CA_TEAM_IDS, privateIds);
  const kept = [...fr.kept].sort((a, b) => Number(a.ts) - Number(b.ts));
  const names = await resolveNames(slackToken, [...new Set(kept.map((m) => m.user!))]);
  let ideas: unknown[] = [], rejected: unknown[] = [], tacticalDropped = 0, inTok = 0, outTok = 0;
  if (kept.length) {
    const r = await extractIdeas(apiKey, channel, kept, names);
    const excluded = new Set([...CA_TEAM_IDS, ...privateIds]);
    const v = validateIdeas(r.ideas.map(toRawIdea), {
      channel, fetched: new Map(kept.map((m: SlackMessage) => [m.ts, m])), excludedIds: excluded, names,
    });
    ideas = v.ideas; rejected = [...v.rejected, ...v.warnings.map((x) => ({ ...x, reason: "warning" }))];
    tacticalDropped = r.tactical_dropped; inTok = r.input_tokens; outTok = r.output_tokens;
  }
  return {
    status: "done", error: null, finished_at: new Date().toISOString(),
    messages_fetched: all.length - fr.duplicates, team_excluded: fr.teamExcluded,
    tactical_author_excluded: fr.privateExcluded, tactical_dropped: tacticalDropped,
    ideas, rejected, input_tokens: inTok, output_tokens: outTok,
  };
}

async function work(token: string, hops: number) {
  const sb = db();
  const { data, error } = await sb.rpc("ca_claim_task");
  if (error) { console.error("[ca-worker] claim", error.message); return; }
  const task = (data ?? [])[0];
  if (!task) return;
  try {
    const upd = await processTask(task);
    await sb.from("community_alpha_tasks").update(upd).eq("id", task.id);
    console.log(`[ca-worker] task ${task.id} done`);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    const final = task.attempts >= MAX_ATTEMPTS;
    await sb.from("community_alpha_tasks").update({
      status: final ? "failed" : "pending", error: msg, started_at: null,
      finished_at: final ? new Date().toISOString() : null,
    }).eq("id", task.id);
    console.error(`[ca-worker] task ${task.id} attempt ${task.attempts} failed: ${msg}`);
  }
  const { count } = await sb.from("community_alpha_tasks").select("id", { count: "exact", head: true })
    .eq("run_id", task.run_id).in("status", ["pending", "running"]);
  if ((count ?? 0) > 0 && hops < MAX_HOPS) await kick(token, hops + 1);
  else if ((count ?? 0) === 0) {
    await sb.from("community_alpha_runs").update({
      status: "done", finished_at: new Date().toISOString(), summary: "worker chain complete; not finalized (step 5 test)",
    }).eq("id", task.run_id).eq("status", "processing");
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const token = req.headers.get("x-ca-token") ?? "";
  if ((await sha256(token)) !== TOKEN_SHA256) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "start") {
    const anchors: string[] = body.anchors ?? [];
    anchors.forEach((a) => windowForWeekDate(a));
    const sb = db();
    const { data: run, error } = await sb.from("community_alpha_runs")
      .insert({ mode: "staging", trigger: "manual", anchors, status: "processing" }).select().single();
    if (error) return new Response(error.message, { status: 500 });
    const rows = anchors.flatMap((a) => CA_CHANNELS.map((c) => ({
      run_id: run.id, anchor_date: a, channel_id: c.id, channel_name: c.name, tighter_filter: c.strict,
    })));
    const ins = await sb.from("community_alpha_tasks").insert(rows);
    if (ins.error) return new Response(ins.error.message, { status: 500 });
    const n = Math.min(Number(body.parallel ?? 4), 8);
    // @ts-ignore EdgeRuntime is provided by the runtime
    EdgeRuntime.waitUntil(Promise.all(Array.from({ length: n }, () => kick(token, 0))));
    return Response.json({ run_id: run.id, tasks: rows.length });
  }
  if (body.action === "work") {
    // @ts-ignore
    EdgeRuntime.waitUntil(work(token, Number(body.hops ?? 0)));
    return new Response("accepted", { status: 202 });
  }
  return new Response("bad action", { status: 400 });
});
