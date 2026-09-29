import { assertEquals } from "jsr:@std/assert@1";
import { summarizeAttachments } from "./filters.ts";
import { messagesPayload } from "./extract.ts";

Deno.test("files and link previews are summarized, contents never read", () => {
  const m = {
    ts: "1.000001", user: "U1", text: "$PRLB",
    files: [
      { mimetype: "image/png", filetype: "png", name: "chart.png", url_private: "https://x" },
      { mimetype: "application/pdf", filetype: "pdf", title: "Deck" },
      { mode: "tombstone" },
      { id: "F1" },
    ],
    attachments: [{ title: "NVDA earnings preview", from_url: "https://e.com" }, { from_url: "https://f.com/a" }],
  };
  assertEquals(summarizeAttachments(m), [
    "image: chart.png", "pdf: Deck", "file: (name hidden)", "link: NVDA earnings preview", "link: https://f.com/a",
  ]);
});

Deno.test("messages with nothing attached get an empty list in the AI payload", () => {
  const p = JSON.parse(messagesPayload([{ ts: "1.000001", user: "U1", text: "long X" }], new Map()));
  assertEquals(p[0].attachments, []);
});

Deno.test("threads are sent as units; pre-window parent is marked context_only", () => {
  const msgs = [
    { ts: "100.000001", user: "U1", text: "long A" },
    { ts: "101.000001", user: "U2", text: "reply to old", thread_ts: "50.000001" },
    { ts: "102.000001", user: "U3", text: "short B" },
    { ts: "103.000001", user: "U4", text: "reply to A", thread_ts: "100.000001" },
  ];
  const ctx = [{ ts: "50.000001", user: "U9", text: "old parent" }];
  const p = JSON.parse(messagesPayload(msgs, new Map(), ctx));
  assertEquals(p.map((m: any) => [m.message_ts, m.context_only]), [
    ["100.000001", false], ["103.000001", false],
    ["50.000001", true], ["101.000001", false],
    ["102.000001", false],
  ]);
});
