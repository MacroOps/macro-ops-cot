import { describe, expect, it } from "vitest";
import { dataDateIso, exportDateLabel, exportFilename, exportStem } from "./exportNaming";

const NOW = new Date(2026, 10, 23, 12, 0, 0); // 2026-11-23 local

describe("exportStem", () => {
  it("slugs titles the way TCTM always did", () => {
    expect(exportStem("S&amp;P 500 around Risk-Off Composite signals")).toBe("sandp-500-around-risk-off-composite-signals");
    expect(exportStem("Sectors after Risk-Off Composite Signals")).toBe("sectors-after-risk-off-composite-signals");
  });
  it("handles percent signs, accents and empty titles", () => {
    expect(exportStem("Win rate %")).toBe("win-rate-pct");
    expect(exportStem("Índice COT")).toBe("indice-cot");
    expect(exportStem("???", "tctm")).toBe("tctm");
  });
  it("caps the stem at 70 characters without a trailing dash", () => {
    const s = exportStem("a ".repeat(60));
    expect(s.length).toBeLessThanOrEqual(70);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("export dates", () => {
  it("uses the data date when it is ISO", () => {
    expect(dataDateIso("2026-11-20")).toBe("2026-11-20");
    expect(dataDateIso("2026-11-20T00:00:00Z")).toBe("2026-11-20");
    expect(exportDateLabel("2026-11-20", NOW)).toBe("As of 11/20/2026");
    expect(exportFilename("Portfolio YTD return", "2026-11-20", "jpg", "chart", NOW)).toBe("portfolio-ytd-return_2026-11-20.jpg");
  });
  it("falls back to the export day when there is no data date", () => {
    expect(dataDateIso(undefined)).toBeNull();
    expect(dataDateIso("2026-W47")).toBeNull();
    expect(exportDateLabel(undefined, NOW)).toBe("Exported 11/23/2026");
    expect(exportFilename("Backtest forward returns", null, "jpg", "chart", NOW)).toBe("backtest-forward-returns_2026-11-23.jpg");
  });
});
