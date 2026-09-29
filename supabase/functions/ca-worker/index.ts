// Community Alpha queue + worker chain (step 5).
// POST {action:"start", anchors:[YYYY-MM-DD], parallel?:n} -> creates a manual staging run + one task per channel/week, kicks workers.
// POST {action:"work", hops} -> claims one task, processes it, kicks the next hop while tasks remain.
// Never finalizes, never posts to Slack, never moves state.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CA_CHANNELS, CA_TEAM_IDS, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages, type SlackMessage } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { checkDirections, extractIdeas, toRawIdea } from "../_shared/community-alpha/extract.ts";
import { validateIdeas } from "../_shared/community-alpha/validate.ts";

const TOKEN_SHA256 = "67c28d5f6202644be0bfc3c4a12344c3941c77bb67c2cac96ec94e71e6f4176c";
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
  // Pre-window thread parents: background only. Drop bot/system and private-list authors; never counted.
  const keptRoots = new Set(kept.map((m) => m.thread_ts).filter(Boolean));
  const context = f.contextParents.filter((m) =>
    keptRoots.has(m.ts) && m.user && !m.bot_id && !privateIds.has(m.user)
  );
  const names = await resolveNames(slackToken, [...new Set([...kept, ...context].map((m) => m.user!))]);
  let ideas: unknown[] = [], rejected: unknown[] = [], review: unknown[] = [];
  let tacticalDropped = 0, inTok = 0, outTok = 0, chkIn = 0, chkOut = 0;
  if (kept.length) {
    const r = await extractIdeas(apiKey, channel, kept, names, "forced_tool", undefined, context);
    const excluded = new Set([...CA_TEAM_IDS, ...privateIds]);
    const fetched = new Map(kept.map((m: SlackMessage) => [m.ts, m]));
    const v = validateIdeas(r.ideas.map(toRawIdea), {
      channel, fetched, excludedIds: excluded, names, contextTs: new Set(context.map((m) => m.ts)),
    });
    rejected = [...v.rejected, ...v.warnings.map((x) => ({ ...x, reason: "warning" }))];
    tacticalDropped = r.tactical_dropped; inTok = r.input_tokens; outTok = r.output_tokens;
    // Second pass: model reports the author's view; code decides.
    if (v.ideas.length) {
      const ctxMap = new Map(context.map((m) => [m.ts, m]));
      const rootOf = (m: SlackMessage) => (m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : m.ts);
      const threadFor = (src: SlackMessage) => {
        const root = rootOf(src);
        const all = [...(ctxMap.has(root) ? [ctxMap.get(root)!] : []), ...kept.filter((m) => rootOf(m) === root)];
        return all.sort((a, b) => Number(a.ts) - Number(b.ts));
      };
      const threads = v.review.map((rv) => threadFor(fetched.get(rv.source_ts)!));
      const items = v.ideas.map((idea, i) => ({
        id: i, instrument: idea.tickers.split(",")[0].trim(), direction: idea.direction,
        label: idea.label, one_liner: idea.one_liner,
        source_text: fetched.get(v.review[i].source_ts)?.text ?? "",
        thread: threads[i].filter((m) => m.ts !== v.review[i].source_ts)
          .map((m) => ({ text: m.text ?? "", context_only: ctxMap.has(m.ts) })),
      }));
      const c = await checkDirections(apiKey, items);
      chkIn = c.input_tokens; chkOut = c.output_tokens;
      v.ideas.forEach((idea, i) => {
        const a = c.answers.get(i) ?? { reason: "no answer", author_view: "unclear", quote: "" };
        const decision = decideDirection(idea.direction, a.author_view);
        const quoteOk = quoteFoundLoosely(a.quote, threads[i]);
        const rv = { ...v.review[i], label: idea.label, author_view: a.author_view, check_reason: a.reason, quote: a.quote, quote_found: quoteOk, decision };
        if (!quoteOk) rejected.push({ source_ts: rv.source_ts, reason: "warning", warning: "quote_mismatch", quote: a.quote });
        if (decision === "flip_prevented") { rejected.push({ ...rv, reason: "flip_prevented" }); return; }
        if (decision === "unclear") rejected.push({ ...rv, reason: "warning", warning: "direction_unclear" });
        ideas.push(idea); review.push(rv);
      });
    }
  }
  return {
    status: "done", error: null, finished_at: new Date().toISOString(),
    messages_fetched: all.length - fr.duplicates, team_excluded: fr.teamExcluded,
    tactical_author_excluded: fr.privateExcluded, tactical_dropped: tacticalDropped,
    ideas, rejected, review, input_tokens: inTok, output_tokens: outTok,
    check_input_tokens: chkIn, check_output_tokens: chkOut,
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
      status: "done", finished_at: new Date().toISOString(), summary: "worker chain complete; awaiting finalize",
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
      .insert({ mode: "staging", trigger: "manual", is_manual: true, anchors, status: "processing" }).select().single();
    if (error) return new Response(error.message, { status: 500 });
    const only: { anchor: string; channel_id: string }[] | undefined = body.only;
    const rows = anchors.flatMap((a) => CA_CHANNELS.filter((c) => !only || only.some((o) => o.anchor === a && o.channel_id === c.id)).map((c) => ({
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
