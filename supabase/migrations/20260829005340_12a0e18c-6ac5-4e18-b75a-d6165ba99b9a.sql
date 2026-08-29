ALTER TABLE public.backtest_runs
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.backtest_runs
  ADD COLUMN IF NOT EXISTS outseta_person_uid text;

ALTER TABLE public.backtest_runs
  DROP CONSTRAINT IF EXISTS backtest_runs_has_owner;

ALTER TABLE public.backtest_runs
  ADD CONSTRAINT backtest_runs_has_owner
  CHECK (user_id IS NOT NULL OR outseta_person_uid IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_outseta_person_created
  ON public.backtest_runs (outseta_person_uid, created_at DESC)
  WHERE outseta_person_uid IS NOT NULL;