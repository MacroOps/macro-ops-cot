import { assert, assertEquals } from "jsr:@std/assert@1";
import { CA_TEAM_IDS, channelById, parsePrivateList } from "./config.ts";
import { filterMessages, isEmptyOrEmojiOnly, type SlackMessage } from "./filters.ts";
import { type CaIdea, type RawIdea, validateIdeas, type ValidateContext } from "./validate.ts";
import { canReprocessWeek, type ChannelResult, ideaKey, mergeWeek } from "./merge.ts";

const EQ = channelById("C6Q4C2WR1")!;
const GEN = channelById("C6Q22AT9R")!;
const PRIVATE = parsePrivateList("UPRIV0001, UPRIV0002");

// ---------- filters ----------
Deno.test("filters: removes and counts team, private, bot/system, empty/emoji", () => {
  const msgs: SlackMessage[] = [
    { ts: "1.1", user: "UMEMBER1", text: "Long $XLE on refinery margins" },
    { ts: "1.2", user: "U6PEHV6RW", text: "team post" },
    { ts: "1.3", user: "UUSBEJG9K", text: "another team post" },
    { ts: "1.4", user: "UPRIV0001", text: "private-list post" },
    { ts: "1.5", bot_id: "B1", text: "bot says hi" },
    { ts: "1.6", user: "UMEMBER2", subtype: "channel_join", text: "joined" },
    { ts: "1.7", user: "UMEMBER2", text: ":rocket: :fire::skin-tone-3:" },
    { ts: "1.8", user: "UMEMBER2", text: "🚀🔥 👍🏽" },
    { ts: "1.9", user: "UMEMBER2", text: "   " },
    { ts: "2.0", user: "UMEMBER3", subtype: "thread_broadcast", text: "Short TLT", thread_ts: "1.1" },
    { ts: "2.1", user: "UMEMBER3", text: "🚀 Long NVDA" },
  ];
  const r = filterMessages(msgs, CA_TEAM_IDS, PRIVATE);
  assertEquals(r.kept.map((m) => m.ts), ["1.1", "2.0", "2.1"]);
  assertEquals(r.teamExcluded, 2);
  assertEquals(r.privateExcluded, 1);
  assertEquals(r.botOrSystem, 2);
  assertEquals(r.emptyOrEmoji, 3);
});

Deno.test("filters: emoji-only detection", () => {
  assert(isEmptyOrEmojiOnly(undefined));
  assert(isEmptyOrEmojiOnly(":+1: :100:"));
  assert(isEmptyOrEmojiOnly("🇺🇸 ❤️"));
  assert(!isEmptyOrEmojiOnly("GLD 🚀"));
});

// ---------- validator ----------
const fetched = new Map<string, SlackMessage>([
  ["1790267660.344059", { ts: "1790267660.344059", user: "UF32P1XNV", text: "PRLB chart" }],
  ["1790267700.000100", { ts: "1790267700.000100", user: "UDRJF2Y68", text: "reply", thread_ts: "1790267660.344059" }],
]);
const ctx = (channel = EQ): ValidateContext => ({
  channel,
  fetched,
  excludedIds: new Set([...CA_TEAM_IDS, ...PRIVATE]),
  names: new Map([["UF32P1XNV", "ErikPSC"], ["UDRJF2Y68", "ChrisM"]]),
});
const raw = (o: Partial<RawIdea> = {}): RawIdea => ({
  source_ts: "1790267660.344059",
  author_id: "UF32P1XNV",
  idea_type: "ticker+direction",
  tickers: ["prlb"],
  direction: "bullish",
  label: "Bullish PRLB",
  one_liner: "Flags PRLB with a chart; constructive setup.",
  technical: true,
  ...o,
});

Deno.test("validator: valid idea gets code-built permalink, PT timestamp, archive fields", () => {
  const { ideas, rejected } = validateIdeas([raw()], ctx());
  assertEquals(rejected, []);
  assertEquals(ideas[0], {
    author_id: "UF32P1XNV",
    author_name: "ErikPSC",
    channel_id: "C6Q4C2WR1",
    channel_name: "#ideas-equities",
    direction: "bullish",
    idea_type: "ticker+direction",
    label: "Bullish PRLB",
    one_liner: "Flags PRLB with a chart; constructive setup.",
    permalink: "https://comm-center.slack.com/archives/C6Q4C2WR1/p1790267660344059",
    posted_at_iso: "2026-09-24T09:34:20-07:00", // matches the archive row
    technical: true,
    tickers: "PRLB",
  });
});

