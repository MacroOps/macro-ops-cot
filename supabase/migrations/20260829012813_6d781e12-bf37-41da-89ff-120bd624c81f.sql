-- Tie alerts and alert_events to Outseta person Uid. Service role (edge
-- function / cron) writes those rows after JWT verification or scheduled eval.

ALTER TABLE public.alerts
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS outseta_person_uid text;

ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_has_owner;

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_has_owner
  CHECK (user_id IS NOT NULL OR outseta_person_uid IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_alerts_outseta_person
  ON public.alerts (outseta_person_uid)
  WHERE outseta_person_uid IS NOT NULL;

ALTER TABLE public.alert_events
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.alert_events
  ADD COLUMN IF NOT EXISTS outseta_person_uid text;

ALTER TABLE public.alert_events
  DROP CONSTRAINT IF EXISTS alert_events_has_owner;

ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_has_owner
  CHECK (user_id IS NOT NULL OR outseta_person_uid IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_alert_events_outseta_person_fired
  ON public.alert_events (outseta_person_uid, fired_at DESC)
  WHERE outseta_person_uid IS NOT NULL;