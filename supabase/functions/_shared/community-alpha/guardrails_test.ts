import { assert, assertEquals } from "jsr:@std/assert@1";
import { CA_CHANNELS, CA_TEAM_IDS } from "./config.ts";
import type { SlackMessage } from "./filters.ts";
import { checkDirectionQuote, type RawIdea, validateIdeas } from "./validate.ts";

const EQ = CA_CHANNELS.find((c) => c.id === "C6Q4C2WR1")!;
const img = { files: [{ filetype: "png", mimetype: "image/png", name: "chart.png" }] } as Partial<SlackMessage>;

Deno.test("direction_quote: verbatim, case- and whitespace-insensitive", () => {
  const m: SlackMessage = { ts: "1.1", user: "U1", text: "Gold looks\n  ROLLING over here, I'd stay away" };
  assert(checkDirectionQuote("gold looks rolling over", m, ["Gold"]));
  assert(checkDirectionQuote("  I'd   stay away ", m, ["Gold"]));
  assert(!checkDirectionQuote("gold is breaking down", m, ["Gold"]));
  assert(!checkDirectionQuote("", m, ["Gold"]));
});

Deno.test("direction_quote: over 15 words rejected", () => {
  const t = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";
  assert(!checkDirectionQuote(t, { ts: "1", user: "U", text: t }, []));
});

Deno.test("direction_quote: 'chart only' needs an attachment and no view words", () => {
  assert(checkDirectionQuote("chart only", { ts: "1", user: "U", text: "$PRLB", ...img } as SlackMessage, ["PRLB"]));
  assert(!checkDirectionQuote("chart only", { ts: "1", user: "U", text: "$PRLB" }, ["PRLB"]));
  assert(!checkDirectionQuote("chart only", { ts: "1", user: "U", text: "$PRLB rolling over", ...img } as SlackMessage, ["PRLB"]));
});

Deno.test("validator: bad quote rejected with reason direction_quote; review kept for passes", () => {
  const fetched = new Map<string, SlackMessage>([["1.1", { ts: "1.1", user: "UM", text: "Long copper, supply deficit" }]]);
  const base: RawIdea = {
    source_ts: "1.1", author_id: "UM", idea_type: "ticker+direction", tickers: ["Copper"], direction: "long",
    label: "Long copper", one_liner: "Supply deficit.", technical: false, direction_quote: "Long copper",
  };
  const r = validateIdeas([base, { ...base, direction_quote: "short copper" }], {
    channel: EQ, fetched, excludedIds: new Set(CA_TEAM_IDS), names: new Map([["UM", "M"]]),
  });
  assertEquals(r.ideas.length, 1);
  assertEquals(r.rejected[0].reason, "direction_quote");
  assertEquals(r.review[0].direction_quote, "Long copper");
  assert(!("direction_quote" in r.ideas[0]));
});
