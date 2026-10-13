import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { DirectionCheckError, mergeSameAuthor, parseCheckAnswers } from "./postcheck.ts";

const ok = (id: number, v = "positive") => ({ id, reason: "r", author_view: v, quote: "q" });

Deno.test("valid list of checks is accepted", () => {
  const m = parseCheckAnswers({ checks: [ok(0), ok(1, "negative")] }, 2);
  assertEquals(m.get(1)?.author_view, "negative");
});
Deno.test("checks sent as JSON text is accepted when valid", () => {
  assertEquals(parseCheckAnswers({ checks: JSON.stringify([ok(0)]) }, 1).size, 1);
});
Deno.test("broken text (Oct 2 commodities shape) fails", () => {
  assertThrows(() => parseCheckAnswers({ checks: '[{"id":0,"reason":"x","author_view":"positive","quote":"y"},"id":0}]' }, 5), DirectionCheckError);
});
Deno.test("missing idea fails", () => {
  assertThrows(() => parseCheckAnswers({ checks: [ok(0)] }, 2), DirectionCheckError);
});
Deno.test("invalid view fails", () => {
  assertThrows(() => parseCheckAnswers({ checks: [ok(0, "bullish")] }, 1), DirectionCheckError);
});
Deno.test("empty output fails", () => {
  assertThrows(() => parseCheckAnswers({}, 1), DirectionCheckError);
});

Deno.test("corn short then long from same author keeps the long (latest)", () => {
  const r = mergeSameAuthor([
    { author_id: "U1", tickers: "ZC", source_ts: "1790785610.611429" },
    { author_id: "U1", tickers: "zc ", source_ts: "1790898165.405289" },
  ]);
  assertEquals(r, { keep: [1], dropped: [0] });
});
Deno.test("different authors on same instrument are both kept", () => {
  assertEquals(mergeSameAuthor([
    { author_id: "U1", tickers: "ZC", source_ts: "1" }, { author_id: "U2", tickers: "ZC", source_ts: "2" },
  ]).keep, [0, 1]);
});
Deno.test("same author, different first instrument both kept", () => {
  assertEquals(mergeSameAuthor([
    { author_id: "U1", tickers: "ZC, ZS", source_ts: "1" }, { author_id: "U1", tickers: "ZS, ZC", source_ts: "2" },
  ]).keep, [0, 1]);
});
