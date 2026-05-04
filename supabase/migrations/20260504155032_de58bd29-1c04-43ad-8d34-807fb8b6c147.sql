
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS yahoo_symbol text,
  ADD COLUMN IF NOT EXISTS news_keywords text;

-- Unique constraints to support upserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cot_reports_market_date_format_key') THEN
    ALTER TABLE public.cot_reports
      ADD CONSTRAINT cot_reports_market_date_format_key UNIQUE (market_id, report_date, format);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_history_market_date_key') THEN
    ALTER TABLE public.price_history
      ADD CONSTRAINT price_history_market_date_key UNIQUE (market_id, observed_on);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positioning_snapshots_report_category_key') THEN
    ALTER TABLE public.positioning_snapshots
      ADD CONSTRAINT positioning_snapshots_report_category_key UNIQUE (report_id, category);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_events_market_url_key') THEN
    ALTER TABLE public.news_events
      ADD CONSTRAINT news_events_market_url_key UNIQUE (market_id, url);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cot_reports_market_date_idx ON public.cot_reports (market_id, report_date DESC);
CREATE INDEX IF NOT EXISTS price_history_market_date_idx ON public.price_history (market_id, observed_on DESC);
CREATE INDEX IF NOT EXISTS positioning_snapshots_report_idx ON public.positioning_snapshots (report_id);
CREATE INDEX IF NOT EXISTS news_events_market_pub_idx ON public.news_events (market_id, published_at DESC);

-- Ingestion log
CREATE TABLE IF NOT EXISTS public.ingestion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  rows_written integer NOT NULL DEFAULT 0,
  message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.ingestion_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can read ingestion_log') THEN
    CREATE POLICY "Public can read ingestion_log" ON public.ingestion_log FOR SELECT USING (true);
  END IF;
END $$;

-- Enable cron + http calls (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
