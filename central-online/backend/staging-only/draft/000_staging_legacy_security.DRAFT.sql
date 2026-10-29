-- DRAFT / STAGING ONLY. Not in the deployable migrations directory.
-- Requires reviewed real schema/export and explicit operator approval. No baseline.
-- SET LOCAL mapgame.reviewed_staging_project = 'upcrdvdspypoyferpuxe';
-- SET LOCAL mapgame.legacy_schema_reviewed = 'yes';
-- must be in the SAME transaction as this file (the runner supplies that).
-- These acknowledgements are NOT cryptographic proof of a project's identity.
DO $guard$
DECLARE r record; actual regtype; economy_on boolean;
BEGIN
 IF current_setting('mapgame.reviewed_staging_project',true) IS DISTINCT FROM 'upcrdvdspypoyferpuxe'
 OR current_setting('mapgame.legacy_schema_reviewed',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'DRAFT: staging identity and real schema approval required';
 END IF;
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'reviewed postgres owner required'; END IF;
 IF to_regclass('cw041.settings') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM cw041.settings WHERE enabled)' INTO economy_on;
  IF economy_on THEN RAISE EXCEPTION 'disable economy before reviewing staging hardening'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('auth.users')
   AND attname='email_confirmed_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped) THEN
  RAISE EXCEPTION 'verified auth schema contract missing';
 END IF;
 FOR r IN SELECT * FROM (VALUES
  ('worlds','id','text'),('worlds','name','text'),
  ('world_members','world_id','text'),('world_members','user_id','uuid'),
  ('world_members','username','text'),('world_members','last_seen','timestamptz'),
  ('territory_claims','world_id','text'),('territory_claims','territory_id','text'),
  ('territory_claims','owner_id','uuid'),('territory_claims','owner_username','text'),
  ('capitals','world_id','text'),('capitals','owner_id','uuid'),('capitals','territory_id','text'),
  ('capitals','owner_username','text'),('capitals','name','text'),
  ('capitals','x','float8'),('capitals','z','float8'),
  ('world_sessions','world_id','text'),('world_sessions','session_id','uuid'),
  ('world_sessions','user_id','uuid'),('world_sessions','device_id','text'),
  ('world_sessions','username','text'),('world_sessions','created_at','timestamptz'),
  ('world_sessions','last_seen','timestamptz'),('world_sessions','conflicted','boolean')
 ) AS expected(tab,col,typ) LOOP
  SELECT a.atttypid::regtype INTO actual FROM pg_attribute a
   WHERE a.attrelid=to_regclass('public.'||r.tab) AND a.attname=r.col AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM r.typ::regtype THEN RAISE EXCEPTION 'schema contract mismatch: %.%',r.tab,r.col; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN('worlds','world_members','territory_claims','capitals','world_sessions')
    AND (c.relkind<>'r' OR pg_get_userbyid(c.relowner)<>'postgres' OR NOT c.relrowsecurity)) THEN
  RAISE EXCEPTION 'legacy ownership/RLS mismatch';
 END IF;
 IF EXISTS(SELECT 1 FROM public.world_sessions GROUP BY world_id,user_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'review duplicate sessions before migration; no automatic deletion';
 END IF;
 -- Unknown overloads must not remain an unreviewed SECURITY DEFINER bypass.
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN('map_game_start_session','map_game_session_heartbeat','map_game_end_session'))<>4
 OR to_regprocedure('public.map_game_start_session(text,uuid,text)') IS NULL
 OR to_regprocedure('public.map_game_start_session(text,uuid,text,text)') IS NULL
 OR to_regprocedure('public.map_game_session_heartbeat(text,uuid)') IS NULL
 OR to_regprocedure('public.map_game_end_session(text,uuid)') IS NULL THEN
  RAISE EXCEPTION 'review session signatures/overloads before migration';
 END IF;
END $guard$;

CREATE SCHEMA cw041_staging_security;
REVOKE ALL ON SCHEMA cw041_staging_security FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cw041_staging_security REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION cw041_staging_security.actor(p_world text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid := auth.uid();
BEGIN
 IF uid IS NULL OR p_world IS DISTINCT FROM 'central'
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND email_confirmed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.worlds WHERE id=p_world) THEN
  RAISE EXCEPTION 'verified_central_actor_required' USING ERRCODE='42501';
 END IF;
 RETURN uid;
