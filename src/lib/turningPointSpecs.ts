// TurningPoint Market Research (TPMR) model specs.
// Mock data shaped to the audit doc so the UI can later swap to real ingestion
// without changing component contracts.

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";
export type TctmSignal = "Neutral" | "Triggered";

export interface HouseViewRow {
  type: "Short-Term" | "Long-Term";
  direction: Direction;
  signalDate: string; // MM/DD/YY
}

export interface TctmComponentStatus {
  name: "RISK" | "CAPITULATION" | "BOTTOM" | "THRUST" | "CONFIRMATION";
  signal: TctmSignal;
  signalDate: string;
  count: number; // sub-indicators triggered
  total: number;
}

export interface SystemScore {
  level: number; // 0-100
  signal: Direction;
  date: string;
  days: number;
}

export interface IndexSystemRow {
  index: string;
  riskST: SystemScore;
  riskLT: SystemScore;
  trend: SystemScore;
}

export interface SectorSystemRow {
  sector: string;
  riskST: Omit<SystemScore, "days">;
  riskLT: Omit<SystemScore, "days">;
  trend: Omit<SystemScore, "days"> & { tLevel: number; rLevel: number };
}

export interface ModelPerfRow {
  signal: "Positive" | "Negative" | "All Periods";
  annReturn: number; // %
  pctTime: number; // %
}

export interface ThresholdRow {
  condition: "Risk-Off" | "Bottom" | "Thrust" | "Confirmation";
  threshold: string; // e.g. ">=10%"
  annReturn: number;
  pctTime: number;
}

export const HOUSE_VIEW: HouseViewRow[] = [
  { type: "Short-Term", direction: "BEARISH", signalDate: "05/12/26" },
  { type: "Long-Term", direction: "BULLISH", signalDate: "11/03/25" },
];

export const TCTM_STATUS: TctmComponentStatus[] = [
  { name: "RISK", signal: "Neutral", signalDate: "04/22/26", count: 3, total: 12 },
  { name: "CAPITULATION", signal: "Neutral", signalDate: "—", count: 0, total: 9 },
  { name: "BOTTOM", signal: "Neutral", signalDate: "—", count: 1, total: 10 },
  { name: "THRUST", signal: "Triggered", signalDate: "05/14/26", count: 6, total: 11 },
  { name: "CONFIRMATION", signal: "Triggered", signalDate: "05/19/26", count: 4, total: 8 },
];

export const INDEX_SYSTEMS: IndexSystemRow[] = [
  {
    index: "S&P 500",
    riskST: { level: 38, signal: "BEARISH", date: "05/12/26", days: 16 },
    riskLT: { level: 72, signal: "BULLISH", date: "11/03/25", days: 207 },
    trend: { level: 64, signal: "BULLISH", date: "12/18/25", days: 162 },
  },
  {
    index: "S&P 400",
    riskST: { level: 31, signal: "BEARISH", date: "05/09/26", days: 19 },
    riskLT: { level: 58, signal: "BULLISH", date: "12/02/25", days: 178 },
    trend: { level: 49, signal: "BULLISH", date: "01/22/26", days: 126 },
  },
  {
    index: "S&P 600",
    riskST: { level: 24, signal: "BEARISH", date: "05/02/26", days: 26 },
    riskLT: { level: 42, signal: "BEARISH", date: "03/14/26", days: 75 },
    trend: { level: 37, signal: "BEARISH", date: "03/28/26", days: 61 },
  },
];

const SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Materials",
  "Real Estate",
  "Technology",
  "Utilities",
];

function seeded(i: number, salt = 1) {
  const x = Math.sin(i * 9301 + salt * 49297) * 233280;
  return Math.abs(x - Math.floor(x));
}

