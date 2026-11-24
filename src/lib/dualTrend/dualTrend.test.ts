import { describe, it, expect, beforeEach } from "vitest";
import { signalAll } from "@/lib/mops/paginate";
import type { MopsSignalRow } from "@/lib/mops/types";
import { buildListRows, buildMemberRows, DT_KEYS, epochDaysToIso, type DtKey } from "./build";
import { loadReturns, getCachedReturn, pickLatest, returnsCacheKey, __resetReturnsMemory } from "./returns";
import { buildWorkList, computeReturn, makeThrottle } from "../../../supabase/functions/_shared/dual-trend/returns-math";

const rows = (n: number, offset = 0): MopsSignalRow[] =>
  Array.from({ length: n }, (_, i) => ({ entity: `S${offset + i}`, date: "2026-11-13", value: 1 }));

describe("signalAll pagination", () => {
  it("keeps paging with offset += limit until a short page, ignoring has_more", async () => {
    const offsets: number[] = [];
    const out = await signalAll({ key: "k" }, async (p) => {
      offsets.push(Number(p.offset));
      // pages of 3, 3, then 1 (short) — has_more would have said false every time
      return Number(p.offset) < 6 ? rows(3, Number(p.offset)) : rows(1, 6);
    }, 3);
    expect(offsets).toEqual([0, 3, 6]);
    expect(out).toHaveLength(7);
  });

  it("stops after an exactly-full page followed by an empty page", async () => {
    const offsets: number[] = [];
    const out = await signalAll({ key: "k" }, async (p) => {
      offsets.push(Number(p.offset));
      return Number(p.offset) === 0 ? rows(2) : [];
    }, 2);
    expect(offsets).toEqual([0, 2]);
    expect(out).toHaveLength(2);
  });
});

function maps(values: Partial<Record<DtKey, Record<string, number>>>) {
  return Object.fromEntries(
    DT_KEYS.map((k) => [k, new Map(Object.entries(values[k] ?? {}))]),
  ) as Record<DtKey, Map<string, number>>;
}

describe("member rows", () => {
  const m = maps({
    trend_rel_lt_value1: { AAPL: 70 }, trend_rel_lt_value2: { AAPL: 40 },
    trend_rel_lt_state: { AAPL: 1 }, trend_rel_lt_days: { AAPL: 132 }, trend_rel_lt_start: { AAPL: 20581 },
    trend_rel_st_value1: { AAPL: 90 }, trend_rel_st_state: { AAPL: -1 }, trend_rel_st_days: { AAPL: 4 },
  });

  it("uses value1/value2 as-is (no x10)", () => {
    const [r] = buildMemberRows(["AAPL"], m, new Map(), {});
    expect(r.lt.trend).toBe(70);
    expect(r.lt.relative).toBe(40);
    expect(r.st.trend).toBe(90);
  });

  it("passes API days and start date through", () => {
    const [r] = buildMemberRows(["AAPL"], m, new Map(), {});
    expect(r.lt.days).toBe(132);
    expect(r.lt.start).toBe("2026-05-08");
    expect(epochDaysToIso(20581)).toBe("2026-05-08");
    expect(r.st.days).toBe(4);
    expect(r.st.signal).toBe("Bearish");
  });

  it("membership comes from the API list, not SPX_UNIVERSE-style metadata", () => {
    const meta = { AAPL: ["Apple", "INFT", "Tech Hardware"] as [string, string, string], MSFT: ["Microsoft", "INFT", "Software"] as [string, string, string] };
    const out = buildMemberRows(["AAPL", "ZION"], m, new Map([["ZION", "Financials"]]), meta);
    expect(out.map((r) => r.symbol)).toEqual(["AAPL", "ZION"]);
    expect(out[0].name).toBe("Apple");
    expect(out[0].subGroup).toBe("Tech Hardware");
    expect(out[1].name).toBe("");
    expect(out[1].group).toBe("Financials");
  });
});

