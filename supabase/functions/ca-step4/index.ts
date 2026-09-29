// TEMPORARY step-4 test: one channel, one week -> staging task row. Deleted after the test.
import { createClient } from "npm:@supabase/supabase-js@2";
import { CA_TEAM_IDS, channelById, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, slackCall } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";
import { AiError, CA_MODEL, extractIdeas, toRawIdea } from "../_shared/community-alpha/extract.ts";
import { validateIdeas } from "../_shared/community-alpha/validate.ts";

Deno.serve(async (req) => {
  const token = Deno.env.get("CA_INTERNAL_TOKEN");
  if (!token || req.headers.get("x-ca-token") !== token) return new Response("forbidden", { status: 403 });
  const { weekDate = "2026-09-25", channelId = "C6Q4C2WR1" } = await req.json().catch(() => ({}));
  const ch = channelById(channelId)!;
  const w = windowForWeekDate(weekDate);
  const slack = Deno.env.get("CA_SLACK_BOT_TOKEN")!;
  const priv = parsePrivateList(Deno.env.get("CA_PRIVATE_EXCLUDE_IDS"));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: run, error: runErr } = await db.from("community_alpha_runs")
    .insert({ mode: "staging", trigger: "manual", anchors: [weekDate], status: "processing", summary: "step 4 test" })
    .select("id").single();
  if (runErr) return Response.json({ error: runErr.message }, { status: 500 });
  const { data: task } = await db.from("community_alpha_tasks").insert({
    run_id: run.id, anchor_date: weekDate, channel_id: ch.id, channel_name: ch.name,
    tighter_filter: ch.strict, status: "running", attempts: 1, started_at: new Date().toISOString(),
  }).select("id").single();

  try {
    const f = await fetchChannelWindow(slack, ch.id, w);
    const all = [...f.topLevel, ...f.replies].sort((a, b) => Number(a.ts) - Number(b.ts));
    const fr = filterMessages(all, CA_TEAM_IDS, priv);
    const names = new Map<string, string>();
    for (const u of new Set(fr.kept.map((m) => m.user!))) {
      try {
        const b = await slackCall(slack, "users.info", { user: u });
        names.set(u, b.user?.profile?.display_name || b.user?.real_name || b.user?.name || u);
      } catch { names.set(u, u); }
    }
    let ex;
    let toolError: string | null = null;
    try {
      ex = await extractIdeas(Deno.env.get("LOVABLE_API_KEY")!, ch, fr.kept, names, "forced_tool");
    } catch (e) {
      if (e instanceof AiError && (e.status === 402 || e.status === 403 || e.status === 401)) throw e;
      toolError = String((e as Error).message).slice(0, 300);
      ex = await extractIdeas(Deno.env.get("LOVABLE_API_KEY")!, ch, fr.kept, names, "json_schema");
    }
    const fetched = new Map(fr.kept.map((m) => [m.ts, m]));
    const excluded = new Set([...CA_TEAM_IDS, ...priv]);
    const v = validateIdeas(ex.ideas.map(toRawIdea), { channel: ch, fetched, excludedIds: excluded, names });
    await db.from("community_alpha_tasks").update({
      status: "done", finished_at: new Date().toISOString(),
      messages_fetched: all.length, team_excluded: fr.teamExcluded, tactical_author_excluded: fr.privateExcluded,
      tactical_dropped: ex.tactical_dropped, ideas: v.ideas, rejected: v.rejected,
      input_tokens: ex.input_tokens, output_tokens: ex.output_tokens,
    }).eq("id", task!.id);
    await db.from("community_alpha_runs").update({
      status: "done", finished_at: new Date().toISOString(), warnings: v.warnings,
      token_usage: { model: CA_MODEL, method: ex.method, input: ex.input_tokens, output: ex.output_tokens, aig_run_id: ex.runId },
    }).eq("id", run.id);
    return Response.json({
      runId: run.id, method: ex.method, toolError,
      counts: { fetched: all.length, kept: fr.kept.length, team: fr.teamExcluded },
      ideas: v.ideas.map((i) => ({ label: i.label, tickers: i.tickers, direction: i.direction, technical: i.technical, author: i.author_name, permalink: i.permalink, type: i.idea_type })),
      rejected: v.rejected, warnings: v.warnings, tactical_dropped: ex.tactical_dropped,
      tokens: { input: ex.input_tokens, output: ex.output_tokens }, aigRunId: ex.runId,
    });
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 500);
    await db.from("community_alpha_tasks").update({ status: "failed", error: msg }).eq("id", task!.id);
    await db.from("community_alpha_runs").update({ status: "failed", summary: msg }).eq("id", run.id);
    return Response.json({ error: msg, status: (e as AiError).status }, { status: 500 });
  }
});
