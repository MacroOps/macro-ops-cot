// Placeholder COT positioning data for the Macro HUD shell.
// Will be replaced by live data from the backend once the schema is wired up.

export type Sector =
  | "Equities"
  | "Rates"
  | "FX"
  | "Energy"
  | "Metals"
  | "Agriculture"
  | "Crypto";

export interface MarketSnapshot {
  id?: string;
  symbol: string;
  name: string;
  sector: Sector;
  price: number;
  weekChangePct: number;
  // Legacy non-commercial percentiles (large specs)
  largeSpecPercentile: number;     // 3y
  // Disaggregated leveraged-fund percentiles (kept for reference)
  leveragedFundPercentile: number; // 3y
  // PRIMARY metric: Net Speculators (large + small non-commercial)
  netSpecContracts: number;        // current net contracts
  netSpecPct3y: number;            // 0-100 vs 156w window
  netSpecPct6m: number;            // 0-100 vs 26w window
  // TFF percentiles (financial markets only — null elsewhere)
  netLevPct6m?: number | null;
  netAssetMgrPct6m?: number | null;
  netContracts: number;            // legacy alias = netSpecContracts
  wowChange: number;
  // Composite extremity score in [-100, +100]. Positive = crowded long.
  extremityScore: number;
  extremityBand: ExtremityBand;
}

export type ExtremityBand =
  | "euphoric"
  | "capitulation"
  | "crowded-long"
  | "crowded-short"
  | "leaning-long"
  | "leaning-short"
  | "neutral";

export function bandOf(score: number): ExtremityBand {
  const a = Math.abs(score);
  if (a >= 75) return score >= 0 ? "euphoric" : "capitulation";
  if (a >= 50) return score >= 0 ? "crowded-long" : "crowded-short";
  if (a >= 25) return score >= 0 ? "leaning-long" : "leaning-short";
  return "neutral";
}

