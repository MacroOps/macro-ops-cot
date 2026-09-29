// TEMPORARY step-3 dry run: counts only, nothing saved, no text/names/IDs returned.
// Only closed test weeks 2026-09-18 and 2026-09-25. Delete after step 3.
import { CA_CHANNELS, CA_TEAM_IDS, parsePrivateList } from "../_shared/community-alpha/config.ts";
import { filterMessages } from "../_shared/community-alpha/filters.ts";
import { fetchChannelWindow, SlackError } from "../_shared/community-alpha/slack.ts";
import { windowForWeekDate } from "../_shared/community-alpha/window.ts";

const ALLOWED_WEEKS = new Set(["2026-09-18", "2026-09-25"]);
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const week = u.searchParams.get("week") ?? "";
  const channelId = u.searchParams.get("channel") ?? "";
  if (!ALLOWED_WEEKS.has(week)) return json({ error: "week not allowed" }, 400);
  const ch = CA_CHANNELS.find((c) => c.id === channelId);
  if (!ch) return json({ error: "unknown channel" }, 400);
  const token = Deno.env.get("CA_SLACK_BOT_TOKEN");
  if (!token) return json({ error: "missing token" }, 500);
  const privateIds = parsePrivateList(Deno.env.get("CA_PRIVATE_IDS"));

  const w = windowForWeekDate(week);
  try {
    const f = await fetchChannelWindow(token, ch.id, w);
    const r = filterMessages([...f.topLevel, ...f.replies], CA_TEAM_IDS, privateIds);
    return json({
      week, channel: ch.name,
      messages_fetched: f.topLevel.length,
      thread_replies_fetched: f.replies.length,
      duplicates_removed: r.duplicates,
      team_removed: r.teamExcluded,
      private_removed: r.privateExcluded,
      bot_system_removed: r.botOrSystem,
      empty_emoji_removed: r.emptyOrEmoji,
      left_for_ai: r.kept.length,
      private_list_size: privateIds.size,
    });
  } catch (e) {
    if (e instanceof SlackError) return json({ week, channel: ch.name, slack_error: e.slackError, method: e.method });
    return json({ week, channel: ch.name, error: String((e as Error).message) });
  }
});