END $$;

-- Do not depend on RLS to prohibit TRUNCATE or on table REVOKE to remove column grants.
DO $$DECLARE t text; c record; p record;
BEGIN
 FOREACH t IN ARRAY ARRAY['worlds','world_members','territory_claims','capitals','world_sessions'] LOOP
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',t);
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',c.attname,t);
   IF t='world_sessions' THEN
    EXECUTE format('REVOKE INSERT (%I),UPDATE (%I) ON public.%I FROM PUBLIC,anon,authenticated',c.attname,c.attname,t);
   END IF;
  END LOOP;
 END LOOP;
 REVOKE ALL ON public.world_sessions FROM PUBLIC,anon,authenticated;
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='world_sessions' LOOP
  EXECUTE format('DROP POLICY %I ON public.world_sessions',p.policyname);
 END LOOP;
END $$;
CREATE POLICY staging_session_self_read ON public.world_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.world_sessions TO authenticated;
CREATE UNIQUE INDEX staging_one_session_per_world_actor ON public.world_sessions(world_id,user_id);

CREATE OR REPLACE FUNCTION public.map_game_start_session(p_world_id text,p_session_id uuid,p_username text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid; holder uuid; stamp timestamptz;
BEGIN
 uid:=cw041_staging_security.actor(p_world_id);
 IF p_session_id IS NULL THEN RAISE EXCEPTION 'session_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cw041:session-id:'||p_session_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('cw041:session-actor:'||uid::text,0));
 SELECT user_id INTO holder FROM public.world_sessions WHERE session_id=p_session_id FOR UPDATE;
 IF FOUND AND holder IS DISTINCT FROM uid THEN RAISE EXCEPTION 'session_owned_by_another_actor' USING ERRCODE='42501'; END IF;
 stamp:=clock_timestamp();
 DELETE FROM public.world_sessions WHERE world_id=p_world_id AND user_id=uid AND session_id<>p_session_id;
 INSERT INTO public.world_sessions(world_id,session_id,user_id,device_id,username,created_at,last_seen,conflicted)
 VALUES(p_world_id,p_session_id,uid,NULL,left(coalesce(p_username,'Player'),80),stamp,stamp,false)
 ON CONFLICT(session_id) DO UPDATE SET world_id=EXCLUDED.world_id,device_id=NULL,
  username=EXCLUDED.username,created_at=EXCLUDED.created_at,last_seen=EXCLUDED.last_seen,conflicted=false
 WHERE public.world_sessions.user_id=uid;
 RETURN true;
END $$;