export const SECTOR_SYSTEMS: SectorSystemRow[] = SECTORS.map((s, i) => {
  const st = Math.round(seeded(i, 1) * 100);
  const lt = Math.round(seeded(i, 2) * 100);
  const tr = Math.round(seeded(i, 3) * 100);
  const tL = Math.round(seeded(i, 4) * 100);
  const rL = Math.round(seeded(i, 5) * 100);
  const d = (n: number) => `0${(n % 9) + 1}/${((n * 3) % 27) + 1}/26`.replace(/^0?(\d{2})/, "$1");
  return {
    sector: s,
    riskST: { level: st, signal: st >= 50 ? "BULLISH" : "BEARISH", date: d(i + 1) },
    riskLT: { level: lt, signal: lt >= 50 ? "BULLISH" : "BEARISH", date: d(i + 2) },
    trend: {
      level: tr,
      signal: tr >= 50 ? "BULLISH" : "BEARISH",
      date: d(i + 3),
      tLevel: tL,
      rLevel: rL,
    },
  };
});

export const PERF_RISK_LT: ModelPerfRow[] = [
  { signal: "Positive", annReturn: 16.7, pctTime: 69 },
  { signal: "Negative", annReturn: 0.5, pctTime: 31 },
  { signal: "All Periods", annReturn: 7.8, pctTime: 100 },
];
export const PERF_RISK_ST: ModelPerfRow[] = [
  { signal: "Positive", annReturn: 17.8, pctTime: 65 },
  { signal: "Negative", annReturn: 0.5, pctTime: 35 },
  { signal: "All Periods", annReturn: 7.8, pctTime: 100 },
];
export const PERF_TCTM_LT: ModelPerfRow[] = [
  { signal: "Positive", annReturn: 15.5, pctTime: 78 },
  { signal: "Negative", annReturn: -2.0, pctTime: 22 },
  { signal: "All Periods", annReturn: 7.8, pctTime: 100 },
];

export const TCTM_THRESHOLDS: ThresholdRow[] = [
  { condition: "Risk-Off", threshold: "≥10%", annReturn: -5.5, pctTime: 13 },
  { condition: "Risk-Off", threshold: "≥20%", annReturn: -4.3, pctTime: 9 },
  { condition: "Risk-Off", threshold: "≥30%", annReturn: -7.5, pctTime: 5 },
  { condition: "Risk-Off", threshold: "≥40%", annReturn: 1.0, pctTime: 3 },
  { condition: "Risk-Off", threshold: "≥50%", annReturn: -6.1, pctTime: 1 },
  { condition: "Bottom", threshold: "≥20%", annReturn: 14.2, pctTime: 22 },
  { condition: "Bottom", threshold: "≥30%", annReturn: 15.9, pctTime: 17 },
  { condition: "Bottom", threshold: "≥40%", annReturn: 28.3, pctTime: 13 },
  { condition: "Bottom", threshold: "≥50%", annReturn: 37.2, pctTime: 8 },
  { condition: "Bottom", threshold: "≥60%", annReturn: 32.5, pctTime: 6 },
  { condition: "Thrust", threshold: "≥10%", annReturn: 17.8, pctTime: 32 },
  { condition: "Thrust", threshold: "≥20%", annReturn: 25.8, pctTime: 23 },
  { condition: "Thrust", threshold: "≥30%", annReturn: 32.1, pctTime: 15 },
  { condition: "Thrust", threshold: "≥40%", annReturn: 38.9, pctTime: 9 },
  { condition: "Thrust", threshold: "≥50%", annReturn: 40.0, pctTime: 7 },
  { condition: "Thrust", threshold: "≥60%", annReturn: 44.0, pctTime: 5 },
  { condition: "Confirmation", threshold: "≥10%", annReturn: 12.9, pctTime: 45 },
  { condition: "Confirmation", threshold: "≥20%", annReturn: 20.2, pctTime: 29 },
  { condition: "Confirmation", threshold: "≥30%", annReturn: 22.2, pctTime: 20 },
  { condition: "Confirmation", threshold: "≥40%", annReturn: 22.8, pctTime: 15 },
  { condition: "Confirmation", threshold: "≥50%", annReturn: 30.1, pctTime: 11 },
  { condition: "Confirmation", threshold: "≥60%", annReturn: 36.5, pctTime: 7 },
];

