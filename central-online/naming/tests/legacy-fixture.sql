-- SYNTHETIC adapters inferred from client code, NOT a production schema dump.
ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb NOT NULL DEFAULT '{}',ADD COLUMN encrypted_password text DEFAULT 'synthetic-password-hash';
ALTER TABLE public.world_members ADD COLUMN username text;
ALTER TABLE public.territory_claims ADD COLUMN owner_username text;
ALTER TABLE public.capitals ADD COLUMN owner_username text,ADD COLUMN name text;
GRANT SELECT ON public.world_members,public.territory_claims,public.capitals TO authenticated;
GRANT UPDATE(username) ON public.world_members TO authenticated;
GRANT UPDATE(owner_username) ON public.territory_claims TO authenticated;
GRANT UPDATE(name,owner_username) ON public.capitals TO authenticated;
ALTER TABLE public.world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON public.world_members TO authenticated USING(user_id::text=current_setting('request.jwt.claim.sub',true)) WITH CHECK(user_id::text=current_setting('request.jwt.claim.sub',true));
CREATE POLICY own_claim ON public.territory_claims TO authenticated USING(owner_id::text=current_setting('request.jwt.claim.sub',true)) WITH CHECK(owner_id::text=current_setting('request.jwt.claim.sub',true));
CREATE POLICY own_capital ON public.capitals TO authenticated USING(owner_id::text=current_setting('request.jwt.claim.sub',true)) WITH CHECK(owner_id::text=current_setting('request.jwt.claim.sub',true));
