import { fetchSheetCsv, MO_PORTFOLIO_SHEET, parseCSV } from "./portfolio/parse";

/** "TP DT - PUBLIC" tab on the Macro Portfolio workbook. */
export const MO_GID_TP_DT = "28861058";

export type TpDtStance = "Bullish" | "Bearish" | "Neutral";

export type TpDtHolding = {
  symbol: string;
  name: string;
  weightPct: number;
  subIndustry: string;
  lt: TpDtStance;
  st: TpDtStance;
};

export type TpDtSector = {
  name: string;
  portfolioPct: number | null;
  benchmarkPct: number | null;
  positioning: string;
  holdings: TpDtHolding[];
};

export type TpDtBook = {
  asOf: string;
  holdings: number | null;
  sectors: number | null;
  spxWeightPct: number | null;
  cashWeightPct: number | null;
  groups: TpDtSector[];
};

function num(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace("%", "").replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function stance(v: unknown): TpDtStance {
  const s = String(v || "").trim().toLowerCase();
  if (s.startsWith("bear")) return "Bearish";
  if (s.startsWith("bull")) return "Bullish";
  return "Neutral";
}

function labelRow(rows: string[][], re: RegExp): string[] | null {
  const i = rows.findIndex((r) => re.test((r?.[0] || "").trim()));
  return i >= 0 ? rows[i] : null;
}

/** Dean's shared table, as emptied into TP DT - PUBLIC. */
export function extractTpDt(rows: string[][]): TpDtBook {
  const header = rows.findIndex(
    (r) => /^Holdings$/i.test((r?.[0] || "").trim()) && /symbol/i.test(r?.[1] || ""),
  );
  const groups: TpDtSector[] = [];
  let current: TpDtSector | null = null;

  for (let i = header + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = (row[0] || "").trim();
    const symbol = (row[1] || "").trim();
    if (!name && !symbol) continue;
    if (!symbol) {
      current = {
        name,
        benchmarkPct: num(row[6]),
        portfolioPct: num(row[7]),
        positioning: (row[8] || "").trim(),
        holdings: [],
      };
      groups.push(current);
      continue;
    }
    if (!current) continue;
    current.holdings.push({
      symbol,
      name,
      weightPct: num(row[2]) ?? 0,
      subIndustry: (row[3] || "").trim(),
      lt: stance(row[4]),
      st: stance(row[5]),
    });
  }

  return {
    asOf: (labelRow(rows, /^Holdings As Of$/i)?.[1] || "").trim(),
    holdings: num(labelRow(rows, /^Total Holdings$/i)?.[1]),
    sectors: num(labelRow(rows, /^Total Sectors$/i)?.[1]),
    spxWeightPct: num(labelRow(rows, /^S&P 500 Weight$/i)?.[1]),
    cashWeightPct: num(labelRow(rows, /^Cash Weight$/i)?.[1]),
    groups,
  };
}

export async function loadTpDtPortfolio(): Promise<TpDtBook> {
  const csv = await fetchSheetCsv(MO_PORTFOLIO_SHEET, MO_GID_TP_DT);
  return extractTpDt(parseCSV(csv));
}
