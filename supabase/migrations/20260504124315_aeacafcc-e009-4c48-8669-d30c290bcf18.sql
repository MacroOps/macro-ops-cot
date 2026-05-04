-- =========================================================
-- Macro HUD: CoT analytics schema
-- =========================================================

-- Sector enum
CREATE TYPE public.market_sector AS ENUM (
  'Equities','Rates','FX','Energy','Metals','Agriculture','Crypto'
);

-- Trader category enum (covers Legacy + Disaggregated)
CREATE TYPE public.trader_category AS ENUM (
  -- Legacy
  'commercial','non_commercial','non_reportable',
  -- Disaggregated
  'producer_merchant','swap_dealer','managed_money','other_reportable',
  -- Financial TFF (often used for rates/FX)
  'dealer_intermediary','asset_manager','leveraged_fund'
);

-- Report flavor
CREATE TYPE public.report_format AS ENUM ('legacy','disaggregated','tff');

-- ---------------------------------------------------------
-- markets: one row per tradable contract we track
-- ---------------------------------------------------------
CREATE TABLE public.markets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          TEXT NOT NULL UNIQUE,             -- e.g. ES, CL, GC
  name            TEXT NOT NULL,                    -- e.g. "S&P 500 E-mini"
  sector          public.market_sector NOT NULL,
  cftc_code       TEXT UNIQUE,                      -- CFTC contract code
  exchange        TEXT,
  contract_size   NUMERIC,                          -- multiplier for $ notional
  price_unit      TEXT,                             -- USD, USc/bu, etc
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_markets_sector ON public.markets(sector);

-- ---------------------------------------------------------
-- cot_reports: weekly CFTC release metadata
-- ---------------------------------------------------------
CREATE TABLE public.cot_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  report_date   DATE NOT NULL,                      -- "as of Tuesday" date
  release_date  DATE,                               -- Friday release
  format        public.report_format NOT NULL,
  open_interest INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, report_date, format)
);

CREATE INDEX idx_cot_reports_market_date ON public.cot_reports(market_id, report_date DESC);

-- ---------------------------------------------------------
-- positioning_snapshots: per-category long/short counts
-- ---------------------------------------------------------
CREATE TABLE public.positioning_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES public.cot_reports(id) ON DELETE CASCADE,
  category     public.trader_category NOT NULL,
  long_contracts   INTEGER NOT NULL DEFAULT 0,
  short_contracts  INTEGER NOT NULL DEFAULT 0,
  spread_contracts INTEGER NOT NULL DEFAULT 0,
  net_contracts    INTEGER GENERATED ALWAYS AS (long_contracts - short_contracts) STORED,
  pct_of_oi        NUMERIC(6,3),
  UNIQUE (report_id, category)
);

CREATE INDEX idx_pos_snapshots_report ON public.positioning_snapshots(report_id);
CREATE INDEX idx_pos_snapshots_category ON public.positioning_snapshots(category);

-- ---------------------------------------------------------
-- price_history: weekly close + week change for the chart overlay
-- ---------------------------------------------------------
CREATE TABLE public.price_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id   UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,
  close       NUMERIC NOT NULL,
  UNIQUE (market_id, observed_on)
);

CREATE INDEX idx_price_history_market ON public.price_history(market_id, observed_on DESC);

-- ---------------------------------------------------------
-- news_events: macro headlines + divergence flag
-- ---------------------------------------------------------
CREATE TABLE public.news_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id       UUID REFERENCES public.markets(id) ON DELETE SET NULL,
  headline        TEXT NOT NULL,
  source          TEXT,
  url             TEXT,
  published_at    TIMESTAMPTZ NOT NULL,
  expected_direction SMALLINT,        -- -1 bearish, 0 neutral, 1 bullish
  observed_return_1d NUMERIC,
  is_divergence   BOOLEAN NOT NULL DEFAULT FALSE,
  divergence_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_market_published ON public.news_events(market_id, published_at DESC);

-- ---------------------------------------------------------
-- updated_at trigger function
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_markets_updated_at
BEFORE UPDATE ON public.markets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Row Level Security
-- CFTC + price + news data are public reference data → public read.
-- Writes are restricted (no public policy = denied to anon/authenticated).
-- Backend ingestion will use the service role which bypasses RLS.
-- =========================================================
ALTER TABLE public.markets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cot_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positioning_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_events           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read markets"
  ON public.markets FOR SELECT USING (true);

CREATE POLICY "Public can read cot_reports"
  ON public.cot_reports FOR SELECT USING (true);

CREATE POLICY "Public can read positioning_snapshots"
  ON public.positioning_snapshots FOR SELECT USING (true);

CREATE POLICY "Public can read price_history"
  ON public.price_history FOR SELECT USING (true);

CREATE POLICY "Public can read news_events"
  ON public.news_events FOR SELECT USING (true);
