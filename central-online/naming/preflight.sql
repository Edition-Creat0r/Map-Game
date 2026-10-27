-- AUTHORIZED STAGING METADATA ONLY; keep results private. No player rows.
SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns
WHERE (table_schema='auth' AND table_name='users') OR (table_schema='public' AND table_name IN('world_members','territory_claims','capitals')) ORDER BY table_schema,table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN('public','cw041','cw041_names');
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema IN('public','cw041','cw041_names') ORDER BY table_schema,table_name,grantee;
SELECT tgname,tgrelid::regclass,tgenabled,pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN('auth.users'::regclass,'public.world_members'::regclass,'public.territory_claims'::regclass,'public.capitals'::regclass);
SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname IN('map_game_start_session','map_game_session_heartbeat','map_game_end_session') OR p.proname LIKE 'cw041_names_%');
-- Review unknown public-name tables, profile/session mirrors, realtime identity
-- and publication rules too; the checked-in client is not the deployed schema.
