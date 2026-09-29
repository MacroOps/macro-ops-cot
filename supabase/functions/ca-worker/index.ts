// Community Alpha queue + worker chain.
// POST {action:"tick", manual?} -> scheduled check: finds due weeks from state, creates one run, kicks workers.
// POST {action:"start", anchors:[YYYY-MM-DD], only?, parallel?} -> manual staging test run (never finalized automatically).
// POST {action:"work", hops} -> claims one task, processes it, kicks the next hop while tasks remain;
//   the call that closes a scheduled run triggers ca-finalize once.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3";
import { CA_CHANNELS, CA_CREDIT_CAP_PER_RUN, CA_TEAM_IDS, caCredits, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages, type SlackMessage, summarizeAttachments } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { CA_ZONE, dueWindows, windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { checkDirections, decideDirection, extractIdeas, toRawIdea, type UsageHook } from "../_shared/community-alpha/extract.ts";
import { quoteFoundLoosely, validateIdeas } from "../_shared/community-alpha/validate.ts";

const TOKEN_SHA256 = "628c648bfe7df7ef83a24774f1347a52f29c4ce82aa90683845e52e6cc15a8b5";
const MAX_ATTEMPTS = 3;
const MAX_HOPS = 60;
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ca-worker`;
const FINALIZE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ca-finalize`;
const STAGING_RECIPIENTS = ["U03CSJ4QPFS", "UUSBEJG9K"];

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

async function processTask(task: any, guard: { beforeCall: () => Promise<void>; onUsage: UsageHook }) {
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
    await guard.beforeCall();
    const r = await extractIdeas(apiKey, channel, kept, names, "forced_tool", undefined, context, guard.onUsage);
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
      const items = v.ideas.map((idea, i) => {
        const src = fetched.get(v.review[i].source_ts)!;
        return {
          id: i, instrument: idea.tickers.split(",")[0].trim(), direction: idea.direction,
          label: idea.label, one_liner: idea.one_liner, idea_author: idea.author_name,
          source_text: src.text ?? "", source_attachments: summarizeAttachments(src),
          thread: threads[i].filter((m) => m.ts !== src.ts).map((m) => ({
            author: names.get(m.user!) ?? m.user ?? "unknown", is_idea_author: m.user === src.user,
            text: m.text ?? "", attachments: summarizeAttachments(m), context_only: ctxMap.has(m.ts),
          })),
        };
      });
      await guard.beforeCall();
      const c = await checkDirections(apiKey, channel, items, guard.onUsage);
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

class CreditCapError extends Error {}

/** Per-run credit guard: checked before every AI call; every call's usage is recorded, even on failure. */
function creditGuard(sb: ReturnType<typeof db>, runId: string) {
  return {
    async beforeCall() {
      const { data } = await sb.from("community_alpha_runs").select("ai_credits").eq("id", runId).single();
      if (Number(data?.ai_credits ?? 0) >= CA_CREDIT_CAP_PER_RUN) throw new CreditCapError("credit_cap");
    },
    onUsage: (async (kind, i, o) => {
      const { error } = await sb.rpc("ca_add_usage", { _run_id: runId, _kind: kind, _in: i, _out: o, _credits: caCredits(i, o) });
      if (error) console.error("[ca-worker] usage", error.message);
    }) as UsageHook,
  };
}

async function work(token: string, hops: number) {
  const sb = db();
  const { data, error } = await sb.rpc("ca_claim_task");
  if (error) { console.error("[ca-worker] claim", error.message); return; }
  const task = (data ?? [])[0];
  if (!task) return;
  try {
    const upd = await processTask(task, creditGuard(sb, task.run_id));
    await sb.from("community_alpha_tasks").update(upd).eq("id", task.id);
    console.log(`[ca-worker] task ${task.id} done`);
  } catch (e) {
    if (e instanceof CreditCapError) {
      // Cap reached: this task and every remaining pending task fail with reason credit_cap. No retries.
      const now = new Date().toISOString();
      await sb.from("community_alpha_tasks").update({ status: "failed", error: "credit_cap", started_at: null, finished_at: now })
        .eq("run_id", task.run_id).or(`id.eq.${task.id},status.eq.pending`);
      console.error(`[ca-worker] run ${task.run_id} reached the credit cap`);
    } else {
      const msg = String((e as Error)?.message ?? e).slice(0, 500);
      const final = task.attempts >= MAX_ATTEMPTS;
      await sb.from("community_alpha_tasks").update({
        status: final ? "failed" : "pending", error: msg, started_at: null,
        finished_at: final ? new Date().toISOString() : null,
      }).eq("id", task.id);
      console.error(`[ca-worker] task ${task.id} attempt ${task.attempts} failed: ${msg}`);
    }
  }
  const { count } = await sb.from("community_alpha_tasks").select("id", { count: "exact", head: true })
    .eq("run_id", task.run_id).in("status", ["pending", "running"]);
  if ((count ?? 0) > 0 && hops < MAX_HOPS) await kick(token, hops + 1);
  else if ((count ?? 0) === 0) {
    const { data: closed } = await sb.from("community_alpha_runs").update({
      status: "done", finished_at: new Date().toISOString(), summary: "worker chain complete; awaiting finalize",
    }).eq("id", task.run_id).eq("status", "processing").select("id, trigger, is_manual");
    // Scheduled runs finalize automatically (exactly once: only the call that closed the run).
    const r = closed?.[0];
    if (r && r.trigger === "scheduled" && !r.is_manual) await callFinalize(token, r.id);
  }
}

function callFinalize(token: string, runId: string) {
  return fetch(FINALIZE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ca-token": token },
    body: JSON.stringify({ run_id: runId }),
  }).then(async (r) => { if (!r.ok) console.error("[ca-worker] finalize", r.status, (await r.text()).slice(0, 200)); })
    .catch((e) => console.error("[ca-worker] finalize call failed", String(e)));
}

const caMode = () => (Deno.env.get("CA_MODE") === "live" ? "live" : "staging");

/**
 * Scheduled check (pg_cron, hourly at :05 on Fri/Sat) or manual catch-up.
 * Finds due weeks from the state row for CA_MODE; creates one run for all of them.
 * Nothing due: silent on scheduled checks; manual runs get "already up to date".
 * A run already in flight is resumed (kicked), never duplicated.
 */
async function tick(token: string, manual: boolean) {
  const sb = db();
  const mode = caMode();
  const { data: inflight } = await sb.from("community_alpha_runs").select("id, status")
    .eq("mode", mode).eq("trigger", manual ? "manual" : "scheduled").in("status", ["processing", "finalizing"])
    .gte("started_at", new Date(Date.now() - 6 * 3600e3).toISOString()).limit(1);
  if (inflight?.length) {
    if (inflight[0].status === "processing") await kick(token, 0);
    return { resumed: inflight[0].id };
  }
  const { data: st } = await sb.from("community_alpha_state").select("last_anchor_at").eq("id", mode === "live" ? 1 : 2).single();
  const lastWeek = DateTime.fromISO(st!.last_anchor_at).setZone(CA_ZONE).toISODate()!;
  const due = dueWindows(lastWeek, new Date());
  if (!due.length) {
    if (manual) {
      const text = `${mode === "staging" ? "[STAGING] " : ""}MO Community Alpha — already up to date through ${DateTime.fromISO(st!.last_anchor_at).setZone(CA_ZONE).toFormat("ccc LLL d")}.`;
      await sendStagingDm(text);
    }
    return { due: [] };
  }
  const anchors = due.map((w) => w.weekDate);
  const { data: run, error } = await sb.from("community_alpha_runs")
    .insert({ mode, trigger: manual ? "manual" : "scheduled", is_manual: manual, anchors, status: "processing" }).select().single();
  if (error) throw new Error(error.message);
  const rows = anchors.flatMap((a) => CA_CHANNELS.map((c) => ({
    run_id: run.id, anchor_date: a, channel_id: c.id, channel_name: c.name, tighter_filter: c.strict,
  })));
  const ins = await sb.from("community_alpha_tasks").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  await Promise.all(Array.from({ length: 4 }, () => kick(token, 0)));
  return { run_id: run.id, anchors };
}

async function sendStagingDm(text: string) {
  if (caMode() !== "staging") throw new Error("live Slack channel not configured");
  const t = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  for (const u of STAGING_RECIPIENTS) {
    await slackCall(t, "chat.postMessage", { channel: u, text, unfurl_links: "false", unfurl_media: "false" });
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const token = req.headers.get("x-ca-token") ?? "";
  if ((await sha256(token)) !== TOKEN_SHA256) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "tick") {
    try { return Response.json(await tick(token, body.manual === true)); }
    catch (e) { console.error("[ca-worker] tick", String(e)); return new Response(String(e).slice(0, 300), { status: 500 }); }
  }
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
