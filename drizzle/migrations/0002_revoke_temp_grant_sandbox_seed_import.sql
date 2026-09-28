-- Restore service-role-only access after the archive import.
REVOKE INSERT, UPDATE ON public.community_alpha_weeks FROM sandbox_exec;
REVOKE UPDATE ON public.community_alpha_state FROM sandbox_exec;