describe("custom list rows", () => {
  it("uses the list's own values and tags the category", () => {
    const out = buildListRows({
      instruments: { XLK: { values: { trend_rel_lt_value1: 80, trend_rel_lt_state: 1, trend_rel_lt_days: 10, trend_rel_lt_start: 20759 } } },
      memberships: [{ entity_a: "XLK", metadata: { display_names: ["Tech SPDR"], categories: ["Sector"] } }],
    }, "Sector");
    expect(out[0]).toMatchObject({ symbol: "XLK", name: "Tech SPDR", group: "Sector" });
    expect(out[0].lt.trend).toBe(80);
    expect(out[0].lt.days).toBe(10);
    expect(out[0].lt.start).toBe("2026-11-02");
  });

  it("empty category groups each member by its own category (Thematic Stocks)", () => {
    const out = buildListRows({
      memberships: [
        { entity_a: "NVDA", metadata: { display_names: ["NVIDIA"], categories: ["Semiconductors"] } },
        { entity_a: "PLTR", metadata: { display_names: ["Palantir"], categories: ["Artificial Intelligence"] } },
      ],
    }, "");
    expect(out.map((r) => [r.symbol, r.group, r.subGroup])).toEqual([
      ["NVDA", "Semiconductors", ""],
      ["PLTR", "Artificial Intelligence", ""],
    ]);
  });
});

describe("saved returns", () => {
  beforeEach(() => { __resetReturnsMemory(); });

  it("cache key is symbol + start date + as-of date", () => {
    expect(returnsCacheKey("aapl", "2026-05-08", "2026-11-13")).toBe("AAPL|2026-05-08|2026-11-13");
  });

  it("uses today's row when it exists", () => {
    const m = pickLatest([
      { symbol: "AAPL", start_date: "2026-05-08", as_of: "2026-11-12", ret: 20, net: 18 },
      { symbol: "AAPL", start_date: "2026-05-08", as_of: "2026-11-13", ret: 21.46, net: 19.27 },
    ], "2026-11-13");
    expect(m.get("AAPL|2026-05-08")).toEqual({ ret: 21.46, net: 19.27, asOf: "2026-11-13" });
  });

  it("falls back to the previous day's row for the same start date, with its as-of date", async () => {
    await loadReturns([{ symbol: "AAPL", start: "2026-05-08" }], "2026-11-13", undefined, async () => [
      { symbol: "AAPL", start_date: "2026-05-08", as_of: "2026-11-12", ret: 20, net: 18 },
    ]);
    expect(getCachedReturn("AAPL", "2026-05-08", "2026-11-13")).toEqual({ ret: 20, net: 18, asOf: "2026-11-12" });
  });

  it("a new start date with no saved row shows a dash, never a return from another start date", async () => {
    await loadReturns([{ symbol: "AAPL", start: "2026-11-10" }], "2026-11-13", undefined, async () => [
      { symbol: "AAPL", start_date: "2026-05-08", as_of: "2026-11-13", ret: 21.46, net: 19.27 },
    ]);
    expect(getCachedReturn("AAPL", "2026-11-10", "2026-11-13")).toBeUndefined();
  });

  it("does not re-read on the same as-of date", async () => {
    let calls = 0;
    const f = async () => { calls++; return []; };
    const reqs = Array.from({ length: 100 }, (_, i) => ({ symbol: `S${i}`, start: "2026-10-01" }));
    await loadReturns(reqs, "2026-11-13", undefined, f);
    expect(calls).toBe(3); // 40 + 40 + 20 symbols
    await loadReturns(reqs, "2026-11-13", undefined, f);
    expect(calls).toBe(3);
  });
});

describe("daily job math", () => {
  const sym = [{ date: "2026-05-07", close: 100 }, { date: "2026-05-11", close: 110 }, { date: "2026-11-13", close: 121 }];
  const spx = [{ date: "2026-05-07", close: 1000 }, { date: "2026-11-13", close: 1100 }];

  it("return = as-of close / start close - 1; net = minus benchmark", () => {
    const r = computeReturn(sym, spx, "2026-05-11", "2026-11-13");
    expect(r.ret).toBeCloseTo(10, 6);
    expect(r.net).toBeCloseTo(0, 6);
  });

  it("a start date with no trading row uses the prior close", () => {
    const r = computeReturn(sym, spx, "2026-05-09", "2026-11-13"); // Saturday -> May 7 close 100
    expect(r.ret).toBeCloseTo(21, 6);
    expect(r.net).toBeCloseTo(11, 6);
  });

  it("a missing series is blank, not 0", () => {
    expect(computeReturn([], spx, "2026-05-09", "2026-11-13")).toEqual({ ret: null, net: null });
  });

  it("throttle never exceeds 40 requests in any 60s window", async () => {
    let t = 0;
    const th = makeThrottle(40, () => t, async (ms) => { t += ms; });
    const times: number[] = [];
    for (let i = 0; i < 200; i++) { await th(); times.push(t); }
    for (let i = 0; i < times.length; i++) {
      expect(times.filter((x) => x >= times[i] && x < times[i] + 60_000).length).toBeLessThanOrEqual(40);
    }
  });

  it("work list has each symbol once across universes", () => {
    const w = buildWorkList([
      { symbol: "aapl", starts: ["2026-05-08"] },
      { symbol: "AAPL ", starts: ["2026-11-01", "2026-05-08"] },
      { symbol: "XLK", starts: ["2026-10-01", ""] },
    ]);
    expect(w).toEqual([
      { symbol: "AAPL", starts: ["2026-05-08", "2026-11-01"] },
      { symbol: "XLK", starts: ["2026-10-01"] },
    ]);
  });
});

