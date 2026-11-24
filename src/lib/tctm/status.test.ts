import { describe, expect, it } from "vitest";
import { TCTM } from "./engine.js";
import { formatShortDate, summarizeTctm } from "./status";

const { colIndex, colLetters, buildDataset } = TCTM;

function header() {
  const h: string[] = Array.from({ length: 72 }, () => "");
  h[0] = "Date";
  h[1] = "S&P 500";
  for (let c = colIndex("C"); c <= colIndex("M"); c++) h[c] = "Sector " + colLetters(c);
  for (const c of ["N", "O", "P", "Q", "R"]) h[colIndex(c)] = "Reading " + c;
  for (let c = colIndex("Z"); c <= colIndex("BT"); c++) h[c] = "Comp " + colLetters(c);
  return h;
}

function iso(i: number) {
  return new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10);
}

function sheet(n: number, patch?: (row: string[], i: number) => void) {
  const rows: string[][] = [];
  for (let i = 0; i < n; i++) {
    const row: string[] = Array.from({ length: 72 }, () => "");
    row[0] = iso(i);
    row[1] = "100";
    row[colIndex("S")] = "1";
    row[colIndex("T")] = "1";
    patch?.(row, i);
    rows.push(row);
  }
  return [header(), ...rows];
}

describe("summarizeTctm", () => {
  it("returns the five composites with real component totals", () => {
    const s = summarizeTctm(buildDataset(sheet(60)));
    expect(s.rows.map((r) => r.id)).toEqual(["riskoff", "capitulation", "bottom", "thrust", "confirmation"]);
    expect(s.rows.map((r) => r.total)).toEqual([12, 4, 10, 11, 10]);
    expect(s.asOf).toBe(iso(59));
    for (const r of s.rows) {
      expect(r.state).toBe("neutral");
      expect(r.signalDate).toBeNull();
    }
  });

  it("marks a composite Triggered inside the 42-session window, in its own direction", () => {
    const n = 100;
    const s = summarizeTctm(
      buildDataset(
        sheet(n, (row, i) => {
          if (i === 80) row[colIndex("U")] = "1"; // Risk-Off signal
          if (i === 90) row[colIndex("V")] = "1"; // Capitulation signal
          if (i === 5) row[colIndex("W")] = "1"; // Bottom signal, long expired
          if (i === n - 1) {
            row[colIndex("Z")] = "1";
            row[colIndex("AA")] = "1";
            row[colIndex("N")] = "16.67";
          }
        }),
      ),
    );
    const by = Object.fromEntries(s.rows.map((r) => [r.id, r]));
    expect(by.riskoff.state).toBe("bear");
    expect(by.riskoff.signalDate).toBe(iso(80));
    expect(by.riskoff.count).toBe(2);
    expect(by.capitulation.state).toBe("bull");
    expect(by.bottom.state).toBe("neutral");
    expect(by.bottom.signalDate).toBe(iso(5));
  });
});

describe("formatShortDate", () => {
  it("formats ISO dates as MM/DD/YY", () => {
    expect(formatShortDate("2026-04-22")).toBe("04/22/26");
    expect(formatShortDate(null)).toBe("—");
  });
});
