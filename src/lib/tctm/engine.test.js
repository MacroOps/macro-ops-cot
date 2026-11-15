import { describe, expect, it } from "vitest";
import { TCTM } from "./engine.js";

const { CONFIG, colIndex, colLetters, expandCols, holdSeries, buildDataset, compositeSource, sourceStatus, fwdReturn, conditionalAnnualized } = TCTM;

function blankRow() {
  return Array.from({ length: 72 }, () => "");
}

function header() {
  const h = blankRow();
  h[0] = "Date";
  h[1] = "S&P 500";
  for (let c = colIndex("C"); c <= colIndex("M"); c++) h[c] = "Sector " + colLetters(c);
  h[colIndex("N")] = "Risk-Off";
  h[colIndex("O")] = "Capitulation";
  h[colIndex("S")] = "LT";
  h[colIndex("T")] = "Status";
  h[colIndex("U")] = "Risk-Off Signal";
  h[colIndex("V")] = "Capitulation Signal";
  for (let c = colIndex("Z"); c <= colIndex("AK"); c++) h[c] = "Risk " + colLetters(c);
  h[colIndex("AL")] = "Cap component";
  return h;
}

function iso(i) {
  return new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10);
}

function session(i, patch) {
  const row = blankRow();
  row[0] = iso(i);
  row[1] = "100";
  row[colIndex("S")] = "1";
  row[colIndex("T")] = "1";
  if (patch) patch(row, i);
  return row;
}

function dataset(n, patch) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(session(i, patch));
  return buildDataset([header(), ...rows]);
}

describe("TCTM engine", () => {
  it("maps columns and component counts", () => {
    expect(colIndex("A")).toBe(0);
    expect(colIndex("Z")).toBe(25);
    expect(colIndex("BT")).toBe(71);
    expect(colLetters(0)).toBe("A");
    expect(colLetters(71)).toBe("BT");
    expect(CONFIG.models.map((m) => expandCols(m.comps).length)).toEqual([12, 4, 10, 11, 10]);
  });

  it("holds a trigger for 42 sessions, signal day counted as session 1", () => {
    const trig = new Uint8Array(50);
    trig[0] = 1;
    const held = holdSeries(trig, 42);
    expect(held.active[0]).toBe(1);
    expect(held.active[41]).toBe(1);
    expect(held.active[42]).toBe(0);
    expect(held.episodes).toEqual([0]);
  });

  it("restarts the window on a re-trigger and does not open a new episode", () => {
    const trig = new Uint8Array(300);
    trig[100] = 1;
    trig[120] = 1;
    trig[200] = 1;
    const held = holdSeries(trig, 42);
    expect(held.episodes).toEqual([100, 200]);
    expect(held.active[161]).toBe(1);
    expect(held.active[162]).toBe(0);
    expect(held.active[199]).toBe(0);
    expect(held.active[200]).toBe(1);
    expect(held.active[241]).toBe(1);
    expect(held.active[242]).toBe(0);
  });

  it("starts a new episode when a trigger lands on the session after expiry", () => {
    const trig = new Uint8Array(90);
    trig[0] = 1;
    trig[42] = 1;
    const held = holdSeries(trig, 42);
    expect(held.episodes).toEqual([0, 42]);
    expect(held.active[41]).toBe(1);
    expect(held.active[42]).toBe(1);
    expect(held.active[83]).toBe(1);
    expect(held.active[84]).toBe(0);
  });

  it("falls back to the 42-session reading when the sheet cell is blank", () => {
    const ds = dataset(1, (row) => {
      for (let k = 0; k < 5; k++) row[colIndex("Z") + k] = "1";
    });
    const risk = ds.models.find((m) => m.id === "riskoff");
    expect(risk.calcReading[0]).toBe(41.67);
    expect(risk.reading[0]).toBe(41.67);
    expect(risk.count[0]).toBe(5);
    expect(risk.readingFallbackDays).toEqual([0]);
  });

  it("displays the sheet reading and keeps the 42-session count as the cross-check", () => {
    const ds = dataset(1, (row) => {
      row[colIndex("N")] = "50";
      for (let k = 0; k < 5; k++) row[colIndex("Z") + k] = "1";
    });
    const risk = ds.models.find((m) => m.id === "riskoff");
    expect(risk.reading[0]).toBe(50);
    expect(risk.count[0]).toBe(6);
    expect(risk.calcReading[0]).toBe(41.67);
    expect(risk.calcCount[0]).toBe(5);
    expect(risk.readingFallbackDays).toEqual([]);
    expect(ds.integrity.models.find((m) => m.id === "riskoff").mismatched).toBe(1);
  });

  it("is bullish on session 42 of a signal and neutral on session 43", () => {
    const signal = (row, i) => {
      if (i === 0) row[colIndex("V")] = "1";
    };
    const live = dataset(42, signal);
    const expired = dataset(43, signal);
    const liveSrc = compositeSource(live, live.models.find((m) => m.id === "capitulation"));
    const expiredSrc = compositeSource(expired, expired.models.find((m) => m.id === "capitulation"));
    expect(sourceStatus(live, liveSrc).state).toBe("bull");
    expect(sourceStatus(live, liveSrc).sessionsSince).toBe(42);
    expect(sourceStatus(expired, expiredSrc).state).toBe("neutral");
    expect(sourceStatus(expired, expiredSrc).sessionsSince).toBe(43);
  });

  it("computes forward returns from closes and returns null past the last session", () => {
    const ds = dataset(4, (row, i) => {
      row[1] = String(100 + i * 10);
    });
    expect(fwdReturn(ds, 0, 2)).toBeCloseTo(0.2, 10);
    expect(fwdReturn(ds, 2, 2)).toBeNull();
  });

  it("annualizes a constant 0.1% daily return as 1.001^252 - 1", () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
      const row = session(i);
      row[1] = String(100 * Math.pow(1.001, i));
      rows.push(row);
    }
    const ds = buildDataset([header(), ...rows]);
    const ann = conditionalAnnualized(ds, () => "all", ["all"])[0].ann;
    expect(ann).toBeCloseTo(Math.pow(1.001, 252) - 1, 8);
  });
});