// ---- Dual Trend ----

export interface DualTrendSummaryRow {
  etf: string;
  total: number;
  bullishLT: number;
  pctBullishLT: number;
  fiveDayChg: number | null;
  bearishLT: number;
  pctBearishLT: number;
}

export interface DualTrendStock {
  symbol: string;
  name: string;
  etf: string;
  category: string;
  ltTrend: number;
  ltRelative: number;
  ltSignal: Direction;
  ltDays: number;
  ltReturn: number;
  ltNet: number;
  // Short-term mirror for the expand panel
  stTrend: number;
  stRelative: number;
  stSignal: Direction;
  stDays: number;
  stSignalDate: string;
  stReturn: number;
  stNet: number;
  ltSignalDate: string;
}

export interface DualTrendUniverse {
  slug: string;
  title: string;
  description: string;
  summary: DualTrendSummaryRow[];
  stocks: DualTrendStock[];
}

function makeStock(
  symbol: string,
  name: string,
  etf: string,
  category: string,
  i: number,
): DualTrendStock {
  const lt = Math.round(seeded(i, 11) * 100);
  const ltR = Math.round(seeded(i, 12) * 100);
  const st = Math.round(seeded(i, 13) * 100);
  const stR = Math.round(seeded(i, 14) * 100);
  const ltDays = Math.round(seeded(i, 15) * 240) + 5;
  const stDays = Math.round(seeded(i, 16) * 90) + 2;
  const ltSig: Direction = lt >= 50 ? "BULLISH" : "BEARISH";
  const stSig: Direction = st >= 50 ? "BULLISH" : "BEARISH";
  const sign = (d: Direction) => (d === "BULLISH" ? 1 : -1);
  const ltRet = sign(ltSig) * (5 + seeded(i, 17) * 40);
  const stRet = sign(stSig) * (1 + seeded(i, 18) * 15);
  return {
    symbol,
    name,
    etf,
    category,
    ltTrend: lt,
    ltRelative: ltR,
    ltSignal: ltSig,
    ltDays,
    ltReturn: +ltRet.toFixed(1),
    ltNet: +(ltRet * 1.4).toFixed(1),
    ltSignalDate: `0${(i % 9) + 1}/${((i * 3) % 27) + 1}/2025`.slice(0, 10),
    stTrend: st,
    stRelative: stR,
    stSignal: stSig,
    stDays,
    stSignalDate: `0${(i % 9) + 1}/${((i * 5) % 27) + 1}/2026`.slice(0, 10),
    stReturn: +stRet.toFixed(1),
    stNet: +(stRet * 1.4).toFixed(1),
  };
}

function summarize(stocks: DualTrendStock[], etfs: { etf: string; filter?: (s: DualTrendStock) => boolean }[]): DualTrendSummaryRow[] {
  return etfs.map(({ etf, filter }, idx) => {
    const subset = filter ? stocks.filter(filter) : stocks;
    const total = subset.length;
    const bull = subset.filter((s) => s.ltSignal === "BULLISH").length;
    const bear = total - bull;
    return {
      etf,
      total,
      bullishLT: bull,
      pctBullishLT: total ? +((bull / total) * 100).toFixed(1) : 0,
      fiveDayChg: idx === 2 ? null : Math.round(seeded(idx, 99) * 6) - 3,
      bearishLT: bear,
      pctBearishLT: total ? +((bear / total) * 100).toFixed(1) : 0,
    };
  });
}

