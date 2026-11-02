const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const {query,as,reset,join,a,b,uuid}=require('./helpers.cjs');
beforeEach(reset);
const sessions=()=>query('SELECT json_agg(t ORDER BY session_id) FROM public.world_sessions t');
async function seedOther(actor=a){const id=uuid();await query(`INSERT INTO public.world_sessions(world_id,session_id,user_id,username) VALUES('other','${id}','${actor}','Synthetic')`);return id;}
test('both start overloads reject own other-world session collision without moving or deleting sessions',async()=>{
 await join(a);await join(b);const other=await seedOther(),before=await sessions();
 for(const args of [`'central','${other}','Synthetic'`,`'device','${other}','Synthetic','central'`]){
  await assert.rejects(as(a,`SELECT public.map_game_start_session(${args})`),/session_world_mismatch/);assert.equal(await sessions(),before);
 }
});
test('concurrent cross-world collisions cannot promote an old other-world ID to Central',async()=>{
 await join(a);const other=await seedOther(),before=await sessions();
 const results=await Promise.allSettled(Array.from({length:6},(_,i)=>as(a,`SELECT public.map_game_start_session(${i%2?`'device','${other}','Synthetic','central'`:`'central','${other}','Synthetic'`})`)));
 assert.ok(results.every(x=>x.status==='rejected'&&/session_world_mismatch/.test(x.reason.message)));assert.equal(await sessions(),before);
});
test('heartbeat/end reject other-world requests and cannot alter other-world rows through Central',async()=>{
 await join(a);const other=await seedOther(),before=await sessions();
 for(const fn of ['map_game_session_heartbeat','map_game_end_session'])await assert.rejects(as(a,`SELECT public.${fn}('other','${other}')`),/verified_central_actor_required/);
 assert.equal(await as(a,`SELECT public.map_game_session_heartbeat('central','${other}')`),'f');
 assert.equal(await as(a,`SELECT public.map_game_end_session('central','${other}')`),'t');assert.equal(await sessions(),before);
});
test('username/device values cannot choose another actor in either session overload',async()=>{
 await join(b);const id=uuid();
 await as(a,`SELECT public.map_game_start_session('central','${id}','${b}')`);
 await as(a,`SELECT public.map_game_start_session('${b}','${id}','${b}','central')`);
 assert.equal(await query(`SELECT user_id FROM public.world_sessions WHERE session_id='${id}'`),a);
});
test('world table and column writes remain denied even under an accidentally permissive RLS policy',async()=>{
 const before=await query('SELECT json_agg(t ORDER BY id) FROM public.worlds t');
 for(const role of ['anon','authenticated'])for(const sql of ["INSERT INTO public.worlds(id,name) VALUES('unapproved','Synthetic')","UPDATE public.worlds SET name='Changed' WHERE id='central'","DELETE FROM public.worlds WHERE id='central'"]){
  await assert.rejects(query(`BEGIN;CREATE POLICY synthetic_worlds_policy ON public.worlds FOR ALL TO ${role} USING(true) WITH CHECK(true);SET LOCAL ROLE ${role};${sql};COMMIT;`),/permission denied/);
  assert.equal(await query('SELECT json_agg(t ORDER BY id) FROM public.worlds t'),before);
 }
});
test('effective player world DML and column grants are absent while authenticated SELECT is preserved',async()=>{
 for(const role of ['anon','authenticated']){
  for(const priv of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(await query(`SELECT has_table_privilege('${role}','public.worlds','${priv}')`),'f');
  for(const col of ['id','name','created_at'])for(const priv of ['INSERT','UPDATE','REFERENCES'])assert.equal(await query(`SELECT has_column_privilege('${role}','public.worlds','${col}','${priv}')`),'f');
 }
 assert.equal(await query("SELECT has_table_privilege('authenticated','public.worlds','SELECT')"),'t');
});
