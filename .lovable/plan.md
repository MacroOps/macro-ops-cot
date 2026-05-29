# Eurex Futures Ingestion

## Important caveat (read first)

Unlike the CFTC, **Eurex does not publish a weekly CoT-style breakdown of trader positioning by category** (no "non-commercial vs commercial vs managed money" split). What Eurex *does* publish publicly:

- **Daily open interest** per contract / expiry
- **Daily traded volume** per contract / expiry
- **Block trade and EFP volumes**
- Aggregated stats via the Eurex T7 public files / `eurex.com/ex-en/data/statistics`

So we cannot replicate the existing CoT category structure for Eurex. Two realistic paths:

- **A. Ingest what Eurex actually publishes** — OI, volume, term structure, OI delta — and add a new "Eurex positioning" surface (different shape from CoT).
- **B. Approximate trader positioning** using related instruments (e.g. FESX → SPY/FEZ ETF flows, options put/call & skew). Less precise, but slots into the existing CoT-style UI.

This plan implements **A** as the foundation and leaves a clear hook for B later.

## Liquid Eurex futures to add

| Symbol | Name | Sector |
|---|---|---|
| FESX | Euro Stoxx 50 | Equity Index |
| FDAX | DAX | Equity Index |
| FDXM | Mini-DAX | Equity Index |
| FSMI | SMI (Swiss) | Equity Index |
| FSTX | Stoxx Europe 600 | Equity Index |
| FESB | Euro Stoxx Banks | Equity Index |
| FXXP | Stoxx Europe 600 sector futures (group) | Equity Index |
| FGBL | Euro-Bund (10y Bund) | Rates |
| FGBM | Euro-Bobl (5y) | Rates |
| FGBS | Euro-Schatz (2y) | Rates |
| FGBX | Euro-Buxl (30y) | Rates |
| FOAT | French OAT (10y) | Rates |
| FBTP | Italian BTP (10y) | Rates |
| FBTS | Short-term BTP | Rates |
| CONF | Swiss Conf bond | Rates |

(Final list can be trimmed during implementation.)

## Changes

### 1. Schema (single migration)

- Add `eurex` to the existing `markets.sector` enum where needed (Equity Index already exists; confirm).
- New table `eurex_oi_history` with daily OI/volume per market:
  - `market_id`, `observed_on`, `open_interest`, `volume`, `oi_change`, `block_volume`
  - PK `(market_id, observed_on)`
  - RLS: public read; service_role full.
- New enum value `eurex` added to the existing `cot_reports.format` enum so we can reuse `cot_reports` + `positioning_snapshots` for any future Eurex client-type data without re-architecting. (Cells will simply be empty for now.)
- Add ~15 rows to `markets` for the contracts above (with `exchange='Eurex'`, `cftc_code=NULL`, `yahoo_symbol` where Yahoo carries it, e.g. `FESX=F`, `^GDAXI`, `^STOXX50E` as fallbacks for price).

### 2. Edge function `ingest-eurex`

- Pulls daily OI + volume from a public Eurex source. Two candidates, picked in this order at runtime:
  1. `https://www.eurex.com/api/v1/instruments/{productId}/openInterest` style JSON (T7 public web feed).
  2. CSV download fallback from `eurex.com/ex-en/data/statistics`.
- Aggregates across expiries to produce a single contract-level row per day; also stores front-month separately.
- Upserts into `eurex_oi_history`.
- Writes an `ingestion_log` row (`source: 'eurex'`).
- Same shape as `ingest-cftc`: accepts `{ symbol?, since?, until? }`.

### 3. Price ingestion

- Reuse existing `ingest-prices` — it already takes Yahoo symbols. Where Yahoo lacks a clean futures continuous (e.g. FGBL), fall back to an index proxy or Stooq.

### 4. Frontend surface (minimal in this plan)

- One new HUD page `src/pages/EurexPositioning.tsx` listing the Eurex contracts with: price, daily OI, weekly OI %ile (52w), OI delta, volume, term-structure note.
- Sidebar group "Eurex" with the contract list.
- Reuses `IndicatorCard`, `PercentileGauge`, `SignalBadge`.
- Asset detail page already keys off `markets.symbol` — Eurex contracts that lack CoT will simply hide the CoT panels; we add a small "Eurex OI / Volume" panel driven by `eurex_oi_history`.

### 5. Scheduling

- No cron added in this plan. Function is callable on-demand the same way `ingest-cftc` is today. Cron can be wired in a follow-up.

## What this plan does NOT include

- A true trader-type breakdown for Eurex (it doesn't exist publicly).
- Options skew / ETF-flow proxies (option B). Easy to add later — the new sidebar group is the right home.
- Historical OI backfill beyond what the Eurex public endpoint exposes (typically rolling ~2 years).

## Open questions

1. Trim the contract list, or ingest all 15?
2. For symbols where Yahoo has no continuous future (most Eurex rates), is it OK to use an **index proxy** for price (e.g. DE 10y yield series for FGBL) so the UI still has a chart?
3. Do you want a cron schedule wired now (daily 18:30 CET after Eurex close), or leave manual until the feed is proven?