// Gold & Silver Miners universe (with audit-aligned figures)
const gsmTickers: Array<[string, string, "GDX" | "GDXJ" | "SIL" | "SILJ"]> = [
  ["AEM", "Agnico Eagle Mines", "GDX"],
  ["AGI", "Alamos Gold", "GDX"],
  ["AU", "AngloGold Ashanti", "GDX"],
  ["AUY", "Yamana Gold", "GDX"],
  ["BTG", "B2Gold", "GDX"],
  ["BVN", "Buenaventura", "GDX"],
  ["CDE", "Coeur Mining", "GDX"],
  ["EGO", "Eldorado Gold", "GDX"],
  ["EQX", "Equinox Gold", "GDX"],
  ["FNV", "Franco-Nevada", "GDX"],
  ["GFI", "Gold Fields", "GDX"],
  ["GOLD", "Barrick Gold", "GDX"],
  ["HMY", "Harmony Gold", "GDX"],
  ["IAG", "IAMGOLD", "GDX"],
  ["KGC", "Kinross Gold", "GDX"],
  ["KNT", "K92 Mining", "GDXJ"],
  ["NEM", "Newmont", "GDX"],
  ["NGD", "New Gold", "GDXJ"],
  ["OR", "Osisko Gold Royalties", "GDX"],
  ["PAAS", "Pan American Silver", "SIL"],
  ["PVG", "Pretium Resources", "GDXJ"],
  ["RGLD", "Royal Gold", "GDX"],
  ["SAND", "Sandstorm Gold", "GDXJ"],
  ["SBSW", "Sibanye Stillwater", "GDX"],
  ["SSRM", "SSR Mining", "GDX"],
  ["WPM", "Wheaton Precious Metals", "GDX"],
  ["AG", "First Majestic Silver", "SIL"],
  ["ASM", "Avino Silver", "SILJ"],
  ["EXK", "Endeavour Silver", "SIL"],
  ["FSM", "Fortuna Silver Mines", "SIL"],
  ["HL", "Hecla Mining", "SIL"],
  ["MAG", "MAG Silver", "SIL"],
  ["SILV", "SilverCrest Metals", "SILJ"],
  ["SVM", "Silvercorp Metals", "SIL"],
  ["USAS", "Americas Gold and Silver", "SILJ"],
  ["GATO", "Gatos Silver", "SILJ"],
  ["IAUX", "i-80 Gold", "GDXJ"],
  ["WDO", "Wesdome Gold Mines", "GDXJ"],
  ["MUX", "McEwen Mining", "GDXJ"],
  ["TXG", "Torex Gold", "GDXJ"],
  ["DSV", "Discovery Silver", "SILJ"],
  ["AYA", "Aya Gold & Silver", "SIL"],
  ["GGD", "GoGold Resources", "SILJ"],
  ["ORLA", "Orla Mining", "GDXJ"],
  ["SVRS", "Silver Range Resources", "SILJ"],
  ["NGT", "Newmont Goldcorp Adv", "GDX"],
  ["CG", "Centerra Gold", "GDX"],
];

const isSilver = (etf: string) => etf === "SIL" || etf === "SILJ";

const gsmCategory = (etf: string): string => {
  if (etf === "GDX") return "Gold Miners";
  if (etf === "GDXJ") return "Jr. Gold Miners";
  if (etf === "SIL") return "Silver Miners";
  return "Jr. Silver Miners";
};

const gsmStocks = gsmTickers.map(([sym, name, etf], i) =>
  makeStock(sym, name, etf, gsmCategory(etf), i + 1),
);

const GSM: DualTrendUniverse = {
  slug: "gold-silver-miners",
  title: "Dual Trend — Gold & Silver Miners",
  description: "Dual short- and long-term trend signals across GDX, GDXJ, SIL, SILJ constituents.",
  summary: summarize(gsmStocks, [
    { etf: "Gold & Silver Miners" },
    { etf: "Gold Miners (GDX)", filter: (s) => !isSilver(s.etf) },
    { etf: "Silver Miners (SIL)", filter: (s) => isSilver(s.etf) },
  ]),
  stocks: gsmStocks,
};

