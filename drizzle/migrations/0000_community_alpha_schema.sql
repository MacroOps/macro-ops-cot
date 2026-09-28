CREATE TABLE public.community_alpha_weeks (
  week_date date PRIMARY KEY,
  anchor_at timestamptz NOT NULL,
  run_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  channels_scanned int NOT NULL DEFAULT 8,
  ideas_count int NOT NULL DEFAULT 0,
  team_excluded_count int NOT NULL DEFAULT 0,
  tactical_excluded_count int NOT NULL DEFAULT 0,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.community_alpha_weeks_staging (LIKE public.community_alpha_weeks INCLUDING ALL);

CREATE TABLE public.community_alpha_state (
  id int PRIMARY KEY,
  last_anchor_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.community_alpha_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('live','staging')),
  trigger text NOT NULL CHECK (trigger IN ('scheduled','manual')),
  anchors date[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','finalizing','done','failed')),
  summary text,
  warnings jsonb DEFAULT '[]'::jsonb,
  token_usage jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE public.community_alpha_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.community_alpha_runs(id) ON DELETE CASCADE,
  anchor_date date NOT NULL,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  tighter_filter boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  error text,
  messages_fetched int DEFAULT 0,
  team_excluded int DEFAULT 0,
  tactical_author_excluded int DEFAULT 0,
  tactical_dropped int DEFAULT 0,
  ideas jsonb DEFAULT '[]'::jsonb,
  rejected jsonb DEFAULT '[]'::jsonb,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (run_id, anchor_date, channel_id)
);
CREATE INDEX community_alpha_tasks_claim_idx ON public.community_alpha_tasks (status, started_at);

GRANT ALL ON public.community_alpha_weeks, public.community_alpha_weeks_staging, public.community_alpha_state, public.community_alpha_runs, public.community_alpha_tasks TO service_role;
REVOKE ALL ON public.community_alpha_weeks, public.community_alpha_weeks_staging, public.community_alpha_state, public.community_alpha_runs, public.community_alpha_tasks FROM anon, authenticated;

ALTER TABLE public.community_alpha_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_alpha_weeks_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_alpha_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_alpha_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_alpha_tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_ca_weeks_updated BEFORE UPDATE ON public.community_alpha_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ca_weeks_staging_updated BEFORE UPDATE ON public.community_alpha_weeks_staging FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ca_state_updated BEFORE UPDATE ON public.community_alpha_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ca_claim_task()
RETURNS SETOF public.community_alpha_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.community_alpha_tasks t
  SET status = 'running', started_at = now(), attempts = t.attempts + 1
  WHERE t.id = (
    SELECT id FROM public.community_alpha_tasks
    WHERE status = 'pending'
       OR (status = 'running' AND started_at < now() - interval '10 minutes')
    ORDER BY started_at NULLS FIRST, id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING t.*;
END;
$$;
REVOKE ALL ON FUNCTION public.ca_claim_task() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ca_claim_task() TO service_role;

INSERT INTO public.community_alpha_state (id, last_anchor_at) VALUES (2, '2026-09-18T14:00:00-07:00');