Deno.test("validator: thread reply permalink includes thread_ts", () => {
  const { ideas } = validateIdeas([raw({ source_ts: "1790267700.000100", author_id: "UDRJF2Y68" })], ctx());
  assertEquals(
    ideas[0].permalink,
    "https://comm-center.slack.com/archives/C6Q4C2WR1/p1790267700000100?thread_ts=1790267660.344059&cid=C6Q4C2WR1",
  );
});

Deno.test("validator: rejects each bad case with a reason", () => {
  const cases: [Partial<RawIdea>, string][] = [
    [{ source_ts: "9.9" }, "unknown_source"],
    [{ author_id: "UDRJF2Y68" }, "author_mismatch"],
    [{ idea_type: "hunch" }, "bad_idea_type"],
    [{ direction: "moon" }, "bad_direction"],
    [{ tickers: [] }, "bad_tickers"],
    [{ tickers: ["  "] }, "bad_tickers"],
    [{ label: "" }, "bad_label"],
    [{ one_liner: "" }, "bad_one_liner"],
    [{ technical: "yes" as unknown as boolean }, "bad_technical"],
  ];
  for (const [o, reason] of cases) {
    const r = validateIdeas([raw(o)], ctx());
    assertEquals(r.ideas.length, 0, reason);
    assertEquals(r.rejected[0].reason, reason);
  }
});

Deno.test("validator: excluded author rejected even if AI returns it", () => {
  const f = new Map(fetched);
  f.set("5.5", { ts: "5.5", user: "UPRIV0002", text: "x" });
  const r = validateIdeas([raw({ source_ts: "5.5", author_id: "UPRIV0002" })], { ...ctx(), fetched: f });
  assertEquals(r.rejected[0].reason, "excluded_author");
});

Deno.test("validator: thesis allowed with no tickers outside #general, 25 words OK", () => {
  const r = validateIdeas(
    [raw({ idea_type: "thesis", tickers: [], one_liner: Array(25).fill("w").join(" ") })],
    ctx(),
  );
  assertEquals(r.ideas.length, 1);
});

Deno.test("validator: #general keeps only ticker + direction", () => {
  const ok = validateIdeas([raw()], ctx(GEN));
  assertEquals(ok.ideas.length, 1);
  const thesis = validateIdeas([raw({ idea_type: "thesis", tickers: ["GLD"] })], ctx(GEN));
  assertEquals(thesis.rejected[0].reason, "general_requires_ticker_direction");
});

// ---------- merge ----------
let n = 0;
const idea = (channel_id: string, posted: string, tickers = "AAA", o: Partial<CaIdea> = {}): CaIdea => ({
  author_id: "U1",
  author_name: "A",
  channel_id,
  channel_name: channelById(channel_id)?.name ?? "?",
  direction: "long",
  idea_type: "ticker+direction",
  label: "L",
  one_liner: "x",
  permalink: `https://comm-center.slack.com/archives/${channel_id}/p${++n}`,
  posted_at_iso: posted,
  technical: false,
  tickers,
  ...o,
});

Deno.test("merge: idea key = permalink + sorted tickers; one message can yield several ideas", () => {
  const a = idea(EQ.id, "2026-09-24T09:00:00-07:00", "DIM.FP, SRT.GR");
  assertEquals(ideaKey(a), ideaKey({ ...a, tickers: "srt.gr,DIM.FP" }));
  const b = { ...a, tickers: "GLD" };
  const r = mergeWeek([], [{ channelId: EQ.id, ok: true, ideas: [a, b, { ...a }] }]);
  assertEquals(r.ideas.length, 2);
});

Deno.test("merge: replace per week — successful channel replaces its old ideas", () => {
  const old = idea(EQ.id, "2026-09-23T09:00:00-07:00", "OLD");
  const fresh = idea(EQ.id, "2026-09-24T09:00:00-07:00", "NEW");
  const r = mergeWeek([old], [{ channelId: EQ.id, ok: true, ideas: [fresh] }]);
  assertEquals(r.ideas.map((i) => i.tickers), ["NEW"]);
});

