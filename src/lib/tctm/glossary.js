/** Glossary content, from TCTMGuide.xlsx (Turning Point Market Research). */
export const TCTM_GLOSSARY = {
  intro: 'The Tactical Composite Trend Model (TCTM) is a unique, multi-layered system that blends long-term trend-following with market breadth composites to detect critical stock market turning points in advance of significant trend changes.',
  overview: {
    title: 'Component Functionality Explained',
    closing: 'Together, these components form a tactical roadmap for navigating market cycles, with each composite offering a distinct insight into the transition between bearish and bullish regimes.',
    items: [
      { name: 'Long-Term Trend', text: 'Measures the primary trend for the S&P 500 by employing long-term trend and momentum measures.' },
      { name: 'Risk-Off Composite', text: 'Flags deterioration in stock participation, signaling that a broad market countertrend drawdown may be imminent. It captures the narrowing leadership typical of late-stage bull markets.' },
      { name: 'Capitulation Composite', text: 'Identifies extreme selling pressure or oversold conditions consistent with panic selling or market crashes. This model helps detect when the worst of a decline may be occurring.' },
      { name: 'Bottom Composite', text: 'Highlights divergences in downside participation, signaling that fewer and fewer stocks are showing signs of exhaustion in the decline, laying the groundwork for a potential bottom.' },
      { name: 'Thrust Composite', text: 'Captures robust upside participation, also known as a breadth thrust. These signals often mark the end of bear markets and the start of strong bullish trends.' },
      { name: 'Confirmation Composite', text: 'Confirms the durability of a recovery by verifying that long-term measures of market breadth have shifted from bearish to bullish conditions, suggesting the new uptrend will persist.' }
    ]
  },
  trend: { id: 'trend', title: 'Long-Term Trend Model',
    text: 'The TCTM Long-term Trend Model combines the slope of a long-term moving average with multiple price momentum measures spanning 42 to 252 days. Signals shift when both trend-following methods align in the same direction and receive confirmation from an additional price-based measure.' },
  composites: [
    { id: 'riskoff', title: 'Risk-Off Composite',
      intro: 'The Risk-Off Composite flags deterioration in stock market breadth indicators, often a feature of late-stage bull markets, as macroeconomic forces such as elevated interest rates, inflation, and valuations weigh on participation, signaling that a broad market countertrend drawdown may be imminent.',
      construction: 'The composite combines 12 independent inputs to assess broad market participation, with quality reinforced by focusing on stocks and exchange members of the S&P 500, S&P 1500, and NYSE. Each component includes a condition requiring that a signal occur either within a defined percentage of a multi-year high or within a limited number of days from that high, ensuring that any reduction in market exposure is executed relatively close to a market peak. Included in its construction are classic technical indicators such as 52-week lows and the advance-decline line, among others.',
      components: [
        ['S&P 500 New Low Spike', 'An increase in 52-week lows for stocks within the S&P 500'],
        ['NYSE New Low Spike', 'An increase in 52-week lows for NYSE issues'],
        ['S&P 1500 New Low Spike', 'An increase in 52-week lows for stocks within the S&P 1500'],
        ['Financials New Low Spike', 'An increase in 52-week lows for stocks in the S&P 500 Financials'],
        ['Titanic NYSE', 'NYSE 52-week lows exceed highs for five straight sessions near a peak'],
        ['Titanic S&P 1500', 'S&P 1500 52-week lows exceed highs for five straight sessions near a peak'],
        ['AD Divergence NYSE', 'The NYSE advance-decline line falls as the S&P 500 achieves new highs'],
        ['AD Divergence S&P 1500', 'The S&P 1500 advance-decline line falls as the S&P 500 achieves new highs'],
        ['AD Divergence S&P 500', 'The S&P 500 advance-decline line falls as the S&P 500 achieves new highs'],
        ['High-Low Logic with 52WL', 'High proportion of highs and lows or split market, followed by rising lows'],
        ['Financials Relative Strength', 'Financials severely underperform, possibly signaling credit stress'],
        ['Breadth Composite', 'Declining participation among S&P 500 components near index highs']
      ],
      how: 'Using a voting system, the composite tallies the number of components that have generated an alert over a two-month rolling window. A signal is issued when at least five or over 40% of the components trigger a warning and short-term momentum for the S&P 500 turns negative.' },
    { id: 'capitulation', title: 'Capitulation Composite',
      intro: 'The Capitulation Composite identifies extreme selling pressure or oversold conditions consistent with panic selling or market crashes, often pinpointing when market breadth is at its absolute worst. Traders often refer to this point of maximum pain as the internal low.',
      construction: 'The composite combines four independent inputs using several short-, medium-, and long-term market breadth measures and price momentum indicators. For the breadth measures, it utilizes stocks within the S&P 500 and S&P 1500 sub-industry groups, while for the price momentum measures and the Bollinger Band component, it uses the S&P 500 Index.',
      components: [
        ['% Below Lower Bollinger Band', 'Identifies when the S&P 500 falls X% below its lower Bollinger band'],
        ['Breadth Composite', 'Flags when a breadth composite falls below an oversold threshold'],
        ['Breadth and Rate of Change Z-Score', 'Flags when a breadth and momentum composite reaches an oversold status'],
        ['Rolling Rate of Change Z-Score', 'Identifies when several momentum measures exhibit oversold readings']
      ],
      how: 'Using a voting system, the composite tallies the number of components that have generated an alert over a one-month rolling window. A signal is issued when at least three components, or 75% of the components, issue a capitulation event.' },
    { id: 'bottom', title: 'Bottom Composite',
      intro: 'The Bottom Composite identifies oversold conditions and divergences in downside participation, signaling that fewer and fewer stocks are showing signs of exhaustion in the decline, laying the groundwork for a potential bottom.',
      construction: 'The composite integrates ten independent inputs derived from market breadth, index price behavior, and momentum indicators. Breadth components are based on S&P 500 constituents, while price and momentum measures are taken from the S&P 500 Index itself.',
      components: [
        ['Absolute Volatility Spike', 'The 10-day average of absolute daily changes spikes and contracts'],
        ['10-Day Rate of Change Washout', 'The 10-Day rate of change crosses below a user-defined threshold'],
        ['Breadth Washout', 'The 10-day advance-decline ratio falls below a user-defined threshold'],
        ['Volume Washout', 'The 10-day up-down volume ratio falls below a user-defined threshold'],
        ['% of stocks 21-Day Low Divergence', 'The % of stocks registering a 21-day low displays a divergence'],
        ['% of stocks 63-Day Low Divergence', 'The % of stocks registering a 63-day low displays a divergence'],
        ['% of stocks 252-Day Low Divergence', 'The % of stocks registering a 252-day low displays a divergence'],
        ['% of Stocks Oversold Divergence', 'The % of stocks oversold displays a divergence'],
        ['% of Stocks Oversold Extreme', 'The % of stocks oversold exceeds a user-defined threshold'],
        ['Bollinger Band Washout', 'The index remains below the lower Bollinger Band for N days and reverses']
      ],
      how: 'Using a voting system, the composite tallies the number of components that have generated an alert over a two-month rolling window. A signal is generated once five or more components, representing at least 50% of the total, issue alerts while the TCTM Long-Term Trend Model is positive. If the Long-Term Trend Model is negative, a higher confirmation level of 60% is required.' },
    { id: 'thrust', title: 'Thrust Composite',
      intro: 'The Thrust Composite captures robust upside participation, also known as a breadth thrust. These signals often mark the end of drawdown phases and the start of significant advances.',
      construction: 'The composite integrates eleven independent inputs derived from market breadth indicators. Components are based on S&P 500 constituents and NYSE exchange members.',
      components: [
        ['Zweig Thrust', '10-Day Avg of (Adv issues/Adv + Dec Issues) cycles from OS to OB in <= 10 days'],
        ['NYSE A/D Thrust', '10-Day Sum of AD ratio increases above threshold'],
        ['SPX A/D Thrust', '10-Day Sum of AD ratio increases above threshold'],
        ['% 10-Day MA Thrust', '% above 10-day average cycles from oversold to overbought in < N Days'],
        ['% Overbought Thrust', '% of Stocks overbought increases above threshold'],
        ['% 21-Day High Thrust', '% of stocks hitting a 21-day high increases above threshold'],
        ['% 50-Day MA', '% of stocks above the 50-day average increases above threshold'],
        ['10-Day ROC', 'The 10-day rate of change for the S&P 500 increases above threshold'],
        ['Volume Ratio 8to8', 'Up/Down volume ratio exceeds 8/1 in 2 out of 3 sessions'],
        ['Volume Ratio 10to4', 'Up/Down volume ratio exceeds 10/1 and 4/1 in consecutive sessions'],
        ['A/D Ratio, TRIN and SPX Surge', 'A/D ratio, NYSE TRIN, and S&P 500 surge']
      ],
      how: 'Using a voting system, the composite tallies the number of components that have generated an alert over a 50-day rolling window. A signal is generated once five or more components, representing at least 45% of the total, issue alerts. In bear markets, a higher confirmation level of 54% is required.' },
    { id: 'confirmation', title: 'Confirmation Composite',
      intro: 'The Confirmation Composite confirms the durability of a recovery by verifying that long-term measures of market breadth, index price trends and momentum have shifted from bearish to bullish conditions, suggesting the new uptrend will persist.',
      construction: 'The composite integrates ten independent inputs derived from market breadth, index price behavior, trend-following measures, and momentum indicators. Breadth components are based on S&P 500 constituents and sub-industry groups, while price and momentum measures are taken from the S&P 500 Index itself.',
      components: [
        ['% above 200-Day', 'Identifies an oversold to overbought reversal in the % of stocks > 200-day avg'],
        ['# sectors above 200-Day', 'Identifies an oversold to overbought reversal in the # of sectors > 200-day avg'],
        ['% down < than 5% from high', 'Measures an oversold to overbought reversal in stocks near a 52-week high'],
        ['% cyclicals 1-yr return', 'Measures a reversal in the % of cyclical industries with a positive 1-year return'],
        ['% in a bear market', 'Captures a reversal in the % of stocks in a bear market'],
        ['% sub-industries 1-yr return', 'Measures a reversal in the % of cyclical industries with a positive 1-year return'],
        ['SPX N-day low to N-day high', 'Identifies when the S&P 500 reversed from an N-day low to an N-day high'],
        ['Moving average streak', 'Measures when the S&P 500 closed above a moving average for N straight days'],
        ['Moving average deviation', "Identifies when the S&P 500's deviation from trend cycled from OS to OB"],
        ['Trend composite', 'Measures an oversold to overbought reversal in a trend composite']
      ],
      how: 'Using a voting system, the composite tallies the number of components that have generated an alert over a five-month rolling window. A signal is generated once five or more components, representing at least 50% of the total members, issue alerts. These signals, while not as timely as thrust alerts, provide additional evidence of a meaningful trend change.' }
  ],
  credit: '© Turning Point Market Research'
};
