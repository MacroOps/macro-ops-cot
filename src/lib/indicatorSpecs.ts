// Source of truth: indicator construction per the MO Indicators doc.
// Pages render from these specs so component counts, lookbacks, thresholds,
// and "how it's built" affordances stay consistent and match the spec.

export type SpecOutput = "percentile" | "zscore" | "ratio" | "signal" | "score" | "raw";

export interface ComponentSpec {
  id: string;
  title: string;
  inputs: string[];        // raw data series the component consumes
  steps: string[];         // bullet-by-bullet formula from the doc
  output: SpecOutput;
  scale?: { min: number; max: number };
  thresholds?: { hi?: number; lo?: number };
  weight?: number;         // for scored aggregators (Breadth)
}

export interface IndicatorSpec {
  slug: string;
  name: string;
  category:
    | "trend-fragility"
    | "risk-cycle"
    | "market-internals"
    | "breadth"
    | "thrust"
    | "macro";
  description: string;
  composite: {
    title: string;
    steps: string[];
    output: SpecOutput;
    scale?: { min: number; max: number };
    thresholds?: { hi?: number; lo?: number };
  };
  components: ComponentSpec[];
  /** All distinct raw data series the model needs (for the Inputs Required rail). */
  inputs: string[];
}

const PCT = { min: 0, max: 100 } as const;
const PCT_THRESH = { hi: 90, lo: 20 } as const;

// ---------------------------------------------------------------------------
// Trend Fragility
// ---------------------------------------------------------------------------

