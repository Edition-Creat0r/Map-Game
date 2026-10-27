-- Require every known public-name column; never silently skip a missing adapter.
BEGIN;
DO $$DECLARE expected text;BEGIN
 FOREACH expected IN ARRAY ARRAY['auth.users.raw_user_meta_data','public.world_members.username','public.territory_claims.owner_username','public.capitals.owner_username','public.capitals.name'] LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=split_part(expected,'.',1) AND table_name=split_part(expected,'.',2) AND column_name=split_part(expected,'.',3)) THEN RAISE EXCEPTION 'Missing public-name adapter column: %',expected;END IF;
 END LOOP;
END$$;
CREATE FUNCTION cw041_names.metadata_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE approved text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled) THEN RETURN NEW;END IF;
 approved:=cw041_names.display('username',NEW.id::text);
 IF TG_OP='INSERT' THEN NEW.raw_user_meta_data:=jsonb_set(coalesce(NEW.raw_user_meta_data,'{}'),'{username}',to_jsonb(approved));
 ELSIF NEW.raw_user_meta_data->'username' IS DISTINCT FROM OLD.raw_user_meta_data->'username' AND NEW.raw_user_meta_data->>'username' IS DISTINCT FROM approved THEN RAISE EXCEPTION 'public_name_endpoint_required' USING ERRCODE='42501';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER cw041_names_metadata BEFORE INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION cw041_names.metadata_guard();
CREATE FUNCTION cw041_names.mirror_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE data jsonb;approved text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled) THEN RETURN NEW;END IF;
 data:=to_jsonb(NEW);approved:=cw041_names.display('username',data->>TG_ARGV[0]);
 NEW:=jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[1],approved));RETURN NEW;
END$$;
CREATE TRIGGER cw041_names_member BEFORE INSERT OR UPDATE ON public.world_members FOR EACH ROW EXECUTE FUNCTION cw041_names.mirror_guard('user_id','username');
CREATE TRIGGER cw041_names_claim BEFORE INSERT OR UPDATE ON public.territory_claims FOR EACH ROW EXECUTE FUNCTION cw041_names.mirror_guard('owner_id','owner_username');
CREATE TRIGGER cw041_names_capital_owner BEFORE INSERT OR UPDATE ON public.capitals FOR EACH ROW EXECUTE FUNCTION cw041_names.mirror_guard('owner_id','owner_username');
CREATE FUNCTION cw041_names.city_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled) THEN NEW.name:=CASE WHEN NEW.world_id::text='central' THEN cw041_names.display('city',NEW.owner_id::text) ELSE 'Unnamed city' END;END IF;RETURN NEW;
END$$;
CREATE TRIGGER cw041_names_city BEFORE INSERT OR UPDATE ON public.capitals FOR EACH ROW EXECUTE FUNCTION cw041_names.city_guard();
-- Whole-world building projection consumes canonical labels, not arbitrary JSON names.
CREATE OR REPLACE FUNCTION public.cw041_region(p_actor uuid,p_territory text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041 AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041.settings WHERE world_id='central' AND enabled) THEN RAISE EXCEPTION 'economy_disabled' USING ERRCODE='55000';END IF;
 PERFORM cw041.assert_actor(p_actor);PERFORM cw041.assert_coordination();PERFORM cw041.assert_account_land(p_actor);PERFORM cw041.apply_rate_limit(p_actor);
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',building_id,'ownerId',actor,'type',row_data->>'type','territoryId',territory_id,'x',x,'z',z,'rotation',row_data->'rotation','footprint',row_data->'footprint','name',CASE WHEN (SELECT enabled FROM cw041_names.config) THEN cw041_names.display('building',actor::text||':'||building_id::text) ELSE NULL END)),'[]') FROM cw041.buildings WHERE territory_id=p_territory);
END$$;
-- Explicit owner-only activation quarantines existing labels before they can be read.
CREATE FUNCTION cw041_names.activate(p_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'approved_policy_hash_required';END IF;
 IF EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled OR activation_complete) THEN RAISE EXCEPTION 'already_activated_use_reviewed_policy_rotation';END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname IN('cw041_names_metadata','cw041_names_member','cw041_names_claim','cw041_names_capital_owner','cw041_names_city') AND tgenabled='O')<>5 THEN RAISE EXCEPTION 'legacy_guards_required';END IF;
 INSERT INTO cw041_names.legacy_review(source,owner_id,old_display) SELECT 'auth.users.username',id,raw_user_meta_data->>'username' FROM auth.users WHERE nullif(raw_user_meta_data->>'username','') IS NOT NULL;
 INSERT INTO cw041_names.legacy_review(source,owner_id,old_display) SELECT 'world_members.username',user_id,username FROM public.world_members WHERE nullif(username,'') IS NOT NULL;
 INSERT INTO cw041_names.legacy_review(source,owner_id,old_display) SELECT 'territory_claims.owner_username',owner_id,owner_username FROM public.territory_claims WHERE nullif(owner_username,'') IS NOT NULL;
 INSERT INTO cw041_names.legacy_review(source,owner_id,old_display) SELECT 'capitals.name:'||world_id::text,owner_id,name FROM public.capitals WHERE nullif(name,'') IS NOT NULL;
 UPDATE cw041_names.config SET policy_hash=p_hash,activation_complete=true,enabled=true;
 UPDATE auth.users SET raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'),'{username}',to_jsonb(cw041_names.display('username',id::text)));
 UPDATE public.world_members SET username=cw041_names.display('username',user_id::text);
 UPDATE public.territory_claims SET owner_username=cw041_names.display('username',owner_id::text);
 UPDATE public.capitals SET owner_username=cw041_names.display('username',owner_id::text),name=CASE WHEN world_id::text='central' THEN cw041_names.display('city',owner_id::text) ELSE 'Unnamed city' END;
END$$;
-- After activation, emergency suspension must keep canonicalization guards active.
CREATE FUNCTION cw041_names.config_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF OLD.activation_complete AND (NOT NEW.enabled OR NOT NEW.activation_complete) THEN RAISE EXCEPTION 'suspend_api_not_public_name_guards' USING ERRCODE='42501';END IF;RETURN NEW;
END$$;
CREATE TRIGGER cw041_names_sticky_guard BEFORE UPDATE ON cw041_names.config FOR EACH ROW EXECUTE FUNCTION cw041_names.config_guard();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cw041_names FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.cw041_region(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cw041_region(uuid,text) TO service_role;
COMMIT;
