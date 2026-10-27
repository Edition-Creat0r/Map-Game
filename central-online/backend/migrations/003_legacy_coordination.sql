-- REVIEW legacy schema/policies BEFORE deployment. Adds coordination, not permissions.
BEGIN;
CREATE FUNCTION cw041.guard_capital() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE targets text[]:='{}'; tx text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041.settings WHERE enabled) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP<>'INSERT' AND OLD.world_id::text='central' THEN targets:=array_append(targets,OLD.territory_id::text); END IF;
 IF TG_OP<>'DELETE' AND NEW.world_id::text='central' THEN
  PERFORM cw041.assert_owner(NEW.owner_id,NEW.territory_id::text);
  targets:=array_append(targets,NEW.territory_id::text);
 END IF;
 FOR tx IN SELECT DISTINCT unnest(targets) ORDER BY 1 LOOP PERFORM pg_advisory_xact_lock(hashtextextended('cw041:central:'||tx,0)); END LOOP;
 IF TG_OP<>'DELETE' AND NEW.world_id::text='central' THEN
  IF NEW.x IS NULL OR NEW.z IS NULL OR NOT (NEW.x BETWEEN 75 AND 32693 AND NEW.z BETWEEN 75 AND 32693) THEN RAISE EXCEPTION 'invalid_capital_footprint'; END IF;
  IF EXISTS(SELECT 1 FROM cw041.buildings b WHERE territory_id=NEW.territory_id::text AND abs(b.x-NEW.x)*2 < b.width+154 AND abs(b.z-NEW.z)*2 < b.depth+154) THEN RAISE EXCEPTION 'capital_overlaps_factory' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END$$;
REVOKE ALL ON FUNCTION cw041.guard_capital() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER cw041_capital_guard BEFORE INSERT OR UPDATE OR DELETE ON public.capitals FOR EACH ROW EXECUTE FUNCTION cw041.guard_capital();
CREATE FUNCTION cw041.assert_coordination() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.capitals'::regclass AND tgname='cw041_capital_guard' AND tgenabled='O' AND tgfoid='cw041.guard_capital()'::regprocedure) THEN RAISE EXCEPTION 'legacy_coordination_required' USING ERRCODE='55000'; END IF;
END$$;
REVOKE ALL ON FUNCTION cw041.assert_coordination() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
