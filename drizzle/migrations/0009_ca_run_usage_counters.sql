ALTER TABLE public.community_alpha_runs
  ADD COLUMN IF NOT EXISTS extract_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extract_output_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_output_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_calls integer NOT NULL DEFAULT 0;

-- Atomically add one AI call's usage to its run; returns the new credit total.
CREATE OR REPLACE FUNCTION public.ca_add_usage(_run_id uuid, _kind text, _in integer, _out integer, _credits numeric)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.community_alpha_runs SET
    extract_input_tokens = extract_input_tokens + CASE WHEN _kind = 'extract' THEN _in ELSE 0 END,
    extract_output_tokens = extract_output_tokens + CASE WHEN _kind = 'extract' THEN _out ELSE 0 END,
    check_input_tokens = check_input_tokens + CASE WHEN _kind = 'check' THEN _in ELSE 0 END,
    check_output_tokens = check_output_tokens + CASE WHEN _kind = 'check' THEN _out ELSE 0 END,
    ai_credits = ai_credits + _credits,
    ai_calls = ai_calls + 1
  WHERE id = _run_id
  RETURNING ai_credits;
$$;
REVOKE ALL ON FUNCTION public.ca_add_usage(uuid, text, integer, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ca_add_usage(uuid, text, integer, integer, numeric) TO service_role;