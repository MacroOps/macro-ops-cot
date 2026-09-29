import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  dueWindows,
  isInWindow,
  slackTsToMicros,
  weekDateForTs,
  windowForWeekDate,
} from "./window.ts";

const ts = (iso: string, micros = "000000") =>
  `${Math.floor(Date.parse(iso) / 1000)}.${micros}`;

Deno.test("normal PDT window: Fri 2:00 PM PT -> Fri 2:00 PM PT", () => {
  const w = windowForWeekDate("2026-09-25");
  assertEquals(w.startIso, "2026-09-18T21:00:00.000Z");
  assertEquals(w.endIso, "2026-09-25T21:00:00.000Z");
});

Deno.test("PST window stays at 2:00 PM PT (22:00 UTC)", () => {
  const w = windowForWeekDate("2026-12-11");
  assertEquals(w.startIso, "2026-12-04T22:00:00.000Z");
  assertEquals(w.endIso, "2026-12-11T22:00:00.000Z");
});

Deno.test("DST start week (Mar 8, 2026): start PST, end PDT, both 2:00 PM PT", () => {
  const w = windowForWeekDate("2026-03-13");
  assertEquals(w.startIso, "2026-03-06T22:00:00.000Z");
  assertEquals(w.endIso, "2026-03-13T21:00:00.000Z"); // 167-hour window
});

Deno.test("DST end week (Nov 1, 2026): start PDT, end PST, both 2:00 PM PT", () => {
  const w = windowForWeekDate("2026-11-06");
  assertEquals(w.startIso, "2026-10-30T21:00:00.000Z");
  assertEquals(w.endIso, "2026-11-06T22:00:00.000Z"); // 169-hour window
});

Deno.test("message at Fri 1:59 PM PT belongs to that Friday's window", () => {
  const t = ts("2026-09-25T20:59:00Z"); // 1:59 PM PDT
  assertEquals(weekDateForTs(t), "2026-09-25");
  assertEquals(isInWindow(t, windowForWeekDate("2026-09-25")), true);
  assertEquals(isInWindow(t, windowForWeekDate("2026-10-02")), false);
});

Deno.test("message at Fri 2:01 PM PT belongs to the next window", () => {
  const t = ts("2026-09-25T21:01:00Z"); // 2:01 PM PDT
  assertEquals(weekDateForTs(t), "2026-10-02");
  assertEquals(isInWindow(t, windowForWeekDate("2026-09-25")), false);
  assertEquals(isInWindow(t, windowForWeekDate("2026-10-02")), true);
});

Deno.test("exactly 2:00:00.000000 PM PT: end-inclusive, start-exclusive", () => {
  const t = ts("2026-09-25T21:00:00Z");
  assertEquals(weekDateForTs(t), "2026-09-25");
  assertEquals(isInWindow(t, windowForWeekDate("2026-09-25")), true);
  assertEquals(isInWindow(t, windowForWeekDate("2026-10-02")), false);
});

Deno.test("one microsecond after 2:00 PM PT goes to next window", () => {
  const t = ts("2026-09-25T21:00:00Z", "000001");
  assertEquals(weekDateForTs(t), "2026-10-02");
  assertEquals(isInWindow(t, windowForWeekDate("2026-09-25")), false);
  assertEquals(isInWindow(t, windowForWeekDate("2026-10-02")), true);
});

Deno.test("winter Friday check at 1:05 PM PT does NOT process that Friday", () => {
  // 21:05 UTC on Fri Dec 4, 2026 = 1:05 PM PST (before close)
  assertEquals(dueWindows("2026-11-27", new Date("2026-12-04T21:05:00Z")), []);
  // Next hourly check, 22:05 UTC = 2:05 PM PST -> due
  assertEquals(
    dueWindows("2026-11-27", new Date("2026-12-04T22:05:00Z")).map((w) => w.weekDate),
    ["2026-12-04"],
  );
});

Deno.test("summer Friday check at 21:05 UTC (2:05 PM PDT) processes that Friday", () => {
  assertEquals(
    dueWindows("2026-09-25", new Date("2026-10-02T21:05:00Z")).map((w) => w.weekDate),
    ["2026-10-02"],
  );
});

Deno.test("multi-week catch-up: one distinct window per missed week, oldest first", () => {
  const due = dueWindows("2026-09-18", new Date("2026-10-17T12:00:00Z"));
  assertEquals(due.map((w) => w.weekDate), ["2026-09-25", "2026-10-02", "2026-10-09", "2026-10-16"]);
  for (let i = 1; i < due.length; i++) assertEquals(due[i].startIso, due[i - 1].endIso);
});

Deno.test("catch-up across DST end keeps every boundary at 2:00 PM PT", () => {
  const due = dueWindows("2026-10-23", new Date("2026-11-14T00:00:00Z"));
  assertEquals(due.map((w) => [w.weekDate, w.endIso]), [
    ["2026-10-30", "2026-10-30T21:00:00.000Z"],
    ["2026-11-06", "2026-11-06T22:00:00.000Z"],
    ["2026-11-13", "2026-11-13T22:00:00.000Z"],
  ]);
});

Deno.test("result does not depend on when in the week the job runs", () => {
  const a = dueWindows("2026-09-25", new Date("2026-10-02T21:05:00Z"));
  const b = dueWindows("2026-09-25", new Date("2026-10-08T23:59:00Z"));
  const c = dueWindows("2026-09-25", new Date("2026-10-09T20:59:59Z")); // 1:59:59 PM PDT
  assertEquals(a, b);
  assertEquals(a, c);
});

Deno.test("nothing due when already up to date", () => {
  assertEquals(dueWindows("2026-10-02", new Date("2026-10-05T10:00:00Z")), []);
});

Deno.test("rejects non-Friday week dates and bad Slack ts", () => {
  assertThrows(() => windowForWeekDate("2026-09-24"));
  assertThrows(() => slackTsToMicros("abc"));
});
