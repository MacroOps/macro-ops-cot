DROP POLICY IF EXISTS tmp_sandbox_read_tasks ON public.community_alpha_tasks;
DROP POLICY IF EXISTS tmp_sandbox_read_weeks ON public.community_alpha_weeks;
DROP POLICY IF EXISTS tmp_sandbox_read_runs ON public.community_alpha_runs;
DROP POLICY IF EXISTS tmp_sandbox_read_state ON public.community_alpha_state;
REVOKE SELECT ON public.community_alpha_tasks, public.community_alpha_weeks, public.community_alpha_runs, public.community_alpha_state FROM sandbox_exec;