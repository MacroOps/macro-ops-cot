/** Dean's Turning Point glossary. Static copy from TPMR, ported for Terminus. */

export type GlossaryBlock = {
  title: string;
  body: string[];
  bullets?: string[];
};

export const TCTM_GLOSSARY_MODELS = [
  "Tactical Composite Trend Model",
  "S&P 500 Risk-On/Off Composite (Short-Term Model)",
  "S&P 500 Risk-On/Off Composite (Long-Term Model)",
  "S&P 500 Trend System",
];

export const TCTM_GLOSSARY_BEARISH: GlossaryBlock[] = [
  {
    title: "Short-Term Bearish / Long-Term Bullish",
    body: [
      "A short-term bearish outlook emerges when a TCTM Risk-Off signal is triggered within the context of a bullish long-term trend, as defined by the TCTM Long-Term Trend Model. This scenario typically occurs near the outset of significant corrections or bear market peaks.",
    ],
  },
  {
    title: "Long-Term Bearish",
    body: [
      "A long-term bearish outlook occurs when the TCTM Long-Term Trend Model shifts from positive to negative, and the Risk On/Off Composite (LT) and Trend System confirm an adverse market environment. These conditions are typically associated with bear markets.",
    ],
  },
];

export const TCTM_GLOSSARY_BULLISH: GlossaryBlock[] = [
  {
    title: "Short-Term Bullish / Long-Term Bullish",
    body: [
      "A shift from a bearish to bullish short-term view—within the context of a bullish long-term backdrop (TCTM Long-Term Trend Model positive)—would take place if either a capitulation or bottom signal developed and was followed by the emergence of thrust signals. Historically, this type of setup has tended to occur after a Risk-Off signal that sparked a significant correction, as seen in 1998 or 2025.",
    ],
  },
  {
    title: "Short-Term Bullish / Long-Term Bearish",
    body: [
      "A short-term bullish view emerges when a TCTM capitulation or TCTM bottom signal occurs within the context of a negative TCTM Long-Term Trend condition. This scenario typically represents a potential countertrend rally within a significant correction or bear market environment and should be managed as a tactical trade.",
    ],
  },
  {
    title: "Short-Term Bullish / Long-Term Bearish (thrust follow-through)",
    body: [
      "A short-term bullish outlook develops when a TCTM capitulation or bottom signal is followed by a thrust signal, against the backdrop of a negative TCTM Long-Term Trend condition. This setup often indicates a market transition from a significant correction to a new cyclical advance, or from a bear market into the early stages of a bull market.",
    ],
  },
  {
    title: "Long-Term Bullish",
    body: [
      "A long-term bullish outlook occurs when the TCTM Long-Term Trend Model shifts from negative to positive.",
    ],
  },
];

export const TCTM_GLOSSARY_COMPONENTS: Array<{ title: string; body: string; href?: string }> = [
  {
    title: "Long-Term Trend",
    body: "Measures the primary trend for the S&P 500 by employing long-term trend and momentum measures.",
    href: "/tpmr/tctm-live",
  },
  {
    title: "Risk-Off Composite",
    body: "Flags deterioration in stock participation, signaling that a broad market countertrend drawdown may be imminent. It captures the narrowing leadership typical of late-stage bull markets.",
    href: "/tpmr/tctm/risk-off",
  },
  {
    title: "Capitulation Composite",
    body: "Identifies extreme selling pressure or oversold conditions consistent with panic selling or market crashes. This model helps detect when the worst of a decline may be occurring.",
    href: "/tpmr/tctm/capitulation",
  },
  {
    title: "Bottom Composite",
    body: "Highlights divergences in downside participation, signaling that fewer and fewer stocks are showing signs of exhaustion in the decline, laying the groundwork for a potential bottom.",
    href: "/tpmr/tctm/bottom",
  },
  {
    title: "Thrust Composite",
    body: "Captures robust upside participation, also known as a breadth thrust. These signals often mark the end of bear markets and the start of strong bullish trends.",
    href: "/tpmr/tctm/thrust",
  },
  {
    title: "Confirmation Composite",
    body: "Confirms the durability of a recovery by verifying that long-term measures of market breadth have shifted from bearish to bullish conditions, suggesting the new uptrend will persist.",
    href: "/tpmr/tctm/confirmation",
  },
];

