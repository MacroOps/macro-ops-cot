import { describe, expect, it } from "vitest";
import { buildRow, KEYS } from "./useTpmrSystems";

function maps(values: Partial<Record<(typeof KEYS)[number], number>>) {
  return Object.fromEntries(KEYS.map((key) => [key, new Map(values[key] === undefined ? [] : [["SPX", values[key]]])])) as Record<(typeof KEYS)[number], Map<string, number>>;
}

describe("API Trend System mapping", () => {
  it("reads both native levels and the shared API state, days and start without history math", () => {
    const row = buildRow("SPX", "S&P 500", maps({ trend_value1: 4, trend_value2: 0, trend_state: -1, trend_days: 12, trend_start: 20762 }));
    expect(row.trendSystem).toEqual({ level: 4, value1: 4, value2: 0, signal: "BEARISH", days: 12, date: "11/05/26" });
  });

  it("keeps absent component levels missing rather than inventing zeros", () => {
    const row = buildRow("SPX", "S&P 500", maps({}));
    expect(row.trendSystem.value1).toBeNull();
    expect(row.trendSystem.value2).toBeNull();
  });
});