describe("index rows come from the member list only", () => {
  it("row count equals member count even when signals and names include extra symbols", () => {
    const members = Array.from({ length: 604 }, (_, i) => `M${i}`);
    const m = Object.fromEntries(DT_KEYS.map((k) => [k, new Map<string, number>(
      [...members, "EXTRA1", "EXTRA2"].map((s) => [s, 1]),
    )])) as Record<DtKey, Map<string, number>>;
    const meta = { EXTRA3: ["Extra", "Tech", "Sub"] as [string, string, string] };
    const sectors = new Map([["EXTRA4", "Energy"]]);
    const out = buildMemberRows(members, m, sectors, meta);
    expect(out).toHaveLength(604);
    expect(out.some((r) => r.symbol.startsWith("EXTRA"))).toBe(false);
  });
});

import { latestFullDay, priorSavedDay, toKeyMaps } from "./saved";
import { backfillDates, mergeSnapshots, workListFromSaved } from "../../../supabase/functions/_shared/dual-trend/returns-math";

describe("saved signals", () => {
  const days = [
    { as_of: "2026-11-16", kind: "full" }, { as_of: "2026-11-13", kind: "full" },
    { as_of: "2026-11-12", kind: "states" }, { as_of: "2026-11-11", kind: "states" },
    { as_of: "2026-11-10", kind: "states" }, { as_of: "2026-11-09", kind: "states" },
    { as_of: "2026-11-06", kind: "states" },
  ];
  it("uses the newest fully saved day", () => {
    expect(latestFullDay(days)).toBe("2026-11-16");
  });
  it("falls back to the previous saved day when today isn't fully saved (half-saved never read)", () => {
    expect(latestFullDay([{ as_of: "2026-11-17", kind: "states" }, ...days])).toBe("2026-11-16");
  });
  it("5-day change compares with the saved day 5 trading days earlier", () => {
    expect(priorSavedDay(days, "2026-11-16", 5)).toBe("2026-11-09");
  });
  it("first-run backfill saves the 5 prior trading days that are missing", () => {
    const cal = ["2026-11-16", "2026-11-13", "2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09", "2026-11-06"];
    expect(backfillDates(cal, [], "2026-11-16")).toEqual(["2026-11-13", "2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09"]);
    expect(backfillDates(cal, ["2026-11-13", "2026-11-12"], "2026-11-16")).toEqual(["2026-11-11", "2026-11-10", "2026-11-09"]);
  });
  it("saved values are stored and read as-is (no x10)", () => {
    const merged = mergeSnapshots({ trend_rel_lt_value1: [{ entity: "aapl", value: 73.4 }] });
    expect(merged.get("AAPL")).toEqual({ trend_rel_lt_value1: 73.4 });
    expect(toKeyMaps([{ symbol: "AAPL", vals: merged.get("AAPL")! }]).trend_rel_lt_value1.get("AAPL")).toBe(73.4);
  });
  it("returns work list uses start dates from saved signals", () => {
    const vals = new Map([["AAPL", { trend_rel_lt_start: 20580, trend_rel_st_start: 20400 }]]);
    expect(workListFromSaved(["AAPL", "NEW"], vals)).toEqual([
      { symbol: "AAPL", starts: [epochDaysToIso(20400), epochDaysToIso(20580)].sort() },
    ]);
  });
  it("row count equals saved member count", () => {
    const maps = toKeyMaps([{ symbol: "A", vals: { trend_rel_lt_state: 1 } }, { symbol: "EXTRA", vals: { trend_rel_lt_state: 1 } }]);
    expect(buildMemberRows(["A", "B"], maps, new Map(), {})).toHaveLength(2);
  });
});