function genUniverse(
  slug: string,
  title: string,
  desc: string,
  prefix: string,
  count: number,
  etf: string,
  category: string,
): DualTrendUniverse {
  const stocks = Array.from({ length: count }, (_, i) =>
    makeStock(`${prefix}${i + 1}`, `${prefix} Holding ${i + 1}`, etf, category, i + 101),
  );
  return {
    slug,
    title,
    description: desc,
    summary: summarize(stocks, [{ etf: category }]),
    stocks,
  };
}

export const DUAL_TREND_UNIVERSES: Record<string, DualTrendUniverse> = {
  "gold-silver-miners": GSM,
  "sp500": genUniverse("sp500", "Dual Trend — S&P 500", "Long & short-term trend across S&P 500 constituents.", "SPX", 60, "SPY", "S&P 500"),
  "sp400": genUniverse("sp400", "Dual Trend — S&P 400", "Long & short-term trend across S&P 400 mid-caps.", "MID", 50, "MDY", "S&P 400"),
  "sp600": genUniverse("sp600", "Dual Trend — S&P 600", "Long & short-term trend across S&P 600 small-caps.", "SML", 50, "IJR", "S&P 600"),
  "etfs": genUniverse("etfs", "Dual Trend — ETFs", "Dual trend across the curated ETF universe.", "ETF", 40, "—", "ETF"),
  "large-cap-cyclical": genUniverse("large-cap-cyclical", "Dual Trend — Large Cap Cyclical", "Cyclical large-cap names.", "CYC", 35, "—", "Large Cap Cyclical"),
  "thematic": genUniverse("thematic", "Dual Trend — Thematic Stocks", "Thematic / megatrend names.", "THM", 35, "—", "Thematic"),
};

// ---- TCTM Guides ----

export interface TctmComponentDef {
  name: string;
  definition: string;
}

export interface TctmGuide {
  slug: string;
  title: string;
  short: string;
  threshold: string;
  howItWorks: string;
  components: TctmComponentDef[];
  history: { event: string; date: string; triggered: number; total: number; signal: boolean }[];
}

