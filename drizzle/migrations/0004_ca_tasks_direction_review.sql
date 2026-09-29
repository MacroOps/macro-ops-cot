ALTER TABLE public.community_alpha_tasks
  ADD COLUMN IF NOT EXISTS review jsonb,
  ADD COLUMN IF NOT EXISTS check_input_tokens integer,
  ADD COLUMN IF NOT EXISTS check_output_tokens integer;