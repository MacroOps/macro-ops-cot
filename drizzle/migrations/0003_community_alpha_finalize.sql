ALTER TABLE public.community_alpha_weeks ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'job' CHECK (source IN ('archive','job'));
ALTER TABLE public.community_alpha_weeks_staging ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'job' CHECK (source IN ('archive','job'));
UPDATE public.community_alpha_weeks SET source = 'archive';
ALTER TABLE public.community_alpha_runs
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credits_used numeric,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS dm_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dm_text text;
UPDATE public.community_alpha_runs SET is_manual = true WHERE trigger = 'manual';