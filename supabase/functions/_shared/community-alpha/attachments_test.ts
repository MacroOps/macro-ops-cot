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
