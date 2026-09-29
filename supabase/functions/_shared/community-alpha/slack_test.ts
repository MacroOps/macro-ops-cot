// Slack reader tests with a stubbed fetch (no network).
import { assertEquals } from "jsr:@std/assert@1";
import { fetchChannelWindow, PARENT_LOOKBACK_DAYS } from "./slack.ts";
import { windowForWeekDate } from "./window.ts";

const w = windowForWeekDate("2026-09-25");
const startSec = Number(w.startMicros / 1_000_000n);
const endSec = Number(w.endMicros / 1_000_000n);
const ts = (sec: number) => `${sec}.000100`;

const inParent = ts(startSec + 3600);
const oldParent = ts(startSec - 3 * 86400); // has an in-window reply
const staleParent = ts(startSec - 5 * 86400); // last reply before the window

function stub(calls: string[]) {
  return (async (input: string | URL) => {
    const u = new URL(String(input));
    const method = u.pathname.split("/").pop()!;
    calls.push(`${method}:${u.searchParams.get("ts") ?? u.searchParams.get("oldest")}`);
    if (method === "conversations.history") {
      // Pretend Slack also returned an old parent (should be ignored anyway).
      return Response.json({
        ok: true,
        messages: [
          { ts: inParent, user: "U1", text: "long X", reply_count: 2, latest_reply: ts(endSec + 60) },
          { ts: oldParent, user: "U2", text: "old", reply_count: 1, latest_reply: ts(startSec + 60) },
          { ts: staleParent, user: "U4", text: "stale", reply_count: 1, latest_reply: ts(startSec - 60) },
        ],
      });
    }
    const parent = u.searchParams.get("ts")!;
    return Response.json({
      ok: true,
      messages: [
        { ts: parent, thread_ts: parent, user: "U1", text: "parent" },
        { ts: ts(startSec + 7200), thread_ts: parent, user: "U3", text: "in-window reply" },
        { ts: ts(endSec + 60), thread_ts: parent, user: "U3", text: "after close" },
      ],
    });
  }) as typeof fetch;
}

Deno.test("history looks back for older thread parents", async () => {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = stub(calls);
  try {
    await fetchChannelWindow("x", "C1", w);
    assertEquals(calls[0], `conversations.history:${startSec - PARENT_LOOKBACK_DAYS * 86400}`);
  } finally { globalThis.fetch = orig; }
});

Deno.test("older parent with an in-window reply is read and returned as context only", async () => {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = stub(calls);
  try {
    const r = await fetchChannelWindow("x", "C1", w);
    assertEquals(calls.filter((c) => c.startsWith("conversations.replies")).sort(),
      [`conversations.replies:${inParent}`, `conversations.replies:${oldParent}`].sort());
    assertEquals(r.topLevel.map((m) => m.ts), [inParent]);
    assertEquals(r.contextParents.map((m) => m.ts), [oldParent]);
    // Each reply judged by its own ts: the after-close replies are dropped.
    assertEquals(r.replies.map((m) => m.text), ["in-window reply", "in-window reply"]);
  } finally { globalThis.fetch = orig; }
});