const MARKETS: any[] = [
  { symbol: "ES",  name: "S&P 500 E-mini",        sector: "Equities",    price: 5832.5,   weekChangePct: 1.2,  largeSpecPercentile: 78, leveragedFundPercentile: 84, netContracts: 142_300, wowChange: 8_420 },
  { symbol: "NQ",  name: "Nasdaq 100 E-mini",     sector: "Equities",    price: 20418.0,  weekChangePct: 2.1,  largeSpecPercentile: 91, leveragedFundPercentile: 95, netContracts: 38_220,  wowChange: 4_110 },
  { symbol: "YM",  name: "Dow E-mini",            sector: "Equities",    price: 43210.0,  weekChangePct: 0.4,  largeSpecPercentile: 64, leveragedFundPercentile: 70, netContracts: 18_910,  wowChange: 1_220 },
  { symbol: "RTY", name: "Russell 2000",          sector: "Equities",    price: 2310.4,   weekChangePct: -0.8, largeSpecPercentile: 42, leveragedFundPercentile: 35, netContracts: -3_240,  wowChange: -2_110 },
  { symbol: "ZN",  name: "10Y T-Note",            sector: "Rates",       price: 109.27,   weekChangePct: -0.3, largeSpecPercentile: 12, leveragedFundPercentile: 8,  netContracts: -812_400, wowChange: -42_300 },
  { symbol: "ZB",  name: "30Y T-Bond",            sector: "Rates",       price: 117.10,   weekChangePct: -0.5, largeSpecPercentile: 22, leveragedFundPercentile: 18, netContracts: -148_200, wowChange: -8_100 },
  { symbol: "ZF",  name: "5Y T-Note",             sector: "Rates",       price: 107.04,   weekChangePct: -0.2, largeSpecPercentile: 18, leveragedFundPercentile: 14, netContracts: -1_980_000, wowChange: -56_000 },
  { symbol: "6E",  name: "Euro FX",               sector: "FX",          price: 1.0612,   weekChangePct: -0.6, largeSpecPercentile: 38, leveragedFundPercentile: 28, netContracts: -22_400,  wowChange: -4_200 },
  { symbol: "6J",  name: "Japanese Yen",          sector: "FX",          price: 0.00658,  weekChangePct: 0.9,  largeSpecPercentile: 8,  leveragedFundPercentile: 5,  netContracts: -88_120,  wowChange: -3_400 },
  { symbol: "6B",  name: "British Pound",         sector: "FX",          price: 1.2641,   weekChangePct: 0.2,  largeSpecPercentile: 55, leveragedFundPercentile: 60, netContracts: 12_410,   wowChange: 980 },
  { symbol: "DXY", name: "Dollar Index",          sector: "FX",          price: 106.42,   weekChangePct: 0.5,  largeSpecPercentile: 82, leveragedFundPercentile: 88, netContracts: 14_220,   wowChange: 1_640 },
  { symbol: "CL",  name: "WTI Crude Oil",         sector: "Energy",      price: 71.34,    weekChangePct: -1.8, largeSpecPercentile: 28, leveragedFundPercentile: 22, netContracts: 162_400,  wowChange: -12_800 },
  { symbol: "NG",  name: "Natural Gas",           sector: "Energy",      price: 3.21,     weekChangePct: 4.2,  largeSpecPercentile: 71, leveragedFundPercentile: 76, netContracts: -42_100,  wowChange: 18_220 },
  { symbol: "RB",  name: "RBOB Gasoline",         sector: "Energy",      price: 2.04,     weekChangePct: -0.9, largeSpecPercentile: 35, leveragedFundPercentile: 30, netContracts: 48_220,   wowChange: -3_200 },
  { symbol: "GC",  name: "Gold",                  sector: "Metals",      price: 2718.4,   weekChangePct: 1.4,  largeSpecPercentile: 88, leveragedFundPercentile: 92, netContracts: 281_400,  wowChange: 6_810 },
  { symbol: "SI",  name: "Silver",                sector: "Metals",      price: 32.18,    weekChangePct: 2.1,  largeSpecPercentile: 76, leveragedFundPercentile: 81, netContracts: 48_220,   wowChange: 3_120 },
  { symbol: "HG",  name: "Copper",                sector: "Metals",      price: 4.31,     weekChangePct: -0.4, largeSpecPercentile: 58, leveragedFundPercentile: 52, netContracts: 22_410,   wowChange: -1_820 },
  { symbol: "ZC",  name: "Corn",                  sector: "Agriculture", price: 4.41,     weekChangePct: 1.1,  largeSpecPercentile: 48, leveragedFundPercentile: 44, netContracts: 18_220,   wowChange: 4_220 },
  { symbol: "ZS",  name: "Soybeans",              sector: "Agriculture", price: 9.92,     weekChangePct: -0.6, largeSpecPercentile: 18, leveragedFundPercentile: 12, netContracts: -94_220,  wowChange: -8_410 },
  { symbol: "ZW",  name: "Wheat",                 sector: "Agriculture", price: 5.42,     weekChangePct: 0.3,  largeSpecPercentile: 32, leveragedFundPercentile: 28, netContracts: -32_410,  wowChange: -1_220 },
  { symbol: "BTC", name: "Bitcoin Futures",       sector: "Crypto",      price: 98420,    weekChangePct: 5.4,  largeSpecPercentile: 84, leveragedFundPercentile: 89, netContracts: 14_220,   wowChange: 2_410 },
  { symbol: "ETH", name: "Ether Futures",         sector: "Crypto",      price: 3420,     weekChangePct: 3.2,  largeSpecPercentile: 72, leveragedFundPercentile: 78, netContracts: 4_810,    wowChange: 980 },
];

export const getMarkets = (): MarketSnapshot[] => MARKETS;

export const SECTORS: Sector[] = [
  "Equities",
  "Rates",
  "FX",
  "Energy",
  "Metals",
  "Agriculture",
  "Crypto",
];