-- Existing four-argument overload ignores device ID as before; shares all guards.
CREATE OR REPLACE FUNCTION public.map_game_start_session(p_device_id text,p_session_id uuid,p_username text,p_world_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.map_game_start_session(p_world_id,p_session_id,p_username);
$$;

CREATE OR REPLACE FUNCTION public.map_game_session_heartbeat(p_world_id text,p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid; stamp timestamptz; changed bigint;
BEGIN
 uid:=cw041_staging_security.actor(p_world_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('cw041:session-actor:'||uid::text,0));
 stamp:=clock_timestamp();
 UPDATE public.world_sessions SET last_seen=stamp
 WHERE world_id=p_world_id AND session_id=p_session_id AND user_id=uid AND NOT conflicted
  AND last_seen>stamp-interval '90 seconds' AND last_seen<=stamp;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.map_game_end_session(p_world_id text,p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid;
BEGIN
 uid:=cw041_staging_security.actor(p_world_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('cw041:session-actor:'||uid::text,0));
 DELETE FROM public.world_sessions WHERE world_id=p_world_id AND session_id=p_session_id AND user_id=uid;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.map_game_start_session(text,uuid,text),public.map_game_start_session(text,uuid,text,text),
 public.map_game_session_heartbeat(text,uuid),public.map_game_end_session(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.map_game_start_session(text,uuid,text),public.map_game_start_session(text,uuid,text,text),
 public.map_game_session_heartbeat(text,uuid),public.map_game_end_session(text,uuid) TO authenticated;

CREATE FUNCTION cw041_staging_security.active_actor(p_world text,p_member boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid; stamp timestamptz:=clock_timestamp();
BEGIN
 uid:=cw041_staging_security.actor(p_world);
 IF NOT EXISTS(SELECT 1 FROM public.world_sessions WHERE world_id=p_world AND user_id=uid
   AND NOT conflicted AND last_seen>stamp-interval '90 seconds' AND last_seen<=stamp)
 OR (p_member AND NOT EXISTS(SELECT 1 FROM public.world_members WHERE world_id=p_world AND user_id=uid)) THEN
  RAISE EXCEPTION 'active_member_session_required' USING ERRCODE='42501';
 END IF;
 RETURN uid;
END $$;

CREATE FUNCTION cw041_staging_security.guard_legacy_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid; owner uuid; m text[];
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'reviewed_removal_required' USING ERRCODE='42501'; END IF;
 uid:=cw041_staging_security.active_actor(NEW.world_id,TG_TABLE_NAME<>'world_members');
 IF TG_TABLE_NAME='world_members' THEN
  IF NEW.user_id IS DISTINCT FROM uid OR (TG_OP='UPDATE' AND (OLD.user_id,OLD.world_id) IS DISTINCT FROM (NEW.user_id,NEW.world_id)) THEN
   RAISE EXCEPTION 'membership_identity_immutable' USING ERRCODE='42501';
  END IF;
  NEW.last_seen:=clock_timestamp();
  RETURN NEW;
 END IF;
 IF NEW.owner_id IS DISTINCT FROM uid OR (TG_OP='UPDATE' AND (OLD.owner_id,OLD.world_id) IS DISTINCT FROM (NEW.owner_id,NEW.world_id)) THEN
  RAISE EXCEPTION 'ownership_identity_immutable' USING ERRCODE='42501';
 END IF;
 m:=regexp_match(NEW.territory_id,'^T_(0|[1-9][0-9]{0,2})_(0|[1-9][0-9]{0,2})$');
 IF m IS NULL OR m[1]::int>=316 OR m[2]::int>=316 OR (abs(m[1]::int-158)<=1 AND abs(m[2]::int-158)<=1) THEN
  RAISE EXCEPTION 'invalid_or_protected_territory' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='territory_claims' THEN
  IF TG_OP='UPDATE' AND OLD.territory_id IS DISTINCT FROM NEW.territory_id THEN
   RAISE EXCEPTION 'claim_identity_immutable' USING ERRCODE='42501';
  END IF;
 ELSE
  SELECT owner_id INTO owner FROM public.territory_claims WHERE world_id=NEW.world_id AND territory_id=NEW.territory_id FOR SHARE;
  IF NOT FOUND OR owner IS DISTINCT FROM uid THEN RAISE EXCEPTION 'not_territory_owner' USING ERRCODE='42501'; END IF;
  IF NEW.x IS NULL OR NEW.z IS NULL OR NOT(NEW.x BETWEEN 75 AND 32693 AND NEW.z BETWEEN 75 AND 32693) THEN
   RAISE EXCEPTION 'invalid_capital_footprint' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staging_member_identity BEFORE INSERT OR UPDATE OR DELETE ON public.world_members
 FOR EACH ROW EXECUTE FUNCTION cw041_staging_security.guard_legacy_write();
CREATE TRIGGER staging_claim_identity BEFORE INSERT OR UPDATE OR DELETE ON public.territory_claims
 FOR EACH ROW EXECUTE FUNCTION cw041_staging_security.guard_legacy_write();
CREATE TRIGGER staging_capital_identity BEFORE INSERT OR UPDATE OR DELETE ON public.capitals
 FOR EACH ROW EXECUTE FUNCTION cw041_staging_security.guard_legacy_write();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cw041_staging_security FROM PUBLIC,anon,authenticated,service_role;
-- No settings.enabled writes, no economy migration, no production baseline/data.