export const TCTM_GUIDES: Record<string, TctmGuide> = {
  "risk-off": {
    slug: "risk-off",
    title: "TCTM Risk-Off Guide",
    short:
      "Flags breadth deterioration in late-stage bull markets. The composite votes across 12 components; ≥5 triggered fires a Risk-Off signal.",
    threshold: "≥5 of 12 components triggered = Risk-Off signal",
    howItWorks:
      "Each component independently evaluates a breadth/divergence condition. Votes are summed; once the threshold is crossed the composite enters a Risk-Off state until votes decay below threshold.",
    components: [
      { name: "S&P 500 New Low Spike", definition: "Increase in 52-week lows for stocks within the S&P 500." },
      { name: "NYSE New Low Spike", definition: "Increase in 52-week lows for NYSE issues." },
      { name: "S&P 1500 New Low Spike", definition: "Increase in 52-week lows for stocks within the S&P 1500." },
      { name: "Financials New Low Spike", definition: "Increase in 52-week lows for stocks in S&P 500 Financials." },
      { name: "Titanic NYSE", definition: "NYSE 52-week lows exceed highs for five straight sessions near a peak." },
      { name: "Titanic S&P 1500", definition: "S&P 1500 52-week lows exceed highs for five straight sessions near a peak." },
      { name: "AD Divergence NYSE", definition: "NYSE advance-decline line falls as S&P 500 achieves new highs." },
      { name: "AD Divergence S&P 1500", definition: "S&P 1500 A/D line falls as S&P 500 achieves new highs." },
      { name: "AD Divergence S&P 500", definition: "S&P 500 A/D line falls as S&P 500 achieves new highs." },
      { name: "High-Low Logic with 52WL", definition: "High proportion of highs and lows or split market, followed by rising lows." },
      { name: "Financials Relative Strength", definition: "Financials severely underperform, possibly signaling credit stress." },
      { name: "Breadth Composite", definition: "Declining participation among S&P 500 components near index highs." },
    ],
    history: [
      { event: "2000 Dot-com Top", date: "Mar 2000", triggered: 8, total: 12, signal: true },
      { event: "2007 Pre-GFC", date: "Oct 2007", triggered: 9, total: 12, signal: true },
      { event: "2011 Correction", date: "Jul 2011", triggered: 6, total: 12, signal: true },
      { event: "2015-16 Industrial", date: "Aug 2015", triggered: 5, total: 12, signal: true },
      { event: "2018 Vol-mageddon", date: "Jan 2018", triggered: 4, total: 12, signal: false },
      { event: "2020 COVID", date: "Feb 2020", triggered: 7, total: 12, signal: true },
      { event: "2022 Bear", date: "Jan 2022", triggered: 8, total: 12, signal: true },
    ],
  },
  capitulation: {
    slug: "capitulation",
    title: "TCTM Capitulation Guide",
    short: "Flags panic selling / capitulation events through volume, breadth and volatility extremes.",
    threshold: "≥4 of 9 components triggered = Capitulation",
    howItWorks: "Components watch for selling exhaustion: 90% down days, TRIN spikes, VIX surges, A/D extremes.",
    components: [
      { name: "90% Down Volume Day", definition: "≥90% of NYSE volume on down ticks." },
      { name: "TRIN Spike", definition: "Arms Index closes above 2.0." },
      { name: "VIX Spike", definition: "VIX rises >30% in 5 days." },
      { name: "A/D Extreme", definition: "NYSE advancing issues <10% of total." },
      { name: "New Lows Surge", definition: "52w lows >5% of NYSE issues." },
      { name: "Put/Call Surge", definition: "CBOE equity put/call >1.0." },
      { name: "% Below 200dma", definition: ">70% of S&P 500 below 200dma." },
      { name: "Junk Spread Spike", definition: "HY OAS widens >100bp in 5 days." },
      { name: "Margin Decline", definition: "Margin debt YoY <-10%." },
    ],
    history: [
      { event: "2008 Lehman", date: "Oct 2008", triggered: 9, total: 9, signal: true },
      { event: "2020 COVID", date: "Mar 2020", triggered: 8, total: 9, signal: true },
      { event: "2018 Dec Low", date: "Dec 2018", triggered: 5, total: 9, signal: true },
      { event: "2022 Oct Low", date: "Oct 2022", triggered: 4, total: 9, signal: true },
    ],
  },
  bottom: {
    slug: "bottom",
    title: "TCTM Bottom Guide",
    short: "Identifies developing market bottom conditions via oversold breadth + sentiment washouts.",
    threshold: "≥4 of 10 components = Bottom",
    howItWorks: "Looks for the cluster of conditions that historically precedes durable lows.",
    components: [
      { name: "% >50d Oversold", definition: "<20% of S&P 500 above 50dma." },
      { name: "% >200d Oversold", definition: "<30% of S&P 500 above 200dma." },
      { name: "AAII Bears >50%", definition: "AAII bears exceed 50%." },
      { name: "Investors Intel Spread <0", definition: "Bulls minus bears below zero." },
      { name: "NAAIM <20", definition: "Active manager exposure <20." },
      { name: "Equity Put/Call Avg >0.85", definition: "10d avg equity put/call elevated." },
      { name: "McClellan Oscillator < -100", definition: "Deeply oversold breadth." },
      { name: "VIX > 30", definition: "Volatility regime breakout." },
      { name: "HY OAS > 500bp", definition: "Credit stress backdrop." },
      { name: "Insider Buy Ratio High", definition: "Insider buys/sells in top quartile." },
    ],
    history: [
      { event: "2009 Mar Low", date: "Mar 2009", triggered: 10, total: 10, signal: true },
      { event: "2011 Oct Low", date: "Oct 2011", triggered: 7, total: 10, signal: true },
      { event: "2020 Mar Low", date: "Mar 2020", triggered: 9, total: 10, signal: true },
      { event: "2022 Oct Low", date: "Oct 2022", triggered: 6, total: 10, signal: true },
    ],
  },
  thrust: {
    slug: "thrust",
    title: "TCTM Thrust Guide",
    short: "Identifies breadth thrust / momentum surge signals that often initiate new bull legs.",
    threshold: "≥4 of 11 components = Thrust",
    howItWorks: "Components track sudden, broad participation expansion across price, breadth, and volume.",
    components: [
      { name: "Zweig Breadth Thrust", definition: "10-day EMA of A/D ratio moves from <0.40 to >0.615 in ≤10 days." },
      { name: "Whaley Breadth Thrust", definition: "Composite of NYSE up volume and advancing issues." },
      { name: "90% Up Day", definition: "≥90% of NYSE volume on up ticks." },
      { name: "Back-to-Back 80% Up Days", definition: "Two consecutive 80%+ up volume days." },
      { name: ">55% of S&P 500 at 20d High", definition: "Broad short-term momentum." },
      { name: "% >50dma Surges >70", definition: "Surge from <30 to >70 within 10 days." },
      { name: "NYSE A/D Line New High", definition: "Cumulative A/D line at new 6-month high." },
      { name: "McClellan Summation Rising", definition: "Summation index above zero and rising." },
      { name: "New Highs Expansion", definition: "Net 52-week highs >5% of issues." },
      { name: "S&P 500 >50d & >200d", definition: "Index reclaims both key moving averages." },
      { name: "Volume Surge", definition: "Up volume / down volume ratio >9 on one session." },
    ],
    history: [
      { event: "2009 Mar Thrust", date: "Mar 2009", triggered: 9, total: 11, signal: true },
      { event: "2019 Jan Thrust", date: "Jan 2019", triggered: 6, total: 11, signal: true },
      { event: "2020 Apr Thrust", date: "Apr 2020", triggered: 10, total: 11, signal: true },
      { event: "2023 Nov Thrust", date: "Nov 2023", triggered: 7, total: 11, signal: true },
    ],
  },
  confirmation: {
    slug: "confirmation",
    title: "TCTM Confirmation Guide",
    short: "Confirms bull market resumption signals after a thrust or bottom registers.",
    threshold: "≥3 of 8 components = Confirmation",
    howItWorks: "Looks for follow-through over weeks: trend, breadth, leadership, and credit confirming the move.",
    components: [
      { name: "S&P 500 Above 200dma", definition: "Index closes above 200dma for 10 sessions." },
      { name: "50dma > 200dma", definition: "Golden cross active." },
      { name: "% >200dma >60", definition: "Majority of S&P 500 in long-term uptrends." },
      { name: "Cyclicals > Defensives", definition: "XLY/XLP and XLI/XLU ratios rising." },
      { name: "HY OAS Falling", definition: "Credit spreads tightening 30+ days." },
      { name: "Russell 2000 Outperforms", definition: "IWM/SPY 50d ROC >0." },
      { name: "Equal-Weight > Cap-Weight", definition: "RSP/SPY rising." },
      { name: "Net New Highs Positive", definition: "Net new highs > 0 for 10 sessions." },
    ],
    history: [
      { event: "2009 Confirmation", date: "Jun 2009", triggered: 7, total: 8, signal: true },
      { event: "2016 Feb Bottom Conf.", date: "Apr 2016", triggered: 5, total: 8, signal: true },
      { event: "2020 Apr Conf.", date: "May 2020", triggered: 6, total: 8, signal: true },
      { event: "2023 Conf.", date: "Jan 2023", triggered: 4, total: 8, signal: true },
    ],
  },
};
