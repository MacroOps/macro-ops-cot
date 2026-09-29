import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SlackMessage } from "./filters.ts";
import { quoteFoundLoosely } from "./validate.ts";
import { decideDirection, OUTPUT_SCHEMA } from "./extract.ts";

Deno.test("direction check: code decides from author_view", () => {
  assertEquals(decideDirection("long", "positive"), "keep");
  assertEquals(decideDirection("buy", "positive"), "keep");
  assertEquals(decideDirection("bearish", "negative"), "keep");
  assertEquals(decideDirection("bullish", "negative"), "flip_prevented");
  assertEquals(decideDirection("short", "positive"), "flip_prevented");
  assertEquals(decideDirection("long", "unclear"), "unclear");
});

Deno.test("loose quote: parts with ..., Slack formatting ignored, across the thread", () => {
  const thread: SlackMessage[] = [
    { ts: "1", user: "U", text: "META — taking a step back, *lower highs* &amp; <https://x.com|rolling over>" },
    { ts: "2", user: "V", text: "agree, I'd stay away" },
  ];
  assert(quoteFoundLoosely("taking a step back ... rolling over", thread));
  assert(quoteFoundLoosely("I'd stay away", thread));
  assert(!quoteFoundLoosely("breaking down hard", thread));
});

Deno.test("loose quote: 'chart only' needs an attachment somewhere in the thread", () => {
  const img = { files: [{ filetype: "png", mimetype: "image/png", name: "chart.png" }] } as Partial<SlackMessage>;
  assert(quoteFoundLoosely("chart only", [{ ts: "1", user: "U", text: "$PRLB", ...img } as SlackMessage]));
  assert(!quoteFoundLoosely("chart only", [{ ts: "1", user: "U", text: "$PRLB" }]));
});

Deno.test("extraction schema has no direction_quote", () => {
  const item = (OUTPUT_SCHEMA.properties.ideas as any).items;
  assert(!("direction_quote" in item.properties));
  assert(!item.required.includes("direction_quote"));
});
