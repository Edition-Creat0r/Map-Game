-- READ-ONLY metadata. Run only by an authorized operator on the verified target.
-- Contains no player rows, passwords or live session IDs. Function/default
-- definitions can themselves contain embedded credentials: keep output private.
BEGIN READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
  'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'columns',(SELECT jsonb_agg(to_jsonb(x)) FROM information_schema.columns x
  WHERE table_schema='public' AND table_name IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)))
  FROM pg_constraint WHERE conrelid IN(to_regclass('public.worlds'),to_regclass('public.world_members'),
   to_regclass('public.world_sessions'),to_regclass('public.territory_claims'),to_regclass('public.capitals'))),
 'indexes',(SELECT jsonb_agg(to_jsonb(x)) FROM pg_indexes x WHERE schemaname='public'
  AND tablename IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'policies',(SELECT jsonb_agg(to_jsonb(x)) FROM pg_policies x WHERE schemaname='public'
  AND tablename IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'table_grants',(SELECT jsonb_agg(to_jsonb(x)) FROM information_schema.role_table_grants x WHERE table_schema='public'
  AND table_name IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'column_grants',(SELECT jsonb_agg(to_jsonb(x)) FROM information_schema.role_column_grants x WHERE table_schema='public'
  AND table_name IN('worlds','world_members','world_sessions','territory_claims','capitals')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,
  'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)))
  FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN(to_regclass('public.worlds'),to_regclass('public.world_members'),
   to_regclass('public.world_sessions'),to_regclass('public.territory_claims'),to_regclass('public.capitals'))),
 'public_functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
  'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'settings',p.proconfig,'grants',p.proacl,'definition',pg_get_functiondef(p.oid)))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN('f','p')
  AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),
 'public_schema_access',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
  'create',has_schema_privilege(r.oid,n.oid,'CREATE'))) FROM pg_roles r CROSS JOIN pg_namespace n
  WHERE n.nspname='public' AND r.rolname IN('anon','authenticated','service_role','authenticator')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls))
  FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role','authenticator')),
 'role_memberships',(SELECT jsonb_agg(jsonb_build_object('member',member.rolname,'granted_role',granted.rolname))
  FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
  WHERE member.rolname IN('anon','authenticated','service_role','authenticator') OR granted.rolname='service_role'),
 'default_privileges',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),
  'schema',n.nspname,'kind',d.defaclobjtype,'acl',d.defaclacl)) FROM pg_default_acl d
  LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public'),
 'public_views',(SELECT jsonb_agg(to_jsonb(x)) FROM pg_views x WHERE schemaname='public'),
 'realtime',(SELECT jsonb_agg(to_jsonb(x)) FROM pg_publication_tables x WHERE schemaname='public'
  AND tablename IN('worlds','world_members','world_sessions','territory_claims','capitals'))
)) AS metadata_review;
COMMIT;
