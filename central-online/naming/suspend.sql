-- Authorized owner emergency suspension. Retain names, guards, aliases and audit.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.cw041_names_begin(uuid,uuid,jsonb),public.cw041_names_finish(uuid,uuid,text,text,jsonb),public.cw041_names_queue(uuid) FROM service_role;
COMMIT;
-- Set PUBLIC_NAMING_ENABLED=false in Edge secrets.
-- KEEP config.enabled/activation_complete true after activation and KEEP the
-- official client projection enabled. Otherwise legacy writes/presence labels
-- could again become unmoderated. Do not DROP schema/triggers or clear aliases.
-- Existing authentication, approved public reads and ownership still work.
