-- Tie watchlist rows to Outseta person Uid. Service role (edge function) writes
-- those rows after JWT verification. Existing Supabase-auth rows stay valid.

ALTER TABLE public.watchlist
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS outseta_person_uid text;

ALTER TABLE public.watchlist
  DROP CONSTRAINT IF EXISTS watchlist_has_owner;

ALTER TABLE public.watchlist
  ADD CONSTRAINT watchlist_has_owner
  CHECK (user_id IS NOT NULL OR outseta_person_uid IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_outseta_person_market
  ON public.watchlist (outseta_person_uid, market_id)
  WHERE outseta_person_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watchlist_outseta_person
  ON public.watchlist (outseta_person_uid)
  WHERE outseta_person_uid IS NOT NULL;