Deno.test("merge: failed channel keeps its previous ideas", () => {
  const prevGen = idea(GEN.id, "2026-09-23T09:00:00-07:00", "GLD");
  const fresh = idea(EQ.id, "2026-09-24T09:00:00-07:00", "NEW");
  const results: ChannelResult[] = [
    { channelId: EQ.id, ok: true, ideas: [fresh] },
    { channelId: GEN.id, ok: false, ideas: [] },
  ];
  const r = mergeWeek([prevGen], results);
  assertEquals(r.ideas.map((i) => i.tickers), ["NEW", "GLD"]);
  assertEquals(r.keptPrevious, [GEN.id]);
});

Deno.test("merge: re-running with the same results is idempotent (no duplicates)", () => {
  const results: ChannelResult[] = [
    { channelId: EQ.id, ok: true, ideas: [idea(EQ.id, "2026-09-24T09:00:00-07:00", "A"), idea(EQ.id, "2026-09-22T09:00:00-07:00", "B")] },
    { channelId: GEN.id, ok: true, ideas: [idea(GEN.id, "2026-09-23T09:00:00-07:00", "C")] },
  ];
  const once = mergeWeek([], results).ideas;
  const twice = mergeWeek(once, results).ideas;
  assertEquals(twice, once);
  assertEquals(twice.length, 3);
});

Deno.test("merge: cap 50 keeps non-#general first, then newest, and reports drops", () => {
  const eq: CaIdea[] = [];
  for (let d = 0; d < 45; d++) eq.push(idea(EQ.id, new Date(Date.UTC(2026, 8, 19, 0, d)).toISOString(), `E${d}`));
  const gen: CaIdea[] = [];
  for (let d = 0; d < 10; d++) gen.push(idea(GEN.id, new Date(Date.UTC(2026, 8, 25, 0, d)).toISOString(), `G${d}`));
  const r = mergeWeek([], [
    { channelId: EQ.id, ok: true, ideas: eq },
    { channelId: GEN.id, ok: true, ideas: gen },
  ]);
  assertEquals(r.ideas.length, 50);
  assertEquals(r.capDropped, 5);
  assertEquals(r.ideas.filter((i) => i.channel_id === EQ.id).length, 45); // all non-#general kept
  const keptGen = r.ideas.filter((i) => i.channel_id === GEN.id).map((i) => i.tickers);
  assertEquals(keptGen, ["G9", "G8", "G7", "G6", "G5"]); // newest #general kept
});

Deno.test("archive protection: 'archive' weeks only reprocessed when explicitly forced", () => {
  assertEquals(canReprocessWeek(null), true);
  assertEquals(canReprocessWeek({ source: "job" }), true);
  assertEquals(canReprocessWeek({ source: "archive" }), false);
  assertEquals(canReprocessWeek({ source: "archive" }, { forceArchive: true }), true);
});

Deno.test("validator: non-ticker names/themes accepted as tickers", () => {
  for (const t of [["Copper"], ["Gold", "Silver"], ["EU banks"], ["Ags"], ["HY credit"]]) {
    const r = validateIdeas([raw({ tickers: t })], ctx());
    assertEquals(r.rejected, [], t.join());
    assertEquals(r.ideas[0].tickers, t.join(", "));
  }
});

Deno.test("validator: one-liner over 25 words kept with internal warning", () => {
  const r = validateIdeas([raw({ one_liner: Array(28).fill("w").join(" ") })], ctx());
  assertEquals(r.ideas.length, 1);
  assertEquals(r.warnings, [{ source_ts: raw().source_ts, warning: "one_liner_long:28_words" }]);
});

Deno.test("filters: broadcast thread reply seen in history and replies counted once", () => {
  const b: SlackMessage = { ts: "1790267700.000100", thread_ts: "1790267660.344059", user: "UDRJF2Y68", subtype: "thread_broadcast", text: "Long GLD" };
  const r = filterMessages([b, { ...b, subtype: undefined }, { ts: "1.1", user: "UX", text: "Short TLT" }], new Set(), new Set());
  assertEquals(r.kept.length, 2);
  assertEquals(r.duplicates, 1);
  assertEquals(r.kept.filter((m) => m.ts === b.ts).length, 1);
});
