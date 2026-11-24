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
  "etf-sector": {
    slug: "etf-sector",
    label: "ETF Sector",
    description: "Dual trend across the sector ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_SECTOR", category: "Sector" }] },
    csvName: "etf-sector-dual-trend.csv",
  },
  "etf-industry": {
    slug: "etf-industry",
    label: "ETF Industry",
    description: "Dual trend across the industry ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_INDUSTRY", category: "Industry" }] },
    csvName: "etf-industry-dual-trend.csv",
  },
  "etf-thematic": {
    slug: "etf-thematic",
    label: "ETF Thematic",
    description: "Dual trend across the thematic ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_THEMATIC", category: "Thematic" }] },
    csvName: "etf-thematic-dual-trend.csv",
  },
  "etf-global": {
    slug: "etf-global",
    label: "ETF Global",
    description: "Dual trend across the global ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_GLOBAL", category: "Global" }] },
    csvName: "etf-global-dual-trend.csv",
  },
  "etf-style-factor": {
    slug: "etf-style-factor",
    label: "ETF Index / Style / Factor",
    description: "Dual trend across the index, style and factor ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_INDEX_STYLE_FACTOR", category: "Index / Style / Factor" }] },
    csvName: "etf-style-factor-dual-trend.csv",
  },
  "etf-commodity-crypto": {
    slug: "etf-commodity-crypto",
    label: "ETF Commodity / Crypto",
    description: "Dual trend across the commodity and crypto ETF list.",
    universe: { kind: "lists", lists: [{ id: "CUSTOM:ETF_COMMODITY_CRYPTO", category: "Commodity / Crypto" }] },
    csvName: "etf-commodity-crypto-dual-trend.csv",
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
