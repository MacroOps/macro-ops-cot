import { assertEquals } from "jsr:@std/assert@1";
import { mergeSameAuthor, selectSecondLook } from "./postcheck.ts";

const m = (ts: string, thread_ts?: string) => ({ ts, thread_ts });

Deno.test("second look: sources of kept ideas excluded; their thread mates go as context", () => {
  const kept = [m("1"), m("2", "1"), m("3"), m("4", "3")];
  const r = selectSecondLook(kept, new Set(["1", "3", "4"]));
  assertEquals(r.candidates.map((x) => x.ts), ["2"]);
  assertEquals(r.mates.map((x) => x.ts), ["1"]);
});

Deno.test("second look: nothing left when every message produced an idea", () => {
  assertEquals(selectSecondLook([m("1")], new Set(["1"])).candidates.length, 0);
});

Deno.test("merge across passes keeps the latest message", () => {
  const r = mergeSameAuthor([
    { author_id: "U1", tickers: "THNQ", source_ts: "100" }, // pass 1
    { author_id: "U1", tickers: "THNQ", source_ts: "200" }, // second look
  ]);
  assertEquals(r.keep, [1]);
});
