import { describe, it, expect, beforeEach } from "vitest";
import { signalAll } from "@/lib/mops/paginate";
import type { MopsSignalRow } from "@/lib/mops/types";
import { buildListRows, buildMemberRows, DT_KEYS, epochDaysToIso, type DtKey } from "./build";
import { loadReturns, getCachedReturn, returnsCacheKey, __resetReturnsMemory } from "./returns";

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
    expect(out[0].lt.start).toBe("2026-10-31");
  });
});

describe("returns cache", () => {
  beforeEach(() => { localStorage.clear(); __resetReturnsMemory(); });

  it("cache key is symbol + start date + as-of date", () => {
    expect(returnsCacheKey("aapl", "2026-05-08", "2026-11-13")).toBe("AAPL|2026-05-08|2026-11-13");
  });

  it("batches and does not refetch on the same as-of date, but refetches on a new one", async () => {
    const calls: number[] = [];
    const fetcher = async (items: { symbol: string; dates: string[] }[]) => {
      calls.push(items.length);
      return Object.fromEntries(items.map((it) => [it.symbol, Object.fromEntries(it.dates.map((d) => [d, { ret: 1, net: 0.5 }]))]));
    };
    const reqs = Array.from({ length: 120 }, (_, i) => ({ symbol: `S${i}`, start: "2026-10-01" }));
    await loadReturns(reqs, "2026-11-13", undefined, fetcher);
    expect(calls).toEqual([50, 50, 20]);
    await loadReturns(reqs, "2026-11-13", undefined, fetcher);
    expect(calls).toHaveLength(3);
    expect(getCachedReturn("S0", "2026-10-01", "2026-11-13")).toEqual({ ret: 1, net: 0.5 });
    await loadReturns(reqs, "2026-11-16", undefined, fetcher);
    expect(calls).toHaveLength(6);
  });
});
