/** Placeholder book from Dean's Slack screenshot. Not live. */

export type Stance = "Bullish" | "Bearish" | "Neutral";
export type VsBenchmark = "Overweight" | "Underweight" | "Neutral";

export type DeanHolding = {
  symbol: string;
  name: string;
  weightPct: number;
  subIndustry: string;
  lt: Stance;
  st: Stance;
};

export type DeanSector = {
  name: string;
  portfolioPct: number;
  benchmarkPct: number;
  vs: VsBenchmark;
  vsPct: number;
  holdings: DeanHolding[];
};

export type DeanComment = {
  id: string;
  postedAt: string;
  text: string;
};

export const DEAN_PORTFOLIO_AS_OF = "2026-10-06";

export const DEAN_PORTFOLIO_STATS = {
  holdings: 14,
  sectors: 3,
  spxWeightPct: 47.66,
  cashWeightPct: 17.26,
};

export const DEAN_PORTFOLIO_SECTORS: DeanSector[] = [
  {
    name: "Energy",
    portfolioPct: 2.91,
    benchmarkPct: 3.35,
    vs: "Neutral",
    vsPct: -0.4,
    holdings: [
      {
        symbol: "XLE",
        name: "State Street Energy Select Sector SPDR ETF",
        weightPct: 2.91,
        subIndustry: "Large-Cap Energy",
        lt: "Bullish",
        st: "Bullish",
      },
    ],
  },
  {
    name: "Health Care",
    portfolioPct: 5.14,
    benchmarkPct: 8.43,
    vs: "Underweight",
    vsPct: -3.3,
    holdings: [
      {
        symbol: "HNGE",
        name: "Hinge Health Inc Class A",
        weightPct: 2.33,
        subIndustry: "Health Care Services",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "WAT",
        name: "Waters Corp",
        weightPct: 0.95,
        subIndustry: "Life Sciences Tools & Services",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "XLV",
        name: "State Street Health Care Select Sector SPDR ETF",
        weightPct: 1.86,
        subIndustry: "Large-Cap Health Care",
        lt: "Bullish",
        st: "Bullish",
      },
    ],
  },
  {
    name: "Information Technology",
    portfolioPct: 27.02,
    benchmarkPct: 37.35,
    vs: "Underweight",
    vsPct: -10.3,
    holdings: [
      {
        symbol: "AIS",
        name: "VistaShares Artificial Intelligence Supercycle ETF",
        weightPct: 4.35,
        subIndustry: "Artificial Intelligence",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "DELL",
        name: "Dell Technologies Inc Class C",
        weightPct: 2.37,
        subIndustry: "Technology Hardware, Storage & Peri",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "DT",
        name: "Dynatrace Inc",
        weightPct: 1.03,
        subIndustry: "Application Software",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "MRVL",
        name: "Marvell Technology Inc",
        weightPct: 1.15,
        subIndustry: "Semiconductors",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "RSPT",
        name: "Invesco S&P 500 Equal Weight Technology ETF",
        weightPct: 2.58,
        subIndustry: "Large-Cap Technology",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "SMTC",
        name: "Semtech Corp",
        weightPct: 1.09,
        subIndustry: "Semiconductors",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "SNDK",
        name: "Sandisk Corp",
        weightPct: 0.96,
        subIndustry: "Technology Hardware, Storage & Peripherals",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "SOXX",
        name: "iShares Semiconductor ETF",
        weightPct: 3.3,
        subIndustry: "Semiconductors",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "WCBR",
        name: "WisdomTree Cybersecurity Fund",
        weightPct: 5.08,
        subIndustry: "Cybersecurity",
        lt: "Bullish",
        st: "Bullish",
      },
      {
        symbol: "XLK",
        name: "State Street Technology Select Sector SPDR ETF",
        weightPct: 4.31,
        subIndustry: "Large-Cap Technology",
        lt: "Bullish",
        st: "Bullish",
      },
    ],
  },
];

export const DEAN_TRADE_UPDATES: DeanComment[] = [
  {
    id: "1",
    postedAt: "2026-10-06T14:12:00-07:00",
    text: "Posted the book snapshot. Still underweight tech vs SPX on purpose — we own the pieces we want (SOXX, WCBR, AIS) rather than a full XLK clone. Cash ~17%.",
  },
  {
    id: "2",
    postedAt: "2026-10-03T09:41:00-07:00",
    text: "Added a touch to SOXX on the dip. Semi complex still looks constructive on the ST; LT remains bullish. Not chasing SNDK here.",
  },
  {
    id: "3",
    postedAt: "2026-09-29T16:05:00-07:00",
    text: "Health care stays light vs benchmark. HNGE is the active single-name; XLV is the sleeve. No change to WAT.",
  },
  {
    id: "4",
    postedAt: "2026-09-22T11:18:00-07:00",
    text: "Energy is a rounding-error overweight/underweight vs the index (XLE only). Neutral. Not a theme bet.",
  },
  {
    id: "5",
    postedAt: "2026-09-15T08:02:00-07:00",
    text: "Trimmed XLK, left WCBR as the largest cyber line. If we get a cleaner risk-off, I want dry powder from the cash line first.",
  },
];