export const TREND_FRAGILITY: IndicatorSpec = {
  slug: "trend-fragility",
  name: "Trend Fragility",
  category: "trend-fragility",
  description:
    "Composite of six sentiment, positioning, flow, and regime components.",
  composite: {
    title: "Macro Ops | Trend Fragility (Composite)",
    steps: [
      "Take the mean of the six component percentile series by date.",
      "Transform the mean into a percentile rank.",
      "Apply a 5-day rolling mean to smooth.",
    ],
    output: "percentile",
    scale: PCT,
    thresholds: PCT_THRESH,
  },
  components: [
    {
      id: "fund-flows",
      title: "Aggregate Fund Flows (6M Basis)",
      inputs: ["ICI weekly equity fund flows"],
      steps: [
        "Rolling sum of fund flow values over the last 100 trading days.",
        "Transform the rolling sum into a percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
    {
      id: "put-call",
      title: "Put / Call Ratio",
      inputs: ["OCC equity put/call ratio (daily)"],
      steps: [
        "Invert the put/call ratio by multiplying by −1.",
        "Take the 10-day rolling average.",
        "Compute the rolling 10-year percentile.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
    {
      id: "aaii",
      title: "AAII Bull-Bear Index",
      inputs: ["AAII weekly investor sentiment (bullish %, bearish %)"],
      steps: [
        "Compute net sentiment = bullish − bearish.",
        "Apply a 5-period rolling mean.",
        "Transform the smoothed value into a percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
    {
      id: "net-specs",
      title: "Aggregate Net Speculators (Large + Small)",
      inputs: ["CFTC Legacy report: large + small spec net positions, open interest"],
      steps: [
        "Total net = large speculators net + small speculators net.",
        "Compute ratio: total net ÷ open interest.",
        "Apply a 152-week stochastic oscillator to the ratio.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
    {
      id: "regime",
      title: "Market Regime Index",
      inputs: ["S&P 500 daily closes"],
      steps: [
        "Take 100 consecutive days of daily log returns.",
        "Compute mean ÷ standard deviation × √100.",
        "Transform the resulting series into a percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
    {
      id: "pairwise-corr",
      title: "Pairwise Correlations",
      inputs: ["S&P 500 constituent return correlation matrix"],
      steps: [
        "Invert the pairwise correlation series by multiplying by −1.",
        "Transform the inverted values into a percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: PCT_THRESH,
    },
  ],
  inputs: [
    "ICI weekly fund flows",
    "OCC equity put/call ratio",
    "AAII weekly sentiment",
    "CFTC Legacy report (all reportables)",
    "S&P 500 daily closes",
    "S&P 500 constituent returns",
  ],
};

// ---------------------------------------------------------------------------
// Risk Cycle
// ---------------------------------------------------------------------------

export const RISK_CYCLE: IndicatorSpec = {
  slug: "risk-cycle",
  name: "Risk Cycle",
  category: "risk-cycle",
  description:
    "Where we are in the risk-taking cycle. Mean of four margin, retail, leveraged-funds, and valuation components.",
  composite: {
    title: "Macro Ops | Risk Cycle (Composite)",
    steps: [
      "Mean across the four available components.",
      "Transform composite mean to percentile rank.",
      "Apply 5-day rolling average smoothing.",
    ],
    output: "percentile",
    scale: PCT,
    thresholds: { hi: 80, lo: 20 },
  },
  components: [
    {
      id: "finra",
      title: "FINRA Margin Debt",
      inputs: ["FINRA monthly margin debt"],
      steps: [
        "Take monthly FINRA margin debt values.",
        "12-month rate of change: current ÷ value 12 months prior − 1.",
        "Transform to percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: { hi: 80, lo: 20 },
    },
    {
      id: "stax",
      title: "Schwab Trading Activity Index (STAX)",
      inputs: ["Schwab STAX daily series"],
      steps: ["Use STAX daily values as-is."],
      output: "raw",
      scale: { min: 0, max: 100 },
      thresholds: { hi: 80, lo: 20 },
    },
    {
      id: "lev-funds",
      title: "Leveraged Funds Sentiment",
      inputs: ["CFTC TFF Leveraged Funds: ES, YM, NQ longs and shorts"],
      steps: [
        "Aggregate Lev Funds positions across S&P 500, Dow, and Nasdaq 100.",
        "Ratio = long ÷ (long + short).",
        "Apply a 3-week rolling average.",
        "Transform to percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: { hi: 80, lo: 20 },
    },
    {
      id: "fwd-pe",
      title: "Forward Price / Earnings",
      inputs: ["S&P 500 forward P/E (sell-side consensus)"],
      steps: [
        "Use forward P/E values for the S&P 500.",
        "Transform to percentile rank.",
      ],
      output: "percentile",
      scale: PCT,
      thresholds: { hi: 80, lo: 20 },
    },
  ],
  inputs: [
    "FINRA monthly margin debt",
    "Schwab STAX",
    "CFTC TFF (Leveraged Funds: ES, YM, NQ)",
    "S&P 500 forward P/E",
  ],
};

// ---------------------------------------------------------------------------
// Market Internals
// ---------------------------------------------------------------------------

export const MARKET_INTERNALS: IndicatorSpec = {
  slug: "market-internals",
  name: "Market Internals",
  category: "market-internals",
  description:
    "Eight risk-on/off ratio panels. Composite is the median of 63-day stochs minus SPY's 63-day stoch, smoothed.",
  composite: {
    title: "Macro Ops | Market Internals (Composite)",
    steps: [
      "For each component ratio, compute a 63-day stochastic oscillator.",
      "Take the median across all component oscillators by date.",
      "Subtract the SPY 63-day stochastic oscillator from this median.",
      "Apply a 5-day rolling mean to the adjusted composite.",
    ],
    output: "raw",
    scale: { min: -80, max: 80 },
    thresholds: { hi: 50, lo: -50 },
  },
  components: [
    {
      id: "soxx-spy",
      title: "SOXX / SPY",
      inputs: ["SOXX", "SPY"],
      steps: ["Compute ratio: SOXX ÷ SPY."],
      output: "ratio",
    },
    {
      id: "cyc-def",
      title: "Cyclicals / Defensives",
      inputs: ["XLF, XLE, XLB, XLI, XLY (cyclicals)", "XLU, XLP, XLRE (defensives)"],
      steps: [
        "Sum cyclicals (XLF + XLE + XLB + XLI + XLY) by date.",
        "Sum defensives (XLU + XLP + XLRE) by date.",
        "Compute ratio: cyclicals ÷ defensives.",
      ],
      output: "ratio",
    },
    {
      id: "disc-stap",
      title: "Discretionary / Staples (Equal Weight)",
      inputs: ["RSPD", "RSPS"],
      steps: ["Compute ratio: RSPD ÷ RSPS."],
      output: "ratio",
    },
    {
      id: "lqd-ief",
      title: "LQD / IEF",
      inputs: ["LQD", "IEF"],
      steps: ["Compute ratio: LQD ÷ IEF."],
      output: "ratio",
    },
    {
      id: "vix-curve",
      title: "VIX Curve (VIX3M / VIX)",
      inputs: ["VIX3M", "VIX"],
      steps: ["Compute ratio: VIX3M ÷ VIX."],
      output: "ratio",
    },
    {
      id: "hb-lv",
      title: "High Beta / Low Vol (SPHB / USMV)",
      inputs: ["SPHB", "USMV"],
      steps: ["Compute ratio: SPHB ÷ USMV."],
      output: "ratio",
    },
    {
      id: "breadth-sma",
      title: "Breadth SMA (10-Day)",
      inputs: ["S&P 500 % of stocks above 10-day SMA"],
      steps: [
        "Use S&P 500 % of stocks above their 10-day SMA.",
        "Apply a 10-day SMA to the series.",
      ],
      output: "raw",
      scale: PCT,
    },
    {
      id: "spy-osc",
      title: "S&P 500 Oscillator",
      inputs: ["SPY"],
      steps: ["Compute SPY 63-day stochastic oscillator."],
      output: "percentile",
      scale: PCT,
    },
  ],
  inputs: [
    "SOXX, SPY",
    "XLF, XLE, XLB, XLI, XLY, XLU, XLP, XLRE",
    "RSPD, RSPS",
    "LQD, IEF",
    "VIX, VIX3M",
    "SPHB, USMV",
    "S&P 500 % > 10D SMA",
  ],
};

// ---------------------------------------------------------------------------
// Breadth Aggregator (scored, max = 6)
// ---------------------------------------------------------------------------

export const BREADTH_AGGREGATOR: IndicatorSpec = {
  slug: "breadth-aggregator",
  name: "Breadth Aggregator",
  category: "breadth",
  description:
    "Weighted sum of five participation rules. Maximum score = 6 (1+2+1+1+1).",
  composite: {
    title: "Macro Ops | Breadth Aggregator",
    steps: ["Sum the five component scores below. Max possible = 6."],
    output: "score",
    scale: { min: 0, max: 6 },
    thresholds: { hi: 4 },
  },
  components: [
    {
      id: "pct-above-50",
      title: "% S&P 500 > 50D SMA",
      inputs: ["S&P 500 % stocks > 50-day SMA"],
      steps: [
        "Take the 21-day rolling minimum.",
        "If rolling min ≤ 0.20 → score 1, else 0.",
      ],
      output: "score",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "pct-above-200",
      title: "% S&P 500 > 200D SMA",
      inputs: ["S&P 500 % stocks > 200-day SMA"],
      steps: [
        "Take the 63-day rolling minimum.",
        "If rolling min ≤ 0.20 → score 2, else 0.",
      ],
      output: "score",
      scale: { min: 0, max: 2 },
      weight: 2,
    },
    {
      id: "div-pct200-spx",
      title: "Divergence: %>200D SMA vs SPX",
      inputs: ["% stocks > 200D SMA", "S&P 500 close"],
      steps: [
        "200d stoch(% > 200D) − 200d stoch(SPX close).",
        "Rank as percentile.",
        "63-day rolling minimum of the percentile.",
        "If min percentile ≤ 0.05 → score 0, else 1.",
      ],
      output: "score",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "nh-nl-50",
      title: "NYSE New Highs − New Lows (50 SMA)",
      inputs: ["NYSE new highs", "NYSE new lows", "S&P 500 close"],
      steps: [
        "200d stoch(50D SMA of NH−NL) − 200d stoch(SPX close).",
        "Rank as percentile.",
        "63-day rolling minimum.",
        "If min percentile ≤ 0.05 → score 0, else 1.",
      ],
      output: "score",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "mcclellan-div",
      title: "McClellan Summation vs SPX Divergence",
      inputs: ["McClellan Summation", "S&P 500 close"],
      steps: [
        "200d stoch(McClellan Summation) − 200d stoch(SPX close).",
        "Rank as percentile.",
        "63-day rolling minimum.",
        "If min percentile ≤ 0.05 → score 0, else 1.",
      ],
      output: "score",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
  ],
  inputs: [
    "S&P 500 % > 50D / 200D SMA",
    "S&P 500 close",
    "NYSE new highs / new lows",
    "McClellan Summation",
  ],
};

// ---------------------------------------------------------------------------
// Breadth Thrust Aggregator (10 binary signals: 6 thrust + 4 capitulation)
// ---------------------------------------------------------------------------

export const THRUST_AGGREGATOR: IndicatorSpec = {
  slug: "thrust-aggregator",
  name: "Breadth Thrust Aggregator",
  category: "thrust",
  description:
    "Sum of ten binary signals — six thrust + four capitulation/oversold.",
  composite: {
    title: "Macro Ops | Breadth Thrust Aggregator",
    steps: ["Sum the ten binary signals. Max possible = 10."],
    output: "score",
    scale: { min: 0, max: 10 },
    thresholds: { hi: 3 },
  },
  components: [
    // --- Thrust ---
    {
      id: "thrust-roc5",
      title: "5D ROC of SPX Log Returns (Thrust)",
      inputs: ["S&P 500 daily log returns"],
      steps: [
        "Percentile rank of 5-day ROC.",
        "63-day rolling max of percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "thrust-above-10",
      title: "% SPX > 10D SMA",
      inputs: ["S&P 500 % > 10-day SMA"],
      steps: ["63-day rolling max.", "≥ 0.90 → 1, else 0."],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "thrust-15-90",
      title: "% > 50D SMA: 15% → 90% in <50D",
      inputs: ["S&P 500 % > 50-day SMA"],
      steps: ["Condition met → 1, else 0.", "63-day rolling max of signal."],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "thrust-nh4w",
      title: "% SPX Making New 4W Highs",
      inputs: ["S&P 500 % stocks at 4-week highs"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "thrust-rsi70",
      title: "% SPX with RSI > 70",
      inputs: ["S&P 500 constituent RSI"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "thrust-bb-upper",
      title: "% SPX Above Upper Bollinger Band",
      inputs: ["S&P 500 constituent Bollinger Bands"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    // --- Capitulation / Oversold ---
    {
      id: "cap-roc5",
      title: "5D ROC of SPX Log Returns (Capitulation)",
      inputs: ["S&P 500 daily log returns"],
      steps: [
        "Percentile rank.",
        "63-day rolling MIN percentile.",
        "≤ 0.00317 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "cap-bb-lower",
      title: "% SPX Below Lower Bollinger Band",
      inputs: ["S&P 500 constituent Bollinger Bands"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "cap-nl4w",
      title: "% SPX Making New 4W Lows",
      inputs: ["S&P 500 % stocks at 4-week lows"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
    {
      id: "cap-rsi30",
      title: "% SPX with RSI < 30",
      inputs: ["S&P 500 constituent RSI"],
      steps: [
        "Percentile rank.",
        "63-day rolling max percentile.",
        "≥ 0.998 → 1, else 0.",
      ],
      output: "signal",
      scale: { min: 0, max: 1 },
      weight: 1,
    },
  ],
  inputs: [
    "S&P 500 daily log returns",
    "S&P 500 % > 10D / 50D SMA",
    "S&P 500 % at 4-week highs / lows",
    "S&P 500 constituent RSI",
    "S&P 500 constituent Bollinger Bands",
  ],
};

// ---------------------------------------------------------------------------
// MO Liquidity
// ---------------------------------------------------------------------------

export const MO_LIQUIDITY: IndicatorSpec = {
  slug: "mo-liquidity",
  name: "MO Liquidity Indicator",
  category: "macro",
  description:
    "Four financial-conditions inputs combined via rolling z-score, sign-flipped so looser = higher.",
  composite: {
    title: "MO: Liquidity Indicator",
    steps: [
      "504-day rolling z-score per input series.",
      "Daily mean of z-scores across the four series.",
      "Multiply by −1 (looser conditions → higher).",
      "Apply 756-day rolling window percentile.",
    ],
    output: "percentile",
    scale: PCT,
    thresholds: { hi: 80, lo: 20 },
  },
  components: [
    {
      id: "nfci",
      title: "Chicago Fed NFCI",
      inputs: ["FRED: NFCI"],
      steps: ["504-day rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "ust-10y",
      title: "10-Year Treasury Yield",
      inputs: ["FRED: DGS10"],
      steps: ["504-day rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "hy-eff",
      title: "ICE BofA US HY Effective Yield",
      inputs: ["FRED: BAMLH0A0HYM2EY"],
      steps: ["504-day rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "hy-oas",
      title: "ICE BofA US HY Option-Adjusted Spread",
      inputs: ["FRED: BAMLH0A0HYM2"],
      steps: ["504-day rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
  ],
  inputs: [
    "FRED NFCI",
    "FRED DGS10",
    "FRED BAMLH0A0HYM2EY",
    "FRED BAMLH0A0HYM2",
  ],
};

// ---------------------------------------------------------------------------
// MO Inflation Lead
// ---------------------------------------------------------------------------

export const MO_INFLATION_LEAD: IndicatorSpec = {
  slug: "mo-inflation-lead",
  name: "MO Inflation Lead Indicator",
  category: "macro",
  description:
    "Average of five leading inflation inputs, each standardized via an 84-month rolling z-score.",
  composite: {
    title: "MO: Inflation Lead Indicator",
    steps: [
      "Standardize each input via 84-month rolling z-score.",
      "Average the standardized series into a single composite.",
    ],
    output: "zscore",
    scale: { min: -3, max: 3 },
    thresholds: { hi: 1, lo: -1 },
  },
  components: [
    {
      id: "gasoline",
      title: "Gasoline Prices",
      inputs: ["EIA / FRED retail gasoline"],
      steps: ["84-month rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "nfib",
      title: "NFIB Small Business Price Pressures",
      inputs: ["NFIB monthly survey"],
      steps: ["84-month rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "m2",
      title: "M2 Money Supply",
      inputs: ["FRED: M2SL"],
      steps: ["84-month rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "ism-mfg",
      title: "ISM Manufacturing PMI",
      inputs: ["ISM Manufacturing PMI"],
      steps: ["84-month rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
    {
      id: "home-prices",
      title: "Home Prices",
      inputs: ["Case-Shiller / FHFA HPI"],
      steps: ["84-month rolling z-score."],
      output: "zscore",
      scale: { min: -3, max: 3 },
    },
  ],
  inputs: [
    "Retail gasoline prices",
    "NFIB small business survey",
    "FRED M2SL",
    "ISM Manufacturing PMI",
    "Case-Shiller / FHFA HPI",
  ],
};
