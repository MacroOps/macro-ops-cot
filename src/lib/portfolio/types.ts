export type PublicPosition = {
  name: string;
  ticker: string;
  notional: number | null;
  isShort: boolean;
  legNum: number | null;
};

export type PublicOption = {
  name: string;
  ticker: string;
  notional: number | null;
  isCall: boolean;
  isPut: boolean;
  isNet: boolean;
};

export type EquityGroups = {
  aerospace: PublicPosition[];
  metals: PublicPosition[];
  oil: PublicPosition[];
  other: PublicPosition[];
  crypto: PublicPosition[];
  techAI: PublicPosition[];
  agriculture: PublicPosition[];
  healthcare: PublicPosition[];
};

export type PortfolioSummary = {
  ytd: number | null;
  notional: number | null;
  equity: number | null;
  futures: number | null;
  cash: number | null;
  capitalRisk: number | null;
  ddRisk: number | null;
  r12m: number | null;
  ttm3yr: number | null;
  cagr3yr: number | null;
};

export type PortfolioSnapshot = {
  summary: PortfolioSummary;
  alloc: Array<{ name: string; pct: number }>;
  futures: PublicPosition[];
  eq: EquityGroups;
  opts: PublicOption[];
  asOf: string;
};

export type StatsPoint = {
  date: string; // YYYY-MM-DD
  ytd: number;
};
