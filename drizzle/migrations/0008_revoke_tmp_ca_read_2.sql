DROP POLICY IF EXISTS tmp_sandbox_read_tasks ON public.community_alpha_tasks;
DROP POLICY IF EXISTS tmp_sandbox_read_weeks ON public.community_alpha_weeks;
REVOKE SELECT ON public.community_alpha_tasks, public.community_alpha_weeks FROM sandbox_exec;