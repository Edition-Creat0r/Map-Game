// Disposable pinned PostgreSQL ONLY. All destructive probes roll back.
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const {query,as,reset,join,a,b,unverified}=require('./helpers.cjs');
const stage=process.env.CW041_CLEANUP_STAGE;
if(!['baseline','hardened'].includes(stage))throw Error('Run through isolated runner with explicit cleanup stage');
const hardened=stage==='hardened',label=stage+': ';
const claimA='T_190_27',claimB='T_140_180';
async function snapshot(){return JSON.parse(await query(`SELECT json_build_object(
 'users',(SELECT json_agg(id ORDER BY id) FROM auth.users),
 'worlds',(SELECT json_agg(id ORDER BY id) FROM public.worlds),
 'members',(SELECT json_agg(t ORDER BY user_id) FROM public.world_members t),
 'sessions',(SELECT json_agg(t ORDER BY user_id) FROM public.world_sessions t),
 'claims',(SELECT json_agg(t ORDER BY owner_id) FROM public.territory_claims t),
 'capitals',(SELECT json_agg(t ORDER BY owner_id) FROM public.capitals t))`));}
beforeEach(async()=>{
 await reset();
 for(const [actor,territory] of [[a,claimA],[b,claimB]]){
  await join(actor);
  await as(actor,`INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','${territory}','${actor}','Synthetic')`);
  await as(actor,`INSERT INTO public.capitals(world_id,territory_id,owner_id,owner_username,name,x,z) VALUES('central','${territory}','${actor}','Synthetic','Test city',500,500)`);
 }
});
async function atomicRejection(sql,pattern){const before=await snapshot();await assert.rejects(query('BEGIN;'+sql+';ROLLBACK;'),pattern);assert.deepEqual(await snapshot(),before);}
test(label+'catalog exactly reproduces all eight confirmed delete actions',async()=>{
 const rows=JSON.parse(await query(`SELECT json_agg(x ORDER BY tab,cols) FROM (
 SELECT c.conrelid::regclass::text AS tab,
 ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS cols,
 c.confrelid::regclass::text AS target,
 ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS refs,
 c.confdeltype::text AS action,c.condeferrable AS deferred,c.convalidated AS validated
 FROM pg_constraint c WHERE c.contype='f' AND c.connamespace='public'::regnamespace) x`));
 const expected=[['capitals',['owner_id'],'auth.users',['id'],'c'],['capitals',['world_id'],'worlds',['id'],'c'],['capitals',['world_id','territory_id'],'territory_claims',['world_id','territory_id'],'r'],['territory_claims',['owner_id'],'auth.users',['id'],'c'],['territory_claims',['world_id'],'worlds',['id'],'c'],['world_members',['user_id'],'auth.users',['id'],'c'],['world_members',['world_id'],'worlds',['id'],'c'],['world_sessions',['user_id'],'auth.users',['id'],'c']].sort((x,y)=>(x[0]+x[1]).localeCompare(y[0]+y[1]));
 const selected=rows.filter(x=>['capitals','territory_claims','world_members','world_sessions'].includes(x.tab));
 assert.deepEqual(selected.map(x=>[x.tab,x.cols,x.target,x.refs,x.action]).sort((x,y)=>(x[0]+x[1]).localeCompare(y[0]+y[1])),expected);
 assert.ok(selected.every(x=>!x.deferred&&x.validated));
});
async function assertAccountCascade(prefix=''){
 const before=await snapshot();
 await query(`BEGIN;${prefix}DELETE FROM auth.users WHERE id='${a}';DO $$BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='${a}') OR EXISTS(SELECT 1 FROM public.capitals WHERE owner_id='${a}')
 OR EXISTS(SELECT 1 FROM public.territory_claims WHERE owner_id='${a}') OR EXISTS(SELECT 1 FROM public.world_members WHERE user_id='${a}')
 OR EXISTS(SELECT 1 FROM public.world_sessions WHERE user_id='${a}') THEN RAISE EXCEPTION 'incomplete_account_cascade';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='${b}') OR NOT EXISTS(SELECT 1 FROM public.capitals WHERE owner_id='${b}') THEN RAISE EXCEPTION 'other_account_changed';END IF;
 END$$;ROLLBACK;`);assert.deepEqual(await snapshot(),before);
}
async function assertWorldCascade(prefix=''){
 const before=await snapshot();
 await query(`BEGIN;${prefix}DELETE FROM public.worlds WHERE id='central';DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.worlds WHERE id='central') OR EXISTS(SELECT 1 FROM public.territory_claims WHERE world_id='central')
 OR EXISTS(SELECT 1 FROM public.capitals WHERE world_id='central') OR EXISTS(SELECT 1 FROM public.world_members WHERE world_id='central') THEN RAISE EXCEPTION 'incomplete_world_cascade';END IF;
 IF (SELECT count(*) FROM public.world_sessions WHERE world_id='central')<>2 THEN RAISE EXCEPTION 'unexpected_world_session_cascade';END IF;
 IF (SELECT count(*) FROM auth.users)<>3 THEN RAISE EXCEPTION 'world_delete_removed_users';END IF;
 END$$;ROLLBACK;`);assert.deepEqual(await snapshot(),before);
}
test(label+'account deletion cascades in baseline but hardening blocks cleanup atomically',async()=>{
 if(hardened)return atomicRejection(`DELETE FROM auth.users WHERE id='${a}'`,/reviewed_removal_required/);
 await assertAccountCascade();
});
test(label+'world deletion cascades in baseline but hardening blocks cleanup atomically',async()=>{
 if(hardened)return atomicRejection("DELETE FROM public.worlds WHERE id='central'",/reviewed_removal_required/);
 await assertWorldCascade();
});
test(label+'referenced claim deletion is rejected',()=>atomicRejection(`DELETE FROM public.territory_claims WHERE world_id='central' AND territory_id='${claimA}'`,hardened?/reviewed_removal_required/:/foreign key constraint/));
test(label+'capital-first account cleanup exposes trigger blocker or performs correct cascades',async()=>{
 const sql=`DELETE FROM public.capitals WHERE owner_id='${a}';DELETE FROM auth.users WHERE id='${a}'`;
 if(hardened)return atomicRejection(sql,/reviewed_removal_required/);
 await assertAccountCascade(`DELETE FROM public.capitals WHERE owner_id='${a}';`);
});
test(label+'capital-first world cleanup exposes blocker and documents sessions without world FK',async()=>{
 const sql="DELETE FROM public.capitals WHERE world_id='central';DELETE FROM public.worlds WHERE id='central'";
 if(hardened)return atomicRejection(sql,/reviewed_removal_required/);
 await assertWorldCascade("DELETE FROM public.capitals WHERE world_id='central';");
});
test(label+'deleting a claim without a capital contrasts FK permission with hardening denial',async()=>{
 const sql=`DELETE FROM public.capitals WHERE owner_id='${a}';DELETE FROM public.territory_claims WHERE owner_id='${a}'`;
 if(hardened)return atomicRejection(sql,/reviewed_removal_required/);
 await query('BEGIN;'+sql+`;DO $$BEGIN IF EXISTS(SELECT 1 FROM public.territory_claims WHERE owner_id='${a}') THEN RAISE EXCEPTION 'claim_not_removed';END IF;END$$;ROLLBACK;`);
});
test(label+'mismatched own capital territory through self-update is reproduced or rejected',async()=>{
 const before=await snapshot();
 if(hardened){await assert.rejects(as(a,`UPDATE public.capitals SET territory_id='${claimB}' WHERE owner_id='${a}'`),/not_territory_owner/);assert.deepEqual(await snapshot(),before);return;}
 // Explicit transaction and ROLLBACK: demonstrate a legacy permitted RLS path,
 // then leave the valid fixture intact for subsequent draft tests.
 await query(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='${a}';UPDATE public.capitals SET territory_id='${claimB}' WHERE owner_id='${a}';RESET ROLE;
 DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.capitals c JOIN public.territory_claims t USING(world_id,territory_id) WHERE c.owner_id<>t.owner_id) THEN RAISE EXCEPTION 'legacy_gap_not_reproduced';END IF;END$$;ROLLBACK;`);
 assert.deepEqual(await snapshot(),before);
});
test(label+'other-player capital edit remains filtered by RLS',async()=>{
 const before=await snapshot();await as(b,`UPDATE public.capitals SET name='Other city' WHERE owner_id='${a}'`);assert.deepEqual(await snapshot(),before);
});
if(hardened){
 test(label+'economy account RESTRICT independently blocks auth deletion without legacy rows',async()=>{
  await atomicRejection(`INSERT INTO cw041.accounts(actor) VALUES('${unverified}');DELETE FROM auth.users WHERE id='${unverified}'`,/foreign key constraint "accounts_actor_fkey"/);
  assert.equal(await query(`SELECT count(*) FROM cw041.accounts WHERE actor='${unverified}'`),'0');
 });
 test(label+'BYPASSRLS service writes without user context do not bypass the ownership trigger',async()=>{
  const before=await snapshot();await assert.rejects(as('',`UPDATE public.capitals SET territory_id='${claimB}' WHERE owner_id='${a}'`,'service_role'),/verified_central_actor_required/);assert.deepEqual(await snapshot(),before);
 });
 test(label+'permissive UPDATE policy still cannot reassign claim identity or capital owner',async()=>{
  for(const [table,sql] of [['territory_claims',`UPDATE public.territory_claims SET owner_id='${b}' WHERE owner_id='${a}'`],['capitals',`UPDATE public.capitals SET owner_id='${b}' WHERE owner_id='${a}'`]]){
   await atomicRejection(`CREATE POLICY synthetic_cleanup_permissive ON public.${table} FOR UPDATE TO authenticated USING(true) WITH CHECK(true);SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='${a}';${sql}`,/ownership_identity_immutable/);
  }
 });
}
