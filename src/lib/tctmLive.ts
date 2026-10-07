/** Dean's TCTM Live snapshot. Manual WordPress page, ported 2026-10-04. */

export type TctmTone = "Neutral" | "Bullish" | "Bearish";

export type TctmLiveStage = {
  id: "risk-off" | "capitulation" | "bottom" | "thrust" | "confirmation" | "lt-trend";
  label: string;
  signal: TctmTone;
  date: string | null;
  count: number | null;
  href?: string;
};

export const TCTM_LIVE_UPDATED = "2026-10-04";

export const TCTM_LIVE_STAGES: TctmLiveStage[] = [
  { id: "risk-off", label: "Risk", signal: "Neutral", date: null, count: 33.33, href: "/tpmr/tctm/risk-off" },
  { id: "capitulation", label: "Capitulation", signal: "Neutral", date: null, count: 0, href: "/tpmr/tctm/capitulation" },
  { id: "bottom", label: "Bottom", signal: "Neutral", date: null, count: 0, href: "/tpmr/tctm/bottom" },
  { id: "thrust", label: "Thrust", signal: "Neutral", date: null, count: 0, href: "/tpmr/tctm/thrust" },
  { id: "confirmation", label: "Confirmation", signal: "Neutral", date: null, count: 0, href: "/tpmr/tctm/confirmation" },
  { id: "lt-trend", label: "LT Trend", signal: "Bullish", date: "2023-05-22", count: null },
];

export const TCTM_LIVE_LEAD: string[] = [
  "Market breadth continues to erode as rising Treasury yields put increasing pressure on stocks. The deterioration extended in the week ending October 2, when the 52-week Spike Low Model for the S&P 1500 index triggered a warning, indicating poor breadth conditions across large-, mid-, and small-cap stocks. That brings the number of 52-week-low components flashing alerts within the risk-off composite to three of four. With this new signal, the TCTM Risk-Off composite signal count has now risen to 33.33%, one shy of a broad composite warning.",
  "Taken together, these warnings suggest that risks are rising. Investors should remain disciplined and maintain a strong focus on risk management.",
];

export const TCTM_LIVE_SECTIONS: Array<{
  title: string;
  body: string[];
  images: Array<{ src: string; alt: string }>;
}> = [
  {
    title: "Tactical Composite Trend Model",
    body: [],
    images: [{ src: "/tpmr/tctm-live/TCTM.jpg", alt: "TCTM composite overview" }],
  },
  {
    title: "TCTM Risk-Off Composite",
    body: ["The TCTM Risk-Off Composite has now increased to 33.33%, reflecting four component alerts."],
    images: [{ src: "/tpmr/tctm-live/Risk.jpg", alt: "TCTM Risk-Off composite" }],
  },
  {
    title: "Risk-Off · open alerts",
    body: [
      "Open alerts include the 52-week low spike models for the NYSE, S&P 500, and S&P 1500, along with a breadth composite signal highlighting weak participation among S&P 500 stocks.",
    ],
    images: [{ src: "/tpmr/tctm-live/Risk2.jpg", alt: "TCTM Risk-Off component alerts" }],
  },
  {
    title: "TCTM Capitulation Composite",
    body: [
      "The Capitulation Composite, designed to identify periods of extreme selling pressure often associated with crash-like conditions, last triggered on April 7, 2025 — one day before the “Liberation Day” bottom — marking just the 11th signal since 1929.",
    ],
    images: [{ src: "/tpmr/tctm-live/Cap.jpg", alt: "TCTM Capitulation composite" }],
  },
  {
    title: "TCTM Bottom Composite",
    body: ["The Bottom Composite currently stands at 0%, reflecting no component alerts."],
    images: [{ src: "/tpmr/tctm-live/Bottom.jpg", alt: "TCTM Bottom composite" }],
  },
  {
    title: "TCTM Thrust Composite",
    body: ["The TCTM Thrust Composite signal count decreased to 0% with the expiration of all component alerts."],
    images: [{ src: "/tpmr/tctm-live/Thrust.jpg", alt: "TCTM Thrust composite" }],
  },
  {
    title: "TCTM Confirmation Composite",
    body: ["The TCTM Confirmation Composite signal count decreased to 0% with the expiration of all component alerts."],
    images: [{ src: "/tpmr/tctm-live/Confirm.jpg", alt: "TCTM Confirmation composite" }],
  },
  {
    title: "Secondary systems",
    body: [],
    images: [
      { src: "/tpmr/tctm-live/ST.jpg", alt: "Short-term secondary system" },
      { src: "/tpmr/tctm-live/LT.jpg", alt: "Long-term secondary system" },
      { src: "/tpmr/tctm-live/Trend.jpg", alt: "Trend secondary system" },
      { src: "/tpmr/tctm-live/Risk4.jpg", alt: "Risk secondary system" },
    ],
  },
];

export const TCTM_LIVE_COMPONENTS: Array<{ title: string; body: string }> = [
  {
    title: "Long-Term Trend",
    body: "Measures the primary trend for the S&P 500 by employing long-term trend and momentum measures.",
  },
  {
    title: "Risk-Off Composite",
    body: "Flags deterioration in stock participation, signaling that a broad market countertrend drawdown may be imminent. It captures the narrowing leadership typical of late-stage bull markets.",
  },
  {
    title: "Capitulation Composite",
    body: "Identifies extreme selling pressure or oversold conditions consistent with panic selling or market crashes. This model helps detect when the worst of a decline may be occurring.",
  },
  {
    title: "Bottom Composite",
    body: "Highlights divergences in downside participation, signaling that fewer and fewer stocks are showing signs of exhaustion in the decline, laying the groundwork for a potential bottom.",
  },
  {
    title: "Thrust Composite",
    body: "Captures robust upside participation, also known as a breadth thrust. These signals often mark the end of bear markets and the start of strong bullish trends.",
  },
  {
    title: "Confirmation Composite",
    body: "Confirms the durability of a recovery by verifying that long-term measures of market breadth have shifted from bearish to bullish conditions, suggesting the new uptrend will persist.",
  },
];
