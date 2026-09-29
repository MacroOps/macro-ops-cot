// Community Alpha finalize (step 6).
// POST {run_id} -> merges the run's tasks into the weeks table for CA_MODE (default staging),
// records tokens + credits on the run, sends the Slack summary once. Idempotent: re-running
// re-merges (replace per week, dedupe by permalink + tickers) and never sends a second DM.
// Manual runs never move state.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3";
import { CA_CHANNELS, CA_CREDIT_CAP_PER_RUN, caCredits, channelById } from "../_shared/community-alpha/config.ts";
import { canReprocessWeek, type ChannelResult, mergeWeek, type WeekSource } from "../_shared/community-alpha/merge.ts";
import type { CaIdea } from "../_shared/community-alpha/validate.ts";
import { CA_ZONE, windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { slackCall } from "../_shared/community-alpha/slack.ts";

const TOKEN_SHA256 = "628c648bfe7df7ef83a24774f1347a52f29c4ce82aa90683845e52e6cc15a8b5";
const STAGING_RECIPIENTS = ["U03CSJ4QPFS", "UUSBEJG9K"];
const PAGE_URL = "https://macro-ops-cot.lovable.app/community-alpha";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const mode = () => (Deno.env.get("CA_MODE") === "live" ? "live" : "staging");
const pt = (iso: string) => DateTime.fromISO(iso).setZone(CA_ZONE);
const fmtDay = (iso: string) => pt(iso).toFormat("ccc LLL d");          // Fri Sep 25
const fmtDayYear = (iso: string) => pt(iso).toFormat("ccc LLL d, yyyy"); // Fri Sep 25, 2026
const fmtWin = (iso: string) => pt(iso).toFormat("ccc LLL d, h:mm a");  // Fri Sep 18, 2:00 PM

interface WeekOut { week: string; ideas: number; channels: number; failed: string[]; capDropped: number; creditCapped: string[]; skipped?: string; start: string; end: string }

async function sendSlack(text: string) {
  const token = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  if (mode() !== "staging") throw new Error("live Slack channel not configured");
  // No link or media previews: the old system's message has none.
  for (const u of STAGING_RECIPIENTS) {
    await slackCall(token, "chat.postMessage", { channel: u, text, unfurl_links: "false", unfurl_media: "false" });
  }
}

/** Old system's format, exactly (with [STAGING] prefix in staging). */
export function buildText(weeks: WeekOut[], staging = mode() === "staging"): string {
  const prefix = staging ? "[STAGING] " : "";
  const lines: string[] = [];
  if (weeks.length === 1) {
    const w = weeks[0];
    lines.push(`${prefix}*<${PAGE_URL}|MO Community Alpha — Week ending ${fmtDayYear(w.end)}>*`);
    lines.push(w.skipped
      ? `_Skipped: ${w.skipped}_`
      : `_Window: ${fmtWin(w.start)} → ${fmtWin(w.end)} PT - ${w.channels} channels scanned - ${w.ideas} member ideas_`);
  } else {
    const last = weeks[weeks.length - 1];
    lines.push(`${prefix}*<${PAGE_URL}|MO Community Alpha — Catching up: ${weeks.length} weekly digests>*`);
    lines.push(`_Now caught up through ${fmtDayYear(last.end)}._`);
    for (const w of weeks) lines.push(`• *${fmtDay(w.end)}* - ${w.skipped ? `skipped (${w.skipped})` : `${w.ideas} ideas`}`);
  }
  for (const w of weeks) {
    const other = w.failed.filter((c) => !w.creditCapped.includes(c));
    if (w.creditCapped.length) lines.push(`:warning: ${fmtDay(w.end)}: credit cap of ${CA_CREDIT_CAP_PER_RUN} credits reached; ${w.creditCapped.join(", ")} not processed; previous ideas kept for those channels.`);
    if (other.length) lines.push(`:warning: ${fmtDay(w.end)}: ${other.join(", ")} failed; previous ideas kept for those channels.`);
    if (w.capDropped) lines.push(`:warning: ${fmtDay(w.end)}: ${w.capDropped} ideas dropped by the 50-idea cap.`);
  }
  return lines.join("\n");
}

async function finalize(runId: string, forceArchive: boolean, noDm = false) {
  const sb = db();
  const table = mode() === "live" ? "community_alpha_weeks" : "community_alpha_weeks_staging";
  const { data: run, error } = await sb.from("community_alpha_runs").select("*").eq("id", runId).single();
  if (error || !run) throw new Error(`run not found`);
  const { data: tasks, error: te } = await sb.from("community_alpha_tasks").select("*").eq("run_id", runId);
  if (te) throw new Error(te.message);
  if (tasks!.some((t) => t.status === "pending" || t.status === "running")) throw new Error("run still has open tasks");
  await sb.from("community_alpha_runs").update({ status: "finalizing" }).eq("id", runId);

  const weeks: WeekOut[] = [];
  // Usage comes from the run counters, which include every AI call (also failed/retried tasks).
  const inTok = (run.extract_input_tokens ?? 0) + (run.check_input_tokens ?? 0);
  const outTok = (run.extract_output_tokens ?? 0) + (run.check_output_tokens ?? 0);
  const anchors = [...new Set(tasks!.map((t) => t.anchor_date as string))].sort();
  for (const a of anchors) {
    const w = windowForWeekDate(a);
    const { data: existing } = await sb.from(table).select("ideas, source, channel_status, team_excluded_count, tactical_excluded_count").eq("week_date", a).maybeSingle();
    if (!canReprocessWeek(existing as { source: WeekSource } | null, { forceArchive })) {
      weeks.push({ week: a, ideas: 0, channels: 0, failed: [], capDropped: 0, creditCapped: [], skipped: "archive week, protected", start: w.startIso, end: w.endIso });
      continue;
    }
    const wt = tasks!.filter((t) => t.anchor_date === a);
    const results: ChannelResult[] = wt.map((t) => ({ channelId: t.channel_id, ok: t.status === "done", ideas: (t.ideas ?? []) as CaIdea[] }));
    const m = mergeWeek(((existing?.ideas ?? []) as CaIdea[]), results);
    const done = wt.filter((t) => t.status === "done");
    const failed = wt.filter((t) => t.status !== "done").map((t) => channelById(t.channel_id)?.name ?? t.channel_id);
    // Partial runs (e.g. one channel) replace only that channel's status; other channels keep theirs.
    const prevStatus = ((existing?.channel_status ?? {}) as Record<string, any>);
    const newStatus = Object.fromEntries(wt.map((t) => {
      const prev = prevStatus[t.channel_name];
      return [t.channel_name, t.status === "done" ? {
        status: "ok", team_excluded: t.team_excluded ?? 0,
        tactical_excluded: (t.tactical_author_excluded ?? 0) + (t.tactical_dropped ?? 0),
      } : { ...(prev ?? {}), status: "failed" }];
    }));
    const merged: Record<string, any> = { ...prevStatus, ...newStatus };
    for (const c of CA_CHANNELS) if (merged[c.name]) merged[c.name].ideas = m.ideas.filter((i) => i.channel_id === c.id).length;
    const entries = Object.values(merged);
    const haveCounts = entries.every((e) => e.status !== "ok" || typeof e.team_excluded === "number");
    const sum = (k: string) => entries.filter((e) => e.status === "ok").reduce((s, e) => s + (e[k] ?? 0), 0);
    const row = {
      week_date: a, anchor_at: w.endIso, run_at: new Date().toISOString(),
      window_start: w.startIso, window_end: w.endIso,
      channels_scanned: entries.filter((e) => e.status === "ok").length, ideas_count: m.ideas.length,
      team_excluded_count: haveCounts ? sum("team_excluded") : (existing?.team_excluded_count ?? 0),
      tactical_excluded_count: haveCounts ? sum("tactical_excluded") : (existing?.tactical_excluded_count ?? 0),
      ideas: m.ideas, channel_status: merged, source: "job",
    };
    const up = await sb.from(table).upsert(row, { onConflict: "week_date" });
    if (up.error) throw new Error(up.error.message);
    const creditCapped = wt.filter((t) => t.error === "credit_cap").map((t) => channelById(t.channel_id)?.name ?? t.channel_id);
    weeks.push({ week: a, ideas: m.ideas.length, channels: row.channels_scanned, failed, creditCapped, capDropped: m.capDropped, start: w.startIso, end: w.endIso });
  }

  const credits = Math.round(Number(run.ai_credits ?? caCredits(inTok, outTok)) * 1000) / 1000;
  const split = {
    extract_credits: Math.round(caCredits(run.extract_input_tokens ?? 0, run.extract_output_tokens ?? 0) * 1000) / 1000,
    check_credits: Math.round(caCredits(run.check_input_tokens ?? 0, run.check_output_tokens ?? 0) * 1000) / 1000,
  };
  const text = buildText(weeks);
  let dmSent = false;
  if (!run.dm_sent_at && !noDm) { await sendSlack(text); dmSent = true; }
  const warnings = weeks.flatMap((w) => [
    ...w.failed.map((c) => `${w.week} ${c} failed`),
    ...(w.capDropped ? [`${w.week} cap dropped ${w.capDropped}`] : []),
    ...(w.creditCapped.length ? [`${w.week} credit cap: ${w.creditCapped.join(", ")}`] : []),
  ]);
  await sb.from("community_alpha_runs").update({
    status: "done", finalized_at: new Date().toISOString(), finished_at: run.finished_at ?? new Date().toISOString(),
    token_usage: { input_tokens: inTok, output_tokens: outTok, ai_calls: run.ai_calls ?? 0, ...split }, credits_used: credits, warnings,
    summary: `finalized into ${table}: ${weeks.map((w) => `${w.week}=${w.skipped ? "skipped" : w.ideas}`).join(", ")}`,
    ...(dmSent ? { dm_sent_at: new Date().toISOString(), dm_text: text } : {}),
  }).eq("id", runId);
  // State: scheduled runs only (step 7). Manual runs never move state.
  if (!run.is_manual && run.trigger === "scheduled" && weeks.length) {
    const latest = anchors[anchors.length - 1];
    await sb.from("community_alpha_state").update({ last_anchor_at: windowForWeekDate(latest).endIso }).eq("id", mode() === "live" ? 1 : 2);
  }
  return { weeks, input_tokens: inTok, output_tokens: outTok, credits, ...split, dm_sent: dmSent, dm_text: text, previous_dm_text: run.dm_text ?? null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if ((await sha256(req.headers.get("x-ca-token") ?? "")) !== TOKEN_SHA256) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.run_id) return new Response("run_id required", { status: 400 });
  try {
    return Response.json(await finalize(String(body.run_id), body.force_archive === true, body.no_dm === true));
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 300);
    console.error("[ca-finalize]", msg);
    await db().from("community_alpha_runs").update({ status: "failed", summary: `finalize failed: ${msg}` }).eq("id", body.run_id);
    try { await sendSlack(`${mode() === "staging" ? "[STAGING] " : ""}:warning: Community Alpha finalize failed: ${msg}`); } catch (_) { /* logged above */ }
    return new Response(msg, { status: 500 });
  }
});
