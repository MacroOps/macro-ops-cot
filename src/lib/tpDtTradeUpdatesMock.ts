/** Sample #dt_trade_updates posts. Replace with Slack when that channel is wired. */

export type TpDtTradeUpdate = {
  id: string;
  postedAt: string;
  text: string;
};

export const TP_DT_TRADE_UPDATES: TpDtTradeUpdate[] = [
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
