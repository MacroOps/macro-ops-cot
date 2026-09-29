import { assertEquals } from "jsr:@std/assert@1";
import { parseMode, tableFor, toDays } from "./shape.ts";

Deno.test("mode validation", () => {
  assertEquals(parseMode(undefined), "live");
  assertEquals(parseMode("live"), "live");
  assertEquals(parseMode("staging"), "staging");
  assertEquals(parseMode("runs"), null);
  assertEquals(parseMode(1), null);
  assertEquals(tableFor("live"), "community_alpha_weeks");
  assertEquals(tableFor("staging"), "community_alpha_weeks_staging");
});

Deno.test("rows map to days, newest first, private fields stripped", () => {
  const out = toDays([
    { week_date: "2026-09-18", window_start: "a", window_end: "b", run_at: "2026-09-18T21:05:00Z", channels_scanned: 8, team_excluded_count: 2, tactical_excluded_count: 1, ideas: [] },
    { week_date: "2026-09-25", window_start: "c", window_end: "d", run_at: "2026-09-25T21:05:00Z", channels_scanned: null, team_excluded_count: null, tactical_excluded_count: 0,
      ideas: [{ author_id: "U1", posted_at_iso: "x", author_name: "A", tickers: "GLD", direction: "long", channel_name: "#general", channel_id: "C1", label: "L", one_liner: "o", idea_type: "trade", permalink: "p" }] },
  ]);
  assertEquals(out.generated_at, "2026-09-25T21:05:00Z");
  assertEquals(out.days.map((d) => d.date), ["2026-09-25", "2026-09-18"]);
  assertEquals(out.days[0].channels_scanned, 8);
  assertEquals(out.days[0].window, { oldest_iso: "c", latest_iso: "d" });
  const idea = out.days[0].ideas[0] as Record<string, unknown>;
  assertEquals("author_id" in idea, false);
  assertEquals("posted_at_iso" in idea, false);
  assertEquals(idea.technical, false);
  assertEquals(idea.tickers, "GLD");
});
