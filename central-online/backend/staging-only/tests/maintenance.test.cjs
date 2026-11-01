const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const {query,as,reset,join,a,b,uuid}=require('./helpers.cjs');
const fn='cw041_staging_security.recover_sessions_offline';
const call=(op,actor=a,reason='operator_recovery')=>`SELECT ${fn}('${op}','${actor}','${reason}')`;
const recover=async(op,actor=a,reason)=>JSON.parse(await query(call(op,actor,reason)));
beforeEach(reset);
test('recovery function and audit are inaccessible to anon, authenticated and service roles',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  assert.equal(await query(`SELECT has_function_privilege('${role}','${fn}(uuid,uuid,text)','EXECUTE')`),'f');
  for(const permission of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await query(`SELECT has_table_privilege('${role}','cw041_staging_security.session_recovery_audit','${permission}')`),'f');
  await assert.rejects(as(a,call(uuid()),role),/permission denied/);
  await assert.rejects(as(a,'SELECT * FROM cw041_staging_security.session_recovery_audit',role),/permission denied/);
 }
});
test('recovery requires economy OFF and validates fixed reason, operation and real target',async()=>{
 const id=await join(a);await query('UPDATE cw041.settings SET enabled=true');
 await assert.rejects(recover(uuid()),/maintenance_requires_disabled_backend/);
 await query('UPDATE cw041.settings SET enabled=false');
 await assert.rejects(recover(uuid(),a,'arbitrary_sql'),/invalid_recovery_request/);
 await assert.rejects(query(`SELECT ${fn}(NULL,'${a}','operator_recovery')`),/invalid_recovery_request/);
 await assert.rejects(recover(uuid(),uuid()),/recovery_actor_missing/);
 assert.equal(await as(a,`SELECT public.map_game_session_heartbeat('central','${id}')`),'t');
 assert.equal(await query('SELECT count(*) FROM cw041_staging_security.session_recovery_audit'),'0');
});
test('recovery revokes only selected actor Central sessions, retains membership and economy state, and audits once',async()=>{
 await join(a);const other=await join(b);
 await query(`INSERT INTO cw041.accounts(actor) VALUES('${a}'),('${b}')`);
 const old=await query('SELECT json_agg(t ORDER BY actor) FROM cw041.accounts t');
 // Separate world session is an inherited legacy record, not a new permitted RPC.
 const elsewhere=uuid();await query(`INSERT INTO public.world_sessions(world_id,session_id,user_id) VALUES('other','${elsewhere}','${a}')`);
 const op=uuid(),receipt=await recover(op);
 assert.equal(receipt.revokedSessions,1);assert.equal(receipt.operationId,op);
 assert.equal(await query(`SELECT count(*) FROM public.world_sessions WHERE session_id='${elsewhere}'`),'1');
 assert.equal(await as(b,`SELECT public.map_game_session_heartbeat('central','${other}')`),'t');
 assert.equal(await query('SELECT count(*) FROM public.world_members'),'2');
 assert.equal(await query('SELECT json_agg(t ORDER BY actor) FROM cw041.accounts t'),old);
 const row=JSON.parse(await query('SELECT row_to_json(t) FROM cw041_staging_security.session_recovery_audit t'));
 assert.equal(row.operator_name,'postgres');assert.equal(row.reason,'operator_recovery');assert.deepEqual(row.receipt,receipt);
});
test('idempotent recovery replay cannot revoke a newly rejoined session or change targets',async()=>{
 await join(a);await join(b);const op=uuid(),first=await recover(op);
 const replacement=await join(a);
 assert.deepEqual(await recover(op),first);
 assert.equal(await as(a,`SELECT public.map_game_session_heartbeat('central','${replacement}')`),'t');
 await assert.rejects(recover(op,b),/recovery_operation_mismatch/);
 await assert.rejects(recover(op,a,'stale_session'),/recovery_operation_mismatch/);
 assert.equal(await query('SELECT count(*) FROM cw041_staging_security.session_recovery_audit'),'1');
});
test('concurrent identical recovery operations produce one audit and one receipt',async()=>{
 await join(a);const op=uuid(),rows=await Promise.all(Array.from({length:6},()=>recover(op)));
 for(const row of rows)assert.deepEqual(row,rows[0]);assert.equal(rows[0].revokedSessions,1);
 assert.equal(await query('SELECT count(*) FROM cw041_staging_security.session_recovery_audit'),'1');
});
test('transaction rollback restores session and removes recovery audit atomically',async()=>{
 const id=await join(a),op=uuid();
 await assert.rejects(query(`BEGIN;${call(op)};DO $$BEGIN RAISE EXCEPTION 'synthetic_failure';END$$;COMMIT;`),/synthetic_failure/);
 assert.equal(await query('SELECT count(*) FROM cw041_staging_security.session_recovery_audit'),'0');
 assert.equal(await query(`SELECT count(*) FROM public.world_sessions WHERE session_id='${id}'`),'1');
});

test('accidental schema/EXECUTE grant cannot turn a player role into the maintenance owner',async()=>{
 const id=await join(a),op=uuid();
 await assert.rejects(query(`BEGIN;GRANT USAGE ON SCHEMA cw041_staging_security TO authenticated;GRANT EXECUTE ON FUNCTION ${fn}(uuid,uuid,text) TO authenticated;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${a}',true);${call(op)};COMMIT;`),/staging_operator_required/);
 assert.equal(await query('SELECT count(*) FROM cw041_staging_security.session_recovery_audit'),'0');
 assert.equal(await query(`SELECT count(*) FROM public.world_sessions WHERE session_id='${id}'`),'1');
 assert.equal(await query(`SELECT has_function_privilege('authenticated','${fn}(uuid,uuid,text)','EXECUTE')`),'f');
});
