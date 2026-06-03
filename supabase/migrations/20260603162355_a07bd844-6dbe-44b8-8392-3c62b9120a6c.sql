
CREATE TABLE public.daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL UNIQUE,
  markdown text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_briefings TO anon, authenticated;
GRANT ALL ON public.daily_briefings TO service_role;

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily briefings"
  ON public.daily_briefings FOR SELECT
  USING (true);

CREATE TRIGGER update_daily_briefings_updated_at
  BEFORE UPDATE ON public.daily_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX daily_briefings_date_idx ON public.daily_briefings (briefing_date DESC);
