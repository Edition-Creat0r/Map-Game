-- REVIEW/STAGING ONLY. Run as postgres after the preflight and legacy-policy review.
-- Does not alter existing auth, claims, capitals, membership, RPCs or their policies.
BEGIN;
CREATE SCHEMA cw041;
REVOKE ALL ON SCHEMA cw041 FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE cw041.settings (
 world_id text PRIMARY KEY CHECK(world_id='central'), enabled boolean NOT NULL DEFAULT false,
 seed integer NOT NULL DEFAULT 734221, release_hash text, catalog jsonb, materials jsonb
);
INSERT INTO cw041.settings(world_id) VALUES('central');
CREATE TABLE cw041.accounts (
 actor uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0), state jsonb,
 target_ms bigint, updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE cw041.operations (
 actor uuid NOT NULL REFERENCES cw041.accounts(actor), operation_id uuid NOT NULL,
 intent jsonb NOT NULL, receipt jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor,operation_id)
);
CREATE TABLE cw041.buildings (
 actor uuid NOT NULL REFERENCES cw041.accounts(actor), building_id uuid NOT NULL,
 territory_id text NOT NULL, x double precision NOT NULL, z double precision NOT NULL,
 width double precision NOT NULL CHECK(width>0), depth double precision NOT NULL CHECK(depth>0),
 row_data jsonb NOT NULL, bounds box NOT NULL,
 PRIMARY KEY(actor,building_id), FOREIGN KEY(actor,building_id) REFERENCES cw041.operations(actor,operation_id)
);
CREATE INDEX ON cw041.buildings(territory_id);
CREATE INDEX ON cw041.buildings USING gist(bounds);
CREATE TABLE cw041.audit (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid NOT NULL REFERENCES cw041.accounts(actor), operation_id uuid NOT NULL,
 revision bigint NOT NULL, kind text NOT NULL, exact_delta jsonb NOT NULL,
 receipt jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor,revision)
);
CREATE INDEX ON cw041.audit(actor,event_id);
CREATE TABLE cw041.rate_limits (
 actor uuid PRIMARY KEY REFERENCES cw041.accounts(actor), bucket bigint NOT NULL, requests integer NOT NULL
);
-- No direct client access, even to own accounts. Explicit owner policy supports FORCE RLS.
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['settings','accounts','operations','buildings','audit','rate_limits'] LOOP
  EXECUTE format('ALTER TABLE cw041.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE cw041.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY backend_owner ON cw041.%I TO postgres USING (true) WITH CHECK (true)',t);
  EXECUTE format('REVOKE ALL ON cw041.%I FROM PUBLIC, anon, authenticated, service_role',t);
 END LOOP;
END$$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cw041 FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cw041 REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION cw041.assert_actor(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE member boolean; BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'unverified_actor' USING ERRCODE='42501'; END IF;
 -- Expected legacy contract, inferred from the client; must be verified on real staging.
 EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.world_members WHERE world_id::text=$1 AND user_id::text=$2)' INTO member USING 'central',p_actor::text;
 IF NOT member THEN RAISE EXCEPTION 'not_world_member' USING ERRCODE='42501'; END IF;
