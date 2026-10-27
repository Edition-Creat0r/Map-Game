-- ISOLATED TEST FIXTURE ONLY. This is NOT the actual Supabase project schema.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
CREATE TABLE public.world_members(world_id text,user_id uuid);
CREATE TABLE public.territory_claims(world_id text,territory_id text,owner_id uuid,PRIMARY KEY(world_id,territory_id));
CREATE TABLE public.capitals(world_id text,territory_id text,owner_id uuid,x float8,z float8);
