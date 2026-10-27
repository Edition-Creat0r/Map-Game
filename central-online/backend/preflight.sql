-- AUTHORIZED STAGING OWNER ONLY. Metadata inspection, no player rows or secrets.
-- Keep output private for review. This does NOT prove that existing policies are safe.
SELECT current_user,version();
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('world_members','territory_claims','capitals');
SELECT table_schema,table_name,column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema IN('public','auth') AND table_name IN('world_members','territory_claims','capitals','users') ORDER BY table_schema,table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname='public' AND tablename IN('world_members','territory_claims','capitals');
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name IN('world_members','territory_claims','capitals') ORDER BY table_name,grantee,privilege_type;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS signature,p.prosecdef,p.proconfig,p.proacl,
 pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN('map_game_start_session','map_game_session_heartbeat','map_game_end_session');
SELECT tgname,tgrelid::regclass,tgenabled,pg_get_triggerdef(oid) FROM pg_trigger
 WHERE NOT tgisinternal AND tgrelid IN(to_regclass('public.territory_claims'),to_regclass('public.capitals'));
SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role');
SELECT member.rolname AS member,granted.rolname AS granted_role
 FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
 WHERE member.rolname IN('anon','authenticated','service_role','authenticator') OR granted.rolname='service_role';
