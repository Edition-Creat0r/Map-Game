-- Checkpoint 2. Apply after 001–003 in authorized staging only; disabled by default.
BEGIN;
CREATE SCHEMA cw041_names;
REVOKE ALL ON SCHEMA cw041_names FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE cw041_names.config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 activation_complete boolean NOT NULL DEFAULT false, policy_hash text,
 attempt_limit integer NOT NULL DEFAULT 10 CHECK(attempt_limit BETWEEN 1 AND 100),
 window_seconds integer NOT NULL DEFAULT 600 CHECK(window_seconds BETWEEN 60 AND 3600),
 CHECK(NOT enabled OR (activation_complete AND policy_hash IS NOT NULL))
);
INSERT INTO cw041_names.config(singleton) VALUES(true);
CREATE TABLE cw041_names.actors(actor uuid PRIMARY KEY REFERENCES auth.users(id),window_start timestamptz NOT NULL DEFAULT clock_timestamp(),attempts integer NOT NULL DEFAULT 0);
CREATE TABLE cw041_names.moderators(actor uuid PRIMARY KEY REFERENCES auth.users(id),can_review boolean NOT NULL DEFAULT false,can_hide boolean NOT NULL DEFAULT false,can_rename boolean NOT NULL DEFAULT false);
CREATE TABLE cw041_names.bindings(kind text NOT NULL CHECK(kind IN('kingdom','alliance')),entity text NOT NULL,owner_id uuid NOT NULL REFERENCES auth.users(id),source_reference text NOT NULL CHECK(length(source_reference)>0),PRIMARY KEY(kind,entity));
CREATE TABLE cw041_names.names (
 kind text NOT NULL CHECK(kind IN('username','kingdom','city','alliance','building')),entity text NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id),display text NOT NULL CHECK(length(display)>=(CASE WHEN kind='username' THEN 3 ELSE 2 END) AND length(display)<=(CASE WHEN kind='username' THEN 24 ELSE 48 END)),
 canonical_key text NOT NULL,skeleton text NOT NULL,visibility text NOT NULL DEFAULT 'visible' CHECK(visibility IN('visible','hidden')),
 revision bigint NOT NULL DEFAULT 1,changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),policy_hash text NOT NULL,PRIMARY KEY(kind,entity)
);
CREATE TABLE cw041_names.username_keys(key_hash text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES auth.users(id));
CREATE TABLE cw041_names.username_skeletons(key_hash text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES auth.users(id));
CREATE TABLE cw041_names.attempts (
 actor uuid NOT NULL REFERENCES auth.users(id),operation_id uuid NOT NULL,intent jsonb NOT NULL,intent_fingerprint text NOT NULL,
 receipt jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor,operation_id)
);
CREATE TABLE cw041_names.reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid NOT NULL REFERENCES auth.users(id),kind text NOT NULL,entity text NOT NULL,
 candidate jsonb NOT NULL,base_revision bigint NOT NULL,policy_hash text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','superseded')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cw041_names.reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter uuid NOT NULL REFERENCES auth.users(id),kind text NOT NULL,entity text NOT NULL,
 revision bigint NOT NULL,reason text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','resolved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(reporter,kind,entity,revision)
);
CREATE TABLE cw041_names.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid NOT NULL REFERENCES auth.users(id),kind text,entity text,action text NOT NULL,
 before_display text,after_display text,reason text,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cw041_names.legacy_review(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,source text NOT NULL,owner_id uuid,old_display text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$DECLARE t text;BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='cw041_names' LOOP
 EXECUTE format('ALTER TABLE cw041_names.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE cw041_names.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY backend_owner ON cw041_names.%I TO postgres USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON cw041_names.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END$$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cw041_names FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cw041_names REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE FUNCTION cw041_names.digest(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$SELECT encode(sha256(convert_to(v,'UTF8')),'hex')$$;
CREATE FUNCTION cw041_names.verify(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'verified_account_required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled AND activation_complete AND policy_hash IS NOT NULL) THEN RAISE EXCEPTION 'naming_disabled' USING ERRCODE='55000';END IF;
END$$;
CREATE FUNCTION cw041_names.rate(p_actor uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE c cw041_names.config;a cw041_names.actors;BEGIN
 SELECT * INTO STRICT c FROM cw041_names.config; INSERT INTO cw041_names.actors(actor) VALUES(p_actor) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT a FROM cw041_names.actors WHERE actor=p_actor FOR UPDATE;
 IF a.window_start+make_interval(secs=>c.window_seconds)<=clock_timestamp() THEN a.window_start:=clock_timestamp();a.attempts:=0;END IF;
 UPDATE cw041_names.actors SET window_start=a.window_start,attempts=least(a.attempts+1,c.attempt_limit+1) WHERE actor=p_actor;
 RETURN a.attempts<c.attempt_limit;
END$$;
CREATE FUNCTION cw041_names.owner(p_kind text,p_entity text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE result uuid;b cw041.buildings;BEGIN
 IF p_kind IN('username','city') AND p_entity IS DISTINCT FROM (p_entity::uuid)::text THEN RAISE EXCEPTION 'invalid_entity' USING ERRCODE='22023';END IF;
 IF p_kind='username' THEN SELECT id INTO STRICT result FROM auth.users WHERE id=p_entity::uuid;
 ELSIF p_kind='city' THEN
  PERFORM cw041.assert_actor(p_entity::uuid);
  SELECT owner_id INTO STRICT result FROM public.capitals WHERE world_id::text='central' AND owner_id::text=p_entity FOR SHARE;
 ELSIF p_kind='building' THEN
  SELECT * INTO STRICT b FROM cw041.buildings WHERE actor=split_part(p_entity,':',1)::uuid AND building_id=split_part(p_entity,':',2)::uuid FOR SHARE;
  IF p_entity IS DISTINCT FROM b.actor::text||':'||b.building_id::text THEN RAISE EXCEPTION 'invalid_entity' USING ERRCODE='22023';END IF;
  PERFORM cw041.assert_owner(b.actor,b.territory_id);result:=b.actor;
 ELSIF p_kind IN('kingdom','alliance') THEN SELECT owner_id INTO STRICT result FROM cw041_names.bindings WHERE kind=p_kind AND entity=p_entity FOR SHARE;
 ELSE RAISE EXCEPTION 'unsupported_name_kind' USING ERRCODE='22023';END IF;
 RETURN result;
 EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'unavailable_entity' USING ERRCODE='42501';
END$$;
CREATE FUNCTION cw041_names.display(p_kind text,p_entity text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$
 SELECT coalesce((SELECT display FROM cw041_names.names WHERE kind=p_kind AND entity=p_entity AND visibility='visible'),CASE p_kind WHEN 'username' THEN 'Player' WHEN 'city' THEN 'Unnamed city' WHEN 'kingdom' THEN 'Unnamed kingdom' WHEN 'alliance' THEN 'Unnamed alliance' ELSE 'Building' END)
$$;
CREATE FUNCTION cw041_names.require_mod(p_actor uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041_names.moderators WHERE actor=p_actor AND CASE WHEN p_action='hide' THEN can_hide WHEN p_action='force_rename' THEN can_rename ELSE can_review END) THEN RAISE EXCEPTION 'moderator_required' USING ERRCODE='42501';END IF;
END$$;
CREATE FUNCTION public.cw041_names_begin(p_actor uuid,p_operation uuid,p_intent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE a cw041_names.attempts;rev cw041_names.reviews;own uuid;act text;BEGIN
 PERFORM cw041_names.verify(p_actor);
 IF jsonb_typeof(p_intent) IS DISTINCT FROM 'object' OR octet_length(p_intent::text)>4096 THEN RAISE EXCEPTION 'invalid_intent' USING ERRCODE='22023';END IF;
 act:=p_intent->>'action';
 SELECT * INTO a FROM cw041_names.attempts WHERE actor=p_actor AND operation_id=p_operation;
 IF FOUND THEN
  IF a.intent_fingerprint<>cw041_names.digest(p_intent::text) THEN RAISE EXCEPTION 'operation_mismatch' USING ERRCODE='22023';END IF;
  IF a.receipt->>'status'='202' THEN
   SELECT * INTO rev FROM cw041_names.reviews WHERE id=(a.receipt->>'reviewId')::uuid;
   IF NOT FOUND OR rev.status<>'pending' THEN
    a.receipt:=CASE WHEN rev.status='approved' THEN '{"status":200,"code":"review_approved"}'::jsonb WHEN rev.status='rejected' THEN '{"status":409,"code":"name_unavailable"}'::jsonb WHEN rev.status='superseded' THEN '{"status":409,"code":"review_stale"}'::jsonb ELSE '{"status":409,"code":"review_expired"}'::jsonb END;
    UPDATE cw041_names.attempts SET receipt=a.receipt WHERE actor=p_actor AND operation_id=p_operation;
   END IF;
  END IF;
  IF a.receipt IS NOT NULL THEN RETURN jsonb_build_object('receipt',a.receipt);END IF;
 END IF;
 IF NOT cw041_names.rate(p_actor) THEN RETURN '{"receipt":{"status":429,"code":"name_attempt_limit"}}';END IF;
 IF act='rename' THEN own:=cw041_names.owner(p_intent->>'kind',p_intent->>'entity');IF own<>p_actor THEN RAISE EXCEPTION 'not_name_owner' USING ERRCODE='42501';END IF;
 ELSIF act IN('hide','force_rename') THEN PERFORM cw041_names.require_mod(p_actor,act);PERFORM cw041_names.owner(p_intent->>'kind',p_intent->>'entity');IF coalesce((SELECT revision FROM cw041_names.names WHERE kind=p_intent->>'kind' AND entity=p_intent->>'entity'),0) IS DISTINCT FROM (p_intent->>'revision')::bigint OR (act='hide' AND NOT EXISTS(SELECT 1 FROM cw041_names.names WHERE kind=p_intent->>'kind' AND entity=p_intent->>'entity')) THEN RAISE EXCEPTION 'name_revision_changed' USING ERRCODE='22023';END IF;
 ELSIF act='report' THEN PERFORM 1 FROM cw041_names.names WHERE kind=p_intent->>'kind' AND entity=p_intent->>'entity';IF NOT FOUND THEN RAISE EXCEPTION 'unavailable_name' USING ERRCODE='22023';END IF;
 ELSIF act='review' THEN PERFORM cw041_names.require_mod(p_actor,'review');SELECT * INTO STRICT rev FROM cw041_names.reviews WHERE id=(p_intent->>'reviewId')::uuid;
 ELSIF act='resolve_report' THEN PERFORM cw041_names.require_mod(p_actor,'review');
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';END IF;
 INSERT INTO cw041_names.attempts(actor,operation_id,intent,intent_fingerprint) VALUES(p_actor,p_operation,p_intent,cw041_names.digest(p_intent::text)) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('policyHash',(SELECT policy_hash FROM cw041_names.config),'review',to_jsonb(rev));
END$$;
CREATE FUNCTION cw041_names.publish(p_actor uuid,p_kind text,p_entity text,p_owner uuid,p_value jsonb,p_override boolean,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE old cw041_names.names;now_at timestamptz:=clock_timestamp();keyhash text;skhash text;revision bigint;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:owner:'||p_owner::text,0));
 IF cw041_names.owner(p_kind,p_entity)<>p_owner THEN RAISE EXCEPTION 'name_owner_changed' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR p_value->>'display' IS NULL OR length(p_value->>'display')<(CASE WHEN p_kind='username' THEN 3 ELSE 2 END) OR length(p_value->>'display')>(CASE WHEN p_kind='username' THEN 24 ELSE 48 END) OR length(coalesce(p_value->>'key','')) NOT BETWEEN 1 AND 256 OR length(coalesce(p_value->>'skeleton','')) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid_approval';END IF;
 SELECT * INTO old FROM cw041_names.names WHERE kind=p_kind AND entity=p_entity FOR UPDATE;
 IF FOUND AND old.display=p_value->>'display' AND old.visibility='visible' THEN RETURN jsonb_build_object('status',200,'code','unchanged','revision',old.revision);END IF;
 IF p_kind='username' THEN
  IF old.changed_at IS NOT NULL AND NOT p_override AND old.changed_at+interval '2 hours'>now_at THEN RETURN jsonb_build_object('status',409,'code','username_cooldown','nextChangeAt',old.changed_at+interval '2 hours');END IF;
  keyhash:=cw041_names.digest(p_value->>'key');skhash:=cw041_names.digest(p_value->>'skeleton');
  PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:key:'||keyhash,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:skeleton:'||skhash,0));
  IF EXISTS(SELECT 1 FROM cw041_names.username_keys WHERE key_hash=keyhash AND owner_id<>p_owner) OR EXISTS(SELECT 1 FROM cw041_names.username_skeletons WHERE key_hash=skhash AND owner_id<>p_owner) THEN RETURN '{"status":409,"code":"name_unavailable"}';END IF;
  INSERT INTO cw041_names.username_keys VALUES(keyhash,p_owner) ON CONFLICT DO NOTHING;
  INSERT INTO cw041_names.username_skeletons VALUES(skhash,p_owner) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO cw041_names.names(kind,entity,owner_id,display,canonical_key,skeleton,policy_hash) VALUES(p_kind,p_entity,p_owner,p_value->>'display',p_value->>'key',p_value->>'skeleton',(SELECT policy_hash FROM cw041_names.config))
 ON CONFLICT(kind,entity) DO UPDATE SET owner_id=excluded.owner_id,display=excluded.display,canonical_key=excluded.canonical_key,skeleton=excluded.skeleton,visibility='visible',revision=names.revision+1,changed_at=now_at,policy_hash=excluded.policy_hash RETURNING names.revision INTO revision;
 IF p_kind='username' THEN
  UPDATE auth.users SET raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'),'{username}',to_jsonb(p_value->>'display')) WHERE id=p_owner;
  UPDATE public.world_members SET username=p_value->>'display' WHERE user_id=p_owner;
  UPDATE public.territory_claims SET owner_username=p_value->>'display' WHERE owner_id=p_owner;
  UPDATE public.capitals SET owner_username=p_value->>'display' WHERE owner_id=p_owner;
 ELSIF p_kind='city' THEN UPDATE public.capitals SET name=p_value->>'display' WHERE world_id::text='central' AND owner_id=p_owner;END IF;
 INSERT INTO cw041_names.audit(actor,kind,entity,action,before_display,after_display,reason) VALUES(p_actor,p_kind,p_entity,CASE WHEN p_override THEN 'force_rename' ELSE 'rename' END,old.display,p_value->>'display',p_reason);
 RETURN jsonb_build_object('status',200,'code','renamed','revision',revision,'nextChangeAt',CASE WHEN p_kind='username' THEN now_at+interval '2 hours' ELSE NULL END);
END$$;
CREATE FUNCTION public.cw041_names_finish(p_actor uuid,p_operation uuid,p_hash text,p_decision text,p_value jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$DECLARE a cw041_names.attempts;i jsonb;act text;result jsonb;own uuid;n cw041_names.names;r cw041_names.reviews;rid uuid;BEGIN
 PERFORM cw041_names.verify(p_actor);
 IF (SELECT policy_hash FROM cw041_names.config) IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'policy_mismatch' USING ERRCODE='55000';END IF;
 SELECT * INTO STRICT a FROM cw041_names.attempts WHERE actor=p_actor AND operation_id=p_operation FOR UPDATE;
 IF a.receipt IS NOT NULL THEN RETURN a.receipt;END IF;
 i:=a.intent;act:=i->>'action';
 IF act IN('rename','force_rename') THEN
  own:=cw041_names.owner(i->>'kind',i->>'entity');
  IF act='force_rename' THEN PERFORM cw041_names.require_mod(p_actor,act);ELSIF own<>p_actor THEN RAISE EXCEPTION 'not_name_owner' USING ERRCODE='42501';END IF;
  IF p_decision='reject' THEN result:='{"status":409,"code":"name_unavailable"}';
  ELSIF p_decision='review' AND act='rename' THEN
   INSERT INTO cw041_names.reviews(actor,kind,entity,candidate,base_revision,policy_hash) VALUES(p_actor,i->>'kind',i->>'entity',p_value,coalesce((SELECT revision FROM cw041_names.names WHERE kind=i->>'kind' AND entity=i->>'entity'),0),p_hash) RETURNING id INTO rid;
   result:=jsonb_build_object('status',202,'code','review_pending','reviewId',rid);
  ELSIF p_decision='approve' THEN
   IF act='force_rename' THEN PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:owner:'||own::text,0));END IF;
   IF act='force_rename' AND coalesce((SELECT revision FROM cw041_names.names WHERE kind=i->>'kind' AND entity=i->>'entity'),0) IS DISTINCT FROM (i->>'revision')::bigint THEN result:='{"status":409,"code":"name_revision_changed"}';ELSE result:=cw041_names.publish(p_actor,i->>'kind',i->>'entity',own,p_value,act='force_rename',i->>'reason');END IF;
  ELSE result:='{"status":409,"code":"name_unavailable"}';END IF;
 ELSIF act='report' THEN
  SELECT * INTO STRICT n FROM cw041_names.names WHERE kind=i->>'kind' AND entity=i->>'entity';
  INSERT INTO cw041_names.reports(reporter,kind,entity,revision,reason) VALUES(p_actor,n.kind,n.entity,n.revision,i->>'reason') ON CONFLICT DO NOTHING;
  result:='{"status":200,"code":"report_recorded"}';
 ELSIF act='hide' THEN
  PERFORM cw041_names.require_mod(p_actor,'hide');
  SELECT * INTO STRICT n FROM cw041_names.names WHERE kind=i->>'kind' AND entity=i->>'entity';
  PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:owner:'||n.owner_id::text,0));
  IF (SELECT revision FROM cw041_names.names WHERE kind=i->>'kind' AND entity=i->>'entity') IS DISTINCT FROM (i->>'revision')::bigint THEN RAISE EXCEPTION 'name_revision_changed' USING ERRCODE='22023';END IF;
  UPDATE cw041_names.names SET visibility='hidden',revision=revision+1 WHERE kind=i->>'kind' AND entity=i->>'entity' RETURNING * INTO STRICT n;
  IF n.kind='username' THEN
   UPDATE auth.users SET raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'),'{username}','"Player"') WHERE id=n.owner_id;
   UPDATE public.world_members SET username='Player' WHERE user_id=n.owner_id;UPDATE public.territory_claims SET owner_username='Player' WHERE owner_id=n.owner_id;UPDATE public.capitals SET owner_username='Player' WHERE owner_id=n.owner_id;
  ELSIF n.kind='city' THEN UPDATE public.capitals SET name='Unnamed city' WHERE world_id::text='central' AND owner_id=n.owner_id;END IF;
  INSERT INTO cw041_names.audit(actor,kind,entity,action,before_display,reason) VALUES(p_actor,n.kind,n.entity,'hide',n.display,i->>'reason');result:='{"status":200,"code":"name_hidden"}';
 ELSIF act='review' THEN
  PERFORM cw041_names.require_mod(p_actor,'review');SELECT * INTO STRICT r FROM cw041_names.reviews WHERE id=(i->>'reviewId')::uuid FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtextextended('cw041_names:owner:'||r.actor::text,0));
  IF r.status<>'pending' OR r.policy_hash<>p_hash OR coalesce((SELECT revision FROM cw041_names.names WHERE kind=r.kind AND entity=r.entity),0)<>r.base_revision THEN IF r.status='pending' THEN UPDATE cw041_names.reviews SET status='superseded' WHERE id=r.id;END IF;result:='{"status":409,"code":"review_stale"}';
  ELSIF i->>'decision'='reject' OR p_decision='reject' THEN UPDATE cw041_names.reviews SET status='rejected' WHERE id=r.id;result:='{"status":200,"code":"review_rejected"}';
  ELSIF p_decision='approve' THEN
   result:=cw041_names.publish(p_actor,r.kind,r.entity,r.actor,p_value,false,'manual_review');
   IF result->>'status'='200' THEN UPDATE cw041_names.reviews SET status='approved' WHERE id=r.id;END IF;
  ELSE result:='{"status":409,"code":"review_unavailable"}';END IF;
  INSERT INTO cw041_names.audit(actor,kind,entity,action,reason) VALUES(p_actor,r.kind,r.entity,'review',i->>'decision');
 ELSIF act='resolve_report' THEN
  PERFORM cw041_names.require_mod(p_actor,'review');UPDATE cw041_names.reports SET status=i->>'resolution' WHERE id=(i->>'reportId')::uuid;
  INSERT INTO cw041_names.audit(actor,action,reason) VALUES(p_actor,'resolve_report',i->>'resolution');result:='{"status":200,"code":"report_resolved"}';
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';END IF;
 UPDATE cw041_names.attempts SET receipt=result WHERE actor=p_actor AND operation_id=p_operation;RETURN result;
END$$;
CREATE FUNCTION public.cw041_names_queue(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 PERFORM cw041_names.verify(p_actor);
 IF NOT EXISTS(SELECT 1 FROM cw041_names.moderators WHERE actor=p_actor AND (can_review OR can_hide OR can_rename)) THEN RAISE EXCEPTION 'moderator_required' USING ERRCODE='42501';END IF;
 IF NOT cw041_names.rate(p_actor) THEN RETURN '{"limited":true}';END IF;
 RETURN jsonb_build_object('reviews',(SELECT coalesce(jsonb_agg(r),'[]') FROM (SELECT * FROM cw041_names.reviews WHERE status='pending' ORDER BY created_at LIMIT 50)r),'reports',(SELECT coalesce(jsonb_agg(r),'[]') FROM (SELECT * FROM cw041_names.reports WHERE status='pending' ORDER BY created_at LIMIT 50)r),'legacy',(SELECT coalesce(jsonb_agg(r),'[]') FROM (SELECT * FROM cw041_names.legacy_review ORDER BY created_at LIMIT 50)r));
END$$;
CREATE FUNCTION public.cw041_names_public(p_kind text,p_entity text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled) THEN RETURN '{"enabled":false}';END IF;
 IF p_kind NOT IN('username','kingdom','city','alliance','building') OR length(p_entity)>128 THEN RETURN '{"enabled":true,"display":null}';END IF;
 RETURN jsonb_build_object('enabled',true,'display',cw041_names.display(p_kind,p_entity),'revision',coalesce((SELECT revision FROM cw041_names.names WHERE kind=p_kind AND entity=p_entity),0));
END$$;
CREATE FUNCTION public.cw041_names_public_batch(p_requests jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041_names.config WHERE enabled) THEN RETURN '{"enabled":false}';END IF;
 IF jsonb_typeof(p_requests) IS DISTINCT FROM 'array' OR jsonb_array_length(p_requests)>100 THEN RAISE EXCEPTION 'invalid_batch' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('enabled',true,'names',(SELECT coalesce(jsonb_agg(jsonb_build_object('kind',r->>'kind','entity',r->>'entity','display',cw041_names.display(r->>'kind',r->>'entity'),'revision',coalesce((SELECT revision FROM cw041_names.names WHERE kind=r->>'kind' AND entity=r->>'entity'),0))),'[]') FROM jsonb_array_elements(p_requests) r WHERE r->>'kind' IN('username','city','kingdom','alliance','building') AND length(r->>'entity') BETWEEN 1 AND 128));
END$$;
-- Owner-only retention: receipts/fingerprints and hashed username reservations survive.
CREATE FUNCTION cw041_names.purge() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041_names AS $$BEGIN
 UPDATE cw041_names.attempts a SET receipt=CASE WHEN a.receipt->>'status'='202' THEN CASE WHEN EXISTS(SELECT 1 FROM cw041_names.reviews r WHERE r.id=(a.receipt->>'reviewId')::uuid AND r.status='approved') THEN '{"status":200,"code":"review_approved"}'::jsonb ELSE '{"status":409,"code":"review_expired"}'::jsonb END ELSE coalesce(a.receipt,'{"status":409,"code":"operation_expired"}'::jsonb) END,intent='{}' WHERE created_at<clock_timestamp()-interval '30 days';
 DELETE FROM cw041_names.reviews WHERE created_at<clock_timestamp()-interval '30 days';
 DELETE FROM cw041_names.legacy_review WHERE created_at<clock_timestamp()-interval '30 days';
 UPDATE cw041_names.audit SET before_display=NULL,after_display=NULL WHERE created_at<clock_timestamp()-interval '90 days';
 DELETE FROM cw041_names.reports WHERE created_at<clock_timestamp()-interval '90 days' AND status<>'pending';
END$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cw041_names FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.cw041_names_begin(uuid,uuid,jsonb),public.cw041_names_finish(uuid,uuid,text,text,jsonb),public.cw041_names_queue(uuid),public.cw041_names_public(text,text),public.cw041_names_public_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cw041_names_begin(uuid,uuid,jsonb),public.cw041_names_finish(uuid,uuid,text,text,jsonb),public.cw041_names_queue(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cw041_names_public(text,text),public.cw041_names_public_batch(jsonb) TO authenticated,service_role;
COMMIT;
