// Regression: every approved idea in the live archive must pass the field/value rules.
// Reads the archive from CA_ARCHIVE_JSON (a JSON array of ideas); skipped if unset.
// Checks needing the original Slack message (source fetched, author match) are skipped.
import { assertEquals } from "jsr:@std/assert@1";
import { channelById } from "./config.ts";
import { checkFields } from "./validate.ts";

const path = Deno.env.get("CA_ARCHIVE_JSON");

Deno.test({
  name: "archive regression: all live ideas pass field rules",
  ignore: !path,
  fn() {
    const ideas = JSON.parse(Deno.readTextFileSync(path!)) as Record<string, unknown>[];
    const fails: string[] = [];
    const warns: string[] = [];
    for (const i of ideas) {
      const ch = channelById(i.channel_id as string);
      if (!ch) { fails.push(`${i.permalink}: unknown_channel ${i.channel_id}`); continue; }
      const t = String(i.tickers ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const r = checkFields({ ...i, tickers: t }, ch);
      if (!r.ok) fails.push(`${i.permalink} [${ch.name}] ${r.reason} tickers="${i.tickers}" type=${i.idea_type} dir=${i.direction}`);
      else warns.push(...r.warnings.map((w) => `${i.permalink}: ${w}`));
    }
    console.log(`archive: ${ideas.length - fails.length}/${ideas.length} pass; ${warns.length} warnings`);
    warns.forEach((w) => console.log("  warn", w));
    fails.forEach((f) => console.log("  FAIL", f));
    assertEquals(fails, []);
  },
});
