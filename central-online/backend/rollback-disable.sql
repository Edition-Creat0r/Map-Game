-- Emergency stop WITHOUT deleting any balances, receipts, buildings or audit history.
BEGIN;
UPDATE cw041.settings SET enabled=false WHERE world_id='central';
REVOKE EXECUTE ON FUNCTION public.cw041_context(uuid,uuid,jsonb),public.cw041_commit(uuid,uuid,bigint,text,jsonb,boolean,bigint,jsonb,jsonb),public.cw041_region(uuid,text),public.cw041_status(uuid) FROM service_role;
COMMIT;
-- Also set CENTRAL_ECONOMY_ENABLED=false in the Edge Function's server secrets.
-- Capital coordination trigger becomes a no-op while settings.enabled=false.
-- Do not DROP SCHEMA or remove completed-operation receipts: that would lose state
-- or allow replayed operation IDs to charge again. Resumption requires a reviewed
-- re-grant, matching rules, and staging gates; it is not an automatic rollback.
