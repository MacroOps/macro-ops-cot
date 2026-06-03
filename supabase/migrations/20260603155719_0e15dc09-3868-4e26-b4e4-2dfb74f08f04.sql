CREATE TABLE public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'lab',
  indicator_key text NOT NULL,
  symbol text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_runs TO authenticated;
GRANT ALL ON public.backtest_runs TO service_role;

ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own backtest runs"
  ON public.backtest_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own backtest runs"
  ON public.backtest_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own backtest runs"
  ON public.backtest_runs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own backtest runs"
  ON public.backtest_runs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX backtest_runs_user_created_idx
  ON public.backtest_runs (user_id, created_at DESC);

CREATE TRIGGER update_backtest_runs_updated_at
  BEFORE UPDATE ON public.backtest_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();