export const TCTM_GLOSSARY_RISK_ST: GlossaryBlock = {
  title: "Risk On/Off Composite (Short-Term)",
  body: [
    "The Risk On/Off Composite (Short-Term) is a proprietary market gauge designed to quantify the balance between risk-seeking and risk-averse conditions. It leverages two core pillars: trend and breadth.",
    "The composite ranges from 0% to 100%, with higher readings indicating an environment characterized by strong price trends and broad participation, and lower readings signifying weakening trends and narrowing breadth.",
    "Traders will find the short-term risk-on/off composite most useful as a short-to intermediate-term timing system. However, keep in mind that it works best for indexes or sectors with an offensive orientation that tend to trend. During sideways or choppy markets, it can experience whipsaw signals.",
    "For investors with a long-term approach, it can be used as a timing mechanism to navigate market peaks and troughs in conjunction with signals from other models.",
  ],
  bullets: [
    "Trend Components (60% of total): The composite comprises three independent trend-following indicators, each contributing 20%. These receive greater weighting because price is the final arbiter in the market’s voting mechanism, reflecting the most conclusive evidence of prevailing conditions.",
    "Breadth Components (40% of total): Complementing the trend measures are four short- to medium-term market breadth indicators, each worth 10%. These components evaluate participation across a broad range of securities, providing an indication of the internal health of an index and confirming (or warning against) the sustainability of price trends.",
  ],
};

export const TCTM_GLOSSARY_RISK_LT: GlossaryBlock = {
  title: "Risk-On/Off Composite (Long-Term)",
  body: [
    "The Risk-On/Off Composite (Long-Term) is a proprietary market gauge designed to quantify the balance between risk-seeking and risk-averse conditions. It leverages two core pillars: trend and breadth.",
    "The composite ranges from 0% to 100%, with higher readings indicating an environment characterized by strong price trends and broad participation, and lower readings signifying weakening trends and narrowing breadth.",
    "The Risk-On/Off Composite (LT) offers a big-picture overview of market conditions, making it more suitable for investors with a long-term investment horizon. Rather than serving as a short-term trading tool, it highlights broad shifts in risk appetite that can help investors gauge whether the environment is more supportive of taking on additional equity exposure or favoring a more defensive stance. It has historically been adept at avoiding large bear markets. However, it can be susceptible to whipsaws during significant corrections.",
  ],
  bullets: [
    "Trend Components (60% of total): The composite comprises three independent trend-following indicators, each contributing 20%. These receive greater weighting because price is the final arbiter in the market’s voting mechanism, reflecting the most conclusive evidence of prevailing conditions.",
    "Breadth Components (40% of total): Complementing the trend measures are four long-term market breadth indicators, each worth 10%. These components evaluate participation across a broad range of securities, providing an indication of the internal health of an index and confirming (or warning against) the sustainability of price trends.",
  ],
};

export const TCTM_GLOSSARY_TREND_SYSTEM: GlossaryBlock = {
  title: "Trend System",
  body: [
    "The Trend System uses a weight-of-the-evidence approach by combining short and long-term trend composites to identify significant shifts in market direction:",
    "The trend system shifts to a bullish status when the majority of its composite components register favorable conditions. Conversely, it turns bearish when only a limited number of components remain supportive. Beyond this aggregate measure, the model also integrates trend inflection signals, which occur when the composite score shifts by a meaningful amount over a short period.",
    "Like any trend-following system, it performs best in sustained trending markets and tends to struggle in choppy, sideways conditions. The inflection signals provide more timely entries and exits than would otherwise occur when relying solely on the composite thresholds for signals.",
  ],
  bullets: [
    "Long-Term Trend Composite – Comprised of 10 long-term trend indicators, this composite serves as the system’s primary gauge of market conditions, defining whether the prevailing trend is bullish or bearish.",
    "Short-Term Trend Composite – Comprised of 10 short-term trend indicators, this composite acts as a secondary filter and ensures that favorable near-term price action supports long-term trend conditions.",
  ],
};

export const TCTM_GLOSSARY_DUAL_LT: GlossaryBlock = {
  title: "Dual Trend System (LT)",
  body: [
    "The Dual Trend System (LT) is a proprietary model designed to identify securities that are in established uptrends and exhibiting leadership. It leverages two core pillars: trend-following and relative strength.",
    "The Dual Trend System (LT) issues a buy signal when both composites simultaneously rise above bullish thresholds and the security confirms with an absolute and relative breakout. Sell signals occur when either the trend, the relative trend, or both deteriorate to levels consistent with unfavorable conditions. Though the long-term model is slower to adjust and vulnerable to drawdowns near peaks, it excels at identifying sustainable trends and avoiding premature shakeouts.",
  ],
  bullets: [
    "Trend Composite – This composite applies 10 long-term trend-following indicators to a security’s price, producing a trend gauge ranging from 0% (weakest) to 100% (strongest).",
    "Relative Trend Composite – This composite applies 10 long-term trend indicators to the ratio between a security and the S&P 500 to determine a relative trend gauge, ranging from 0% (weakest) to 100% (strongest).",
  ],
};

