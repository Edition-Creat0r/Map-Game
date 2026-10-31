-- SYNTHETIC LOCAL TEST MODEL ONLY. NEVER DEPLOY OR IMPORT ON SUPABASE.
-- Hand-authored from reviewed column/signature contracts, NOT a production dump.
-- Eight ON DELETE actions explicitly confirmed by the owner; no world_sessions
-- world FK was supplied. Constraint creation order here is synthetic, not live.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TABLE public.worlds(id text PRIMARY KEY,name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.world_members(world_id text NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 username text NOT NULL,joined_at timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(world_id,user_id));
CREATE TABLE public.world_sessions(world_id text NOT NULL,session_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 device_id text,username text,created_at timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),conflicted boolean NOT NULL DEFAULT false);
CREATE TABLE public.territory_claims(world_id text NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,territory_id text NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,owner_username text NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(world_id,territory_id));
CREATE UNIQUE INDEX territory_claims_one_per_owner ON public.territory_claims(owner_id);
CREATE TABLE public.capitals(world_id text NOT NULL REFERENCES public.worlds(id) ON DELETE CASCADE,owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 owner_username text NOT NULL,territory_id text NOT NULL,name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 32),
 x float8 NOT NULL,z float8 NOT NULL,founded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(world_id,owner_id),
 FOREIGN KEY(world_id,territory_id) REFERENCES public.territory_claims(world_id,territory_id) ON DELETE RESTRICT);
ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY worlds_read_authenticated ON public.worlds FOR SELECT TO authenticated USING(true);
CREATE POLICY world_members_read_authenticated ON public.world_members FOR SELECT TO authenticated USING(true);
CREATE POLICY world_members_insert_self ON public.world_members FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY world_members_update_self ON public.world_members FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY territories_read_authenticated ON public.territory_claims FOR SELECT TO authenticated USING(true);
CREATE POLICY territories_insert_self ON public.territory_claims FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY capitals_read_authenticated ON public.capitals FOR SELECT TO authenticated USING(true);
CREATE POLICY capitals_insert_self ON public.capitals FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY capitals_update_self ON public.capitals FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY session_read_self ON public.world_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY session_insert_self ON public.world_sessions FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY session_update_self ON public.world_sessions FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY session_delete_self ON public.world_sessions FOR DELETE TO authenticated USING(user_id=auth.uid());
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
-- Deliberate column-level grants: table-level REVOKE alone must not pass the tests.
GRANT INSERT(session_id,user_id,world_id,last_seen),UPDATE(last_seen,conflicted),REFERENCES(user_id)
 ON public.world_sessions TO authenticated;
CREATE FUNCTION public.map_game_start_session(p_world_id text,p_session_id uuid,p_username text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 DELETE FROM public.world_sessions WHERE last_seen<now()-interval '90 seconds';
 DELETE FROM public.world_sessions WHERE world_id=p_world_id AND user_id=uid AND session_id<>p_session_id;
 INSERT INTO public.world_sessions(world_id,session_id,user_id,username)
 VALUES(p_world_id,p_session_id,uid,p_username) ON CONFLICT(session_id)
 DO UPDATE SET world_id=excluded.world_id,user_id=excluded.user_id,last_seen=now(),conflicted=false;
 RETURN true;
END $$;
CREATE FUNCTION public.map_game_start_session(p_device_id text,p_session_id uuid,p_username text,p_world_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.map_game_start_session(p_world_id,p_session_id,p_username);
$$;
CREATE FUNCTION public.map_game_session_heartbeat(p_world_id text,p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); changed bigint;
BEGIN
 UPDATE public.world_sessions SET last_seen=now(),conflicted=false
 WHERE world_id=p_world_id AND session_id=p_session_id AND user_id=uid;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $$;
CREATE FUNCTION public.map_game_end_session(p_world_id text,p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM public.world_sessions WHERE world_id=p_world_id AND session_id=p_session_id AND user_id=auth.uid(); RETURN true; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated,service_role;
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111',now()),('22222222-2222-4222-8222-222222222222',now()),('33333333-3333-4333-8333-333333333333',NULL);
INSERT INTO public.worlds(id,name) VALUES('central','Synthetic Central');
