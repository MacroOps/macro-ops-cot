-- Temporary: allow sandbox_exec to run the Community Alpha archive import; revoked in the next migration.
GRANT INSERT, UPDATE ON public.community_alpha_weeks TO sandbox_exec;
GRANT UPDATE ON public.community_alpha_state TO sandbox_exec;