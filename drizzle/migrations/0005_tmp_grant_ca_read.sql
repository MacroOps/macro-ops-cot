GRANT SELECT ON public.community_alpha_tasks, public.community_alpha_weeks, public.community_alpha_runs, public.community_alpha_state TO sandbox_exec;
CREATE POLICY tmp_sandbox_read_tasks ON public.community_alpha_tasks FOR SELECT TO sandbox_exec USING (true);
CREATE POLICY tmp_sandbox_read_weeks ON public.community_alpha_weeks FOR SELECT TO sandbox_exec USING (true);
CREATE POLICY tmp_sandbox_read_runs ON public.community_alpha_runs FOR SELECT TO sandbox_exec USING (true);
CREATE POLICY tmp_sandbox_read_state ON public.community_alpha_state FOR SELECT TO sandbox_exec USING (true);