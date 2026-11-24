// Single source of truth for Dual Trend sections: labels and universe.
// Rename a section here and the page title, header and tables follow.

export type IndexCode = "SPX" | "MID" | "SML";

export type DualTrendUniverseSpec =
  | { kind: "members"; index: IndexCode }
  | { kind: "lists"; lists: { id: string; category: string }[] };

export interface DualTrendSection {
  slug: string;
  label: string;
  description: string;
  universe: DualTrendUniverseSpec;
  /** Show the sector breadth table for this index above the constituents. */
  breadth?: IndexCode;
  csvName: string;
}

export const INDEX_LABELS: Record<IndexCode, string> = {
  SPX: "S&P 500",
  MID: "S&P 400",
  SML: "S&P 600",
};

export const DUAL_TREND_SECTIONS: Record<string, DualTrendSection> = {
  sp500: {
    slug: "sp500",
    label: INDEX_LABELS.SPX,
    description: "Long & short-term trend across S&P 500 constituents.",
    universe: { kind: "members", index: "SPX" },
    breadth: "SPX",
    csvName: "sp500-dual-trend.csv",
  },
  sp400: {
    slug: "sp400",
    label: INDEX_LABELS.MID,
    description: "Long & short-term trend across S&P 400 mid-caps.",
    universe: { kind: "members", index: "MID" },
    breadth: "MID",
    csvName: "sp400-dual-trend.csv",
  },
  sp600: {
    slug: "sp600",
    label: INDEX_LABELS.SML,
    description: "Long & short-term trend across S&P 600 small-caps.",
    universe: { kind: "members", index: "SML" },
    breadth: "SML",
    csvName: "sp600-dual-trend.csv",
  },
  etfs: {
    slug: "etfs",
    label: "ETFs",
    description: "Dual trend across the curated ETF universe.",
    universe: {
      kind: "lists",
      lists: [
        { id: "CUSTOM:ETF_SECTOR", category: "Sector" },
        { id: "CUSTOM:ETF_INDUSTRY", category: "Industry" },
        { id: "CUSTOM:ETF_THEMATIC", category: "Thematic" },
        { id: "CUSTOM:ETF_GLOBAL", category: "Global" },
        { id: "CUSTOM:ETF_INDEX_STYLE_FACTOR", category: "Index / Style / Factor" },
        { id: "CUSTOM:ETF_COMMODITY_CRYPTO", category: "Commodity / Crypto" },
      ],
    },
    csvName: "etf-dual-trend.csv",
  },
  "gold-silver-miners": {
    slug: "gold-silver-miners",
    label: "Gold & Silver Miners",
    description: "Dual short- and long-term trend signals across gold and silver miners.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:STOCKS_GOLD_SILVER_MINERS", category: "Gold & Silver Miners" }] },
    csvName: "gold-silver-miners-dual-trend.csv",
  },
  thematic: {
    slug: "thematic",
    label: "Thematic Stocks",
    description: "Thematic / megatrend names.",
    // Empty category: each stock is grouped by its own category from the list file.
    universe: { kind: "lists", lists: [{ id: "CUSTOM:STOCKS_THEMATICS", category: "" }] },
    csvName: "thematic-dual-trend.csv",
  },
};

// GICS sector code -> name. SPX uses S5* index groups; MID/SML use "<IDX>/sector/<code>".
export const GICS_SECTORS: Record<string, string> = {
  "10": "Energy",
  "15": "Materials",
  "20": "Industrials",
  "25": "Consumer Discretionary",
  "30": "Consumer Staples",
  "35": "Health Care",
  "40": "Financials",
  "45": "Information Technology",
  "50": "Communication Services",
  "55": "Utilities",
  "60": "Real Estate",
};

const SPX_SECTOR_GROUP: Record<string, string> = {
  "10": "S5ENRS", "15": "S5MATR", "20": "S5INDU", "25": "S5COND", "30": "S5CONS",
  "35": "S5HLTH", "40": "S5FINL", "45": "S5INFT", "50": "S5TELS", "55": "S5UTIL", "60": "S5RLST",
};

/** Sector membership groups for an index: [{ group, name }]. */
export function sectorGroups(index: IndexCode): { group: string; name: string }[] {
  return Object.entries(GICS_SECTORS).map(([code, name]) => ({
    group: index === "SPX" ? SPX_SECTOR_GROUP[code] : `${index}/sector/${code}`,
    name,
  }));
}