END$$;
CREATE FUNCTION cw041.assert_owner(p_actor uuid,p_territory text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE owner text; m text[]; BEGIN
 m:=regexp_match(p_territory,'^T_(0|[1-9][0-9]{0,2})_(0|[1-9][0-9]{0,2})$');
 IF m IS NULL OR m[1]::int>=316 OR m[2]::int>=316 OR (abs(m[1]::int-158)<=1 AND abs(m[2]::int-158)<=1) THEN RAISE EXCEPTION 'invalid_or_protected_territory' USING ERRCODE='42501'; END IF;
 -- SHARE lock prevents a concurrent legacy ownership update during the transaction.
 EXECUTE 'SELECT owner_id::text FROM public.territory_claims WHERE world_id::text=$1 AND territory_id::text=$2 FOR SHARE' INTO STRICT owner USING 'central',p_territory;
 IF owner<>p_actor::text THEN RAISE EXCEPTION 'not_territory_owner' USING ERRCODE='42501'; END IF;
 EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'unowned_territory' USING ERRCODE='42501';
END$$;
CREATE FUNCTION cw041.assert_account_land(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE tx text; BEGIN
 FOR tx IN SELECT DISTINCT territory_id FROM cw041.buildings WHERE actor=p_actor ORDER BY 1 LOOP
  PERFORM cw041.assert_owner(p_actor,tx);
 END LOOP;
END$$;
CREATE FUNCTION cw041.apply_rate_limit(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE n integer; bucket_now bigint; BEGIN
 INSERT INTO cw041.accounts(actor) VALUES(p_actor) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM cw041.accounts WHERE actor=p_actor FOR UPDATE;
 bucket_now:=floor(extract(epoch FROM clock_timestamp())/60)::bigint;
 INSERT INTO cw041.rate_limits(actor,bucket,requests) VALUES(p_actor,bucket_now,1)
 ON CONFLICT(actor) DO UPDATE SET bucket=excluded.bucket,requests=CASE WHEN rate_limits.bucket=excluded.bucket THEN rate_limits.requests+1 ELSE 1 END
 RETURNING requests INTO n;
 IF n>120 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE='54000'; END IF;
END$$;
CREATE FUNCTION cw041.capitals(p_territory text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE result jsonb; BEGIN
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''territoryId'',territory_id,''x'',x,''z'',z)),''[]''::jsonb) FROM public.capitals WHERE world_id::text=$1 AND territory_id::text=$2' INTO result USING 'central',p_territory;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) c WHERE c->>'x' IS NULL OR c->>'z' IS NULL OR (c->>'x')::float8 NOT BETWEEN 0 AND 32768 OR (c->>'z')::float8 NOT BETWEEN 0 AND 32768) THEN RAISE EXCEPTION 'invalid_legacy_capital'; END IF;
 RETURN result;
END$$;

CREATE FUNCTION public.cw041_context(p_actor uuid,p_operation uuid,p_intent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$
DECLARE cfg cw041.settings; a cw041.accounts; op cw041.operations; now_ms bigint;
 n integer; bucket_now bigint; neighbors jsonb:='[]'; capitals_data jsonb:='[]';
BEGIN
 SELECT * INTO STRICT cfg FROM cw041.settings WHERE world_id='central';
 IF NOT cfg.enabled OR cfg.release_hash IS NULL THEN RAISE EXCEPTION 'economy_disabled' USING ERRCODE='55000'; END IF;
 PERFORM cw041.assert_actor(p_actor);
 PERFORM cw041.assert_coordination();
 PERFORM cw041.assert_account_land(p_actor);
 IF jsonb_typeof(p_intent)<>'object' OR p_intent->>'action' NOT IN('settle','place','research') OR octet_length(p_intent::text)>4096 THEN RAISE EXCEPTION 'invalid_intent'; END IF;
 INSERT INTO cw041.accounts(actor) VALUES(p_actor) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT a FROM cw041.accounts WHERE actor=p_actor FOR UPDATE;
 -- Do not accrue unverified income following legacy ownership transfers/deletions.
 IF EXISTS(SELECT 1 FROM cw041.buildings b WHERE b.actor=p_actor AND NOT EXISTS(SELECT 1 FROM public.territory_claims t WHERE t.world_id::text='central' AND t.territory_id::text=b.territory_id AND t.owner_id::text=p_actor::text)) THEN RAISE EXCEPTION 'ownership_reconciliation_required' USING ERRCODE='55000'; END IF;
 now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint; bucket_now:=now_ms/60000;
 PERFORM cw041.apply_rate_limit(p_actor);
 SELECT * INTO op FROM cw041.operations WHERE actor=p_actor AND operation_id=p_operation;
 IF FOUND THEN
  IF op.intent IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'operation_intent_mismatch' USING ERRCODE='22023'; END IF;
  IF op.receipt IS NOT NULL THEN RETURN jsonb_build_object('receipt',op.receipt); END IF;
 ELSE
  IF (SELECT count(*) FROM cw041.operations WHERE actor=p_actor AND receipt IS NULL)>=32 THEN RAISE EXCEPTION 'too_many_pending_operations' USING ERRCODE='54000'; END IF;
  INSERT INTO cw041.operations(actor,operation_id,intent) VALUES(p_actor,p_operation,p_intent);
 END IF;
 IF p_intent->>'action'='place' THEN
  PERFORM cw041.assert_owner(p_actor,p_intent->>'territoryId');
  -- Regional data only, never another account's balances. Footprints are canonical.
  SELECT coalesce(jsonb_agg(row_data),'[]') INTO neighbors FROM cw041.buildings WHERE territory_id=p_intent->>'territoryId';
  capitals_data:=cw041.capitals(p_intent->>'territoryId');
 END IF;
 RETURN jsonb_build_object('revision',a.revision,'state',a.state,'targetMs',a.target_ms,'nowMs',now_ms,'releaseHash',cfg.release_hash,'seed',cfg.seed,'neighbors',neighbors,'capitals',capitals_data);
END$$;

CREATE FUNCTION public.cw041_commit(p_actor uuid,p_operation uuid,p_revision bigint,p_release text,
 p_state jsonb,p_complete boolean,p_target bigint,p_receipt jsonb,p_building jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,cw041 AS $$
<<commit_block>>
DECLARE cfg cw041.settings; a cw041.accounts; op cw041.operations; v jsonb; old_rows jsonb;
 w float8; d float8; x float8; z float8; tx text; def jsonb; r integer; caps jsonb;
 delta jsonb; now_ms bigint;
BEGIN
 SELECT * INTO STRICT cfg FROM cw041.settings WHERE world_id='central' FOR SHARE;
 IF NOT cfg.enabled OR cfg.release_hash IS DISTINCT FROM p_release THEN RAISE EXCEPTION 'economy_disabled_or_release_mismatch' USING ERRCODE='55000'; END IF;
 PERFORM cw041.assert_actor(p_actor);
 PERFORM cw041.assert_coordination();
 PERFORM cw041.assert_account_land(p_actor);
 SELECT * INTO STRICT a FROM cw041.accounts WHERE actor=p_actor FOR UPDATE;
 SELECT * INTO STRICT op FROM cw041.operations WHERE actor=p_actor AND operation_id=p_operation FOR UPDATE;
 IF op.receipt IS NOT NULL THEN RETURN jsonb_build_object('receipt',op.receipt); END IF;
 IF a.revision IS DISTINCT FROM p_revision THEN RETURN '{"conflict":"account_changed"}'; END IF;
 IF p_complete IS NULL OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR p_receipt->>'code' IS NULL OR p_receipt->>'status' IS NULL THEN RAISE EXCEPTION 'invalid_server_receipt'; END IF;
 IF (NOT p_complete AND (p_receipt->>'status')::int<>202) OR (p_complete AND (p_receipt->>'status')::int NOT IN(200,400,409)) THEN RAISE EXCEPTION 'invalid_server_receipt'; END IF;
 now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 IF octet_length(p_state::text)>33554432 OR (p_state#>>'{economy,version}')::int IS DISTINCT FROM 4 OR (p_state#>>'{economy,materialRegistryVersion}')::int IS DISTINCT FROM 1 OR jsonb_typeof(p_state#>'{economy,precision}') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_server_state'; END IF;
 IF p_state#>>'{economy,lastTick}' IS NULL OR (p_state#>>'{economy,lastTick}')::numeric>9007199254740991 OR (p_state#>>'{economy,lastTick}')::bigint<coalesce((a.state#>>'{economy,lastTick}')::bigint,0) OR (p_state#>>'{economy,lastTick}')::bigint>now_ms THEN RAISE EXCEPTION 'invalid_checkpoint'; END IF;
 IF p_target IS NOT NULL AND (p_target>now_ms OR p_target<(p_state#>>'{economy,lastTick}')::bigint) THEN RAISE EXCEPTION 'invalid_target'; END IF;
 IF (NOT p_complete AND p_target IS NULL) OR (p_complete AND p_target IS NOT NULL) THEN RAISE EXCEPTION 'invalid_settlement_status'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(cfg.materials||'["population","totalEarned"]'::jsonb) k WHERE NOT (p_state#>'{economy,precision}') ? k) THEN RAISE EXCEPTION 'missing_material_ledger'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(p_state#>'{economy,precision}') q WHERE q.value !~ '^[0-9]{1,32}$' OR CASE WHEN q.value ~ '^[0-9]{1,32}$' THEN q.value::numeric>300000000000000000000000 ELSE false END) THEN RAISE EXCEPTION 'invalid_exact_ledger'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(a.state#>'{economy,rules}','{}')) q WHERE (p_state#>'{economy,rules}')->q.key IS DISTINCT FROM q.value) THEN RAISE EXCEPTION 'contract_changed'; END IF;
 old_rows:=coalesce(a.state->'placedIncomeItems','[]');
 IF p_building IS NULL THEN
  IF p_state->'placedIncomeItems' IS DISTINCT FROM old_rows THEN RAISE EXCEPTION 'unindexed_building_change'; END IF;
 ELSE
  IF NOT p_complete OR op.intent->>'action'<>'place' OR p_building->>'id'<>p_operation::text OR p_building->>'ownerId'<>p_actor::text OR p_building->>'type'<>op.intent->>'buildingId' OR p_building->>'territoryId'<>op.intent->>'territoryId' OR p_building->'x' IS DISTINCT FROM op.intent->'x' OR p_building->'z' IS DISTINCT FROM op.intent->'z' OR p_state->'placedIncomeItems' IS DISTINCT FROM old_rows||jsonb_build_array(p_building) THEN RAISE EXCEPTION 'invalid_building_commit'; END IF;
 END IF;
 IF op.intent->>'action'='place' THEN
  tx:=op.intent->>'territoryId'; PERFORM cw041.assert_owner(p_actor,tx);
  -- Same territory lock for EVERY account; no concurrent collision race.
  PERFORM pg_advisory_xact_lock(hashtextextended('cw041:central:'||tx,0));
 END IF;
 IF p_building IS NOT NULL THEN
  def:=cfg.catalog->(p_building->>'type');
  IF def IS NULL OR p_building->'footprint' IS DISTINCT FROM def->'footprint' OR (p_building->>'rotation')::float8<>(op.intent->>'rotation')::int*pi()/2 THEN RAISE EXCEPTION 'noncanonical_footprint'; END IF;
  r:=(op.intent->>'rotation')::int;
  w:=(def#>>ARRAY['footprint',CASE WHEN r%2=0 THEN '0' ELSE '1' END])::float8;
  d:=(def#>>ARRAY['footprint',CASE WHEN r%2=0 THEN '1' ELSE '0' END])::float8;
  x:=(p_building->>'x')::float8; z:=(p_building->>'z')::float8;
  IF NOT (x-w/2>=0 AND x+w/2<=32768 AND z-d/2>=0 AND z+d/2<=32768) THEN RAISE EXCEPTION 'footprint_outside_territory'; END IF;
  IF EXISTS(SELECT 1 FROM cw041.buildings b WHERE b.territory_id=tx AND abs(b.x-commit_block.x)*2 < b.width+w+4 AND abs(b.z-commit_block.z)*2 < b.depth+d+4) THEN RETURN '{"conflict":"site_changed"}'; END IF;
  caps:=cw041.capitals(tx);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(caps) c WHERE abs((c->>'x')::float8-x)*2 <150+w+4 AND abs((c->>'z')::float8-z)*2 <150+d+4) THEN RETURN '{"conflict":"site_changed"}'; END IF;
  INSERT INTO cw041.buildings(actor,building_id,territory_id,x,z,width,depth,row_data,bounds) VALUES(p_actor,p_operation,tx,x,z,w,d,p_building,box(point(x-w/2,z-d/2),point(x+w/2,z+d/2)));
 END IF;
 SELECT coalesce(jsonb_object_agg(q.key,(q.value::numeric-coalesce((a.state#>'{economy,precision}')->>q.key,'0')::numeric)::text),'{}') INTO delta FROM jsonb_each_text(p_state#>'{economy,precision}') q;
 UPDATE cw041.accounts SET revision=revision+1,state=p_state,target_ms=p_target,updated_at=clock_timestamp() WHERE actor=p_actor;
 INSERT INTO cw041.audit(actor,operation_id,revision,kind,exact_delta,receipt) VALUES(p_actor,p_operation,a.revision+1,CASE WHEN p_complete THEN op.intent->>'action' ELSE 'settlement_checkpoint' END,delta,p_receipt);
 IF p_complete THEN UPDATE cw041.operations SET receipt=p_receipt WHERE actor=p_actor AND operation_id=p_operation; END IF;
 RETURN jsonb_build_object('receipt',p_receipt);
END$$;

CREATE FUNCTION public.cw041_region(p_actor uuid,p_territory text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041.settings WHERE world_id='central' AND enabled) THEN RAISE EXCEPTION 'economy_disabled' USING ERRCODE='55000'; END IF;
 PERFORM cw041.assert_actor(p_actor);
 PERFORM cw041.assert_coordination();
 PERFORM cw041.assert_account_land(p_actor);
 PERFORM cw041.apply_rate_limit(p_actor);
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',building_id,'ownerId',actor,'type',row_data->>'type','territoryId',territory_id,'x',x,'z',z,'rotation',row_data->'rotation','footprint',row_data->'footprint')),'[]') FROM cw041.buildings WHERE territory_id=p_territory);
END$$;
CREATE FUNCTION public.cw041_status(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,cw041 AS $$DECLARE pending jsonb; recent jsonb; a cw041.accounts; BEGIN
 IF NOT EXISTS(SELECT 1 FROM cw041.settings WHERE enabled) THEN RAISE EXCEPTION 'economy_disabled' USING ERRCODE='55000'; END IF;
 PERFORM cw041.assert_actor(p_actor); PERFORM cw041.assert_coordination(); PERFORM cw041.apply_rate_limit(p_actor);
 SELECT * INTO STRICT a FROM cw041.accounts WHERE actor=p_actor;
 SELECT coalesce(jsonb_agg(jsonb_build_object('operationId',operation_id,'intent',intent,'createdAt',created_at)),'[]') INTO pending FROM cw041.operations WHERE actor=p_actor AND receipt IS NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('operationId',operation_id,'receipt',receipt,'createdAt',created_at)),'[]') INTO recent FROM (SELECT operation_id,receipt,created_at FROM cw041.operations WHERE actor=p_actor AND receipt IS NOT NULL ORDER BY created_at DESC LIMIT 50) r;
 RETURN jsonb_build_object('pending',pending,'recent',recent,'revision',a.revision,'checkpoint',a.state#>'{economy,lastTick}');
END$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cw041 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.cw041_context(uuid,uuid,jsonb),public.cw041_commit(uuid,uuid,bigint,text,jsonb,boolean,bigint,jsonb,jsonb),public.cw041_region(uuid,text),public.cw041_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cw041_context(uuid,uuid,jsonb),public.cw041_commit(uuid,uuid,bigint,text,jsonb,boolean,bigint,jsonb,jsonb),public.cw041_region(uuid,text),public.cw041_status(uuid) TO service_role;
COMMIT;