export const TCTM_GLOSSARY_DUAL_ST: GlossaryBlock = {
  title: "Dual Trend System (ST)",
  body: [
    "The Dual Trend System (ST) is a proprietary model designed to identify securities that are in established uptrends and exhibiting leadership. It leverages two core pillars: trend-following and relative strength.",
    "The Dual Trend System (ST) issues a buy signal when both composites simultaneously rise above bullish thresholds and the security confirms with an absolute and relative breakout. Sell signals occur when either the trend, the relative trend, or both deteriorate to levels consistent with unfavorable conditions. Designed with flexibility in mind, the short-term model helps traders identify tactical swing setups while also serving as a timely entry tool when stocks transition out of drawdown phases.",
  ],
  bullets: [
    "Trend Composite – This composite applies 10 short-term trend-following indicators to a security’s price, producing a trend gauge ranging from 0% (weakest) to 100% (strongest).",
    "Relative Trend Composite – This composite applies 10 short-term trend indicators to the ratio between a security and the S&P 500 to determine a relative trend gauge, ranging from 0% (weakest) to 100% (strongest).",
  ],
};

export const TCTM_GLOSSARY_PROCESS: Array<{ title: string; body: string[] }> = [
  {
    title: "Phase 1: Initiation (Short-Term Dual Trend Signals)",
    body: [
      "As stocks emerge from a market correction, traders or investors should monitor the short-term Dual Trend System as it provides more timely entry points for emerging trends.",
      "If a stock fails to maintain its short-term buy signal, it is sold, and focus shifts to the next opportunity.",
    ],
  },
  {
    title: "Phase 2: Transition (Confirmation by Long-Term Dual Trend Signals)",
    body: [
      "As the uptrend progresses, stocks that continue to exhibit improving leadership trends typically transition to a long-term Dual Trend buy signal.",
      "In this scenario, investors should adhere to the long-term dual trend rules to minimize the effects of short-term volatility and position for sustained gains.",
    ],
  },
  {
    title: "Phase 3: Established Uptrend (Hold or Trade)",
    body: [
      "Investor Path: Investors should maintain an allocation to stocks as long as the long-term Dual Trend model remains on a buy signal.",
      "Trader Path: Traders can utilize the short-term system to trade pullbacks within the context of a bullish long-term trend signal.",
    ],
  },
  {
    title: "Phase 4: Risk Management (TCTM Risk-Off Alert)",
    body: [
      "When the TCTM Risk-Off composite issues a warning, it signals a potential market drawdown or elevated risk environment.",
      "In this case, investors and traders should shift to the short-term Dual Trend system’s exit criteria, enabling timely profit-taking and risk mitigation.",
    ],
  },
];

export const TCTM_GLOSSARY_METRICS: Array<{ term: string; body: string }> = [
  {
    term: "Time Frames",
    body: "Returns are measured over multiple horizons, ranging from 1 to 8 weeks and 1 to 12 months, to gauge how signals unfold in the short and long term.",
  },
  {
    term: "Median",
    body: "The midpoint of all forward returns, showing a typical outcome with less impact from outliers.",
  },
  {
    term: "Mean",
    body: "The simple average of forward returns, which can be skewed by substantial gains or losses.",
  },
  {
    term: "Win Rate",
    body: "The percentage of signals with positive returns over a given time horizon.",
  },
  {
    term: "Study Period Mean",
    body: "The average return across all days in the study period, providing a baseline for comparison with signal returns.",
  },
  {
    term: "Study Period Win Rate",
    body: "The percentage of days with positive returns over the study period, serving as a benchmark against signal win rates.",
  },
  {
    term: "Significance",
    body: "A way to show how far a return deviates from normal, factoring in volatility and sample size. The further away from zero, the more significant.",
  },
  {
    term: "Mean Max Gain",
    body: "The average of the highest gains reached at any point during the time horizon across all trades or signals.",
  },
  {
    term: "Median Max Gain",
    body: "The midpoint of the highest gains reached at any point during the time horizon, where half of the trades or signals exceeded this value and half did not.",
  },
  {
    term: "Mean Max Loss",
    body: "The average of the largest losses experienced by a trading signal at any point during the time horizon across all instances.",
  },
  {
    term: "Median Max Loss",
    body: "The midpoint of the largest losses experienced by a trading signal at any point during the time horizon, where half of the losses were larger and half were smaller.",
  },
  {
    term: "+/−5%",
    body: "The number of times a trading signal’s return increased or decreased by more than 5% over the signal horizon.",
  },
  {
    term: "+/−10%",
    body: "The number of times a trading signal’s return increased or decreased by more than 10% over the signal horizon.",
  },
  {
    term: "Maximum Gain",
    body: "The highest return achieved by a trading signal at any point during the time horizon.",
  },
  {
    term: "Maximum Loss",
    body: "The most significant decline (negative return) experienced by a trading signal at any point during the time horizon.",
  },
];
