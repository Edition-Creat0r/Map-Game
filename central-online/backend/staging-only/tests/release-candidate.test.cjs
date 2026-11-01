// Real isolated SQL + frozen engine/HTTP handler. GoTrue identities are synthetic.
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {query,as,reset,join,a,b,uuid,rpc}=require('./helpers.cjs');
const territories={[a]:'T_190_27',[b]:'T_140_180'};
let sessions,createHandler,E,freshState;
function handler(){return createHandler({enabled:true,origins:['https://synthetic.test'],auth:async(token)=>[a,b].includes(token)?{id:token,email_confirmed_at:'2026-01-01'}:null,verifySession:async(token,id)=>(await as(token,`SELECT public.map_game_session_heartbeat('central','${id}')`))==='t',rpc});}
async function send(h,actor,input){const r=await h(new Request('https://synthetic.test',{method:'POST',headers:{Authorization:'Bearer '+actor,'Content-Type':'application/json',Origin:'https://synthetic.test'},body:JSON.stringify(input)}));return {status:r.status,body:await r.json()};}
async function economy(){return await query("SELECT coalesce(json_agg(t ORDER BY actor)::text,'[]') FROM cw041.accounts t");}
function site(actor,type,index=0){
 const def=E.defs.find(d=>d.id===type),state=freshState(Date.now());
 // Widely spaced lanes; no candidate in the 150x150 capital reservation at 500.
 for(let z=2000+index*700;z<32000;z+=900)for(let x=2000;x<30000;x+=900)if(E.model.placement(state,def,{territoryId:territories[actor],x,z,rotation:0},E.terrain).allowed)return {x,z};
 throw Error('No synthetic site');
}
function place(actor,type='smallHouse',index=0,operationId=uuid()){return {action:'place',operationId,sessionId:sessions[actor],territoryId:territories[actor],buildingId:type,...site(actor,type,index),rotation:0};}
beforeEach(async()=>{
 await reset();({createHandler}=await import('../../handler.mjs'));const engine=await import('../../engine.mjs');E=engine.serverEngine();freshState=engine.freshState;sessions={};
 for(const actor of [a,b]){
  sessions[actor]=await join(actor);
  await as(actor,`INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','${territories[actor]}','${actor}','Synthetic')`);
  await as(actor,`INSERT INTO public.capitals(world_id,owner_id,owner_username,territory_id,name,x,z) VALUES('central','${actor}','Synthetic','${territories[actor]}','Test city',500,500)`);
 }
 await query('UPDATE cw041.settings SET enabled=true'); // Disposable fixture only.
});
test('two players claim, found capitals, independently build, and share operation UUID without sharing ledgers',async()=>{
 const op=uuid(),h=handler(),pa=place(a,'smallHouse',0,op),pb=place(b,'smallHouse',0,op);
 const [ra,rb]=await Promise.all([send(h,a,pa),send(h,b,pb)]);
 for(const [actor,result] of [[a,ra],[b,rb]]){assert.equal(result.status,200);assert.equal(result.body.building.ownerId,actor);assert.equal(result.body.building.territoryId,territories[actor]);assert.equal(result.body.snapshot.balances.money,String(388000n*300000000000n));}
 assert.equal(await query('SELECT count(*) FROM cw041.accounts'),'2');assert.equal(await query('SELECT count(*) FROM cw041.buildings'),'2');
 assert.equal(await query('SELECT count(*) FROM public.capitals'),'2');assert.equal(await query('SELECT count(*) FROM cw041.operations'),'2');
});
test('foreign land, foreign session, forged actor/balance, forged token and direct RPC spending cannot debit accounts',async()=>{
 const h=handler();assert.equal((await send(h,a,place(a))).status,200);assert.equal((await send(h,b,place(b))).status,200);const before=await economy();
 assert.equal((await send(h,a,{...place(a),territoryId:territories[b]})).status,403);
 assert.equal((await send(h,a,{...place(a),sessionId:sessions[b]})).status,403);
 assert.equal((await send(h,a,{...place(a),actor:b,money:999999999})).status,400);
 assert.equal((await send(h,'synthetic-forged-token',place(a))).status,403);
 await assert.rejects(as(a,`SELECT public.cw041_context('${b}','${uuid()}','{"action":"settle"}')`),/permission denied/);
 await assert.rejects(as(a,`UPDATE cw041.accounts SET revision=999 WHERE actor='${b}'`),/permission denied/);
 assert.equal(await economy(),before);
});
test('concurrent replay charges once and reconnect recovers only its own durable receipt',async()=>{
 const h=handler(),intent=place(a),other=place(b),rows=await Promise.all([send(h,b,other),...Array.from({length:6},()=>send(h,a,intent))]);
 assert.equal(rows[0].status,200);for(const row of rows.slice(1))assert.deepEqual(row,rows[1]);
 assert.equal(await query(`SELECT count(*) FROM cw041.audit WHERE actor='${a}'`),'1');
 const before=await economy();sessions[a]=await join(a);const reconnected=handler();
 const status=await send(reconnected,a,{action:'status',sessionId:sessions[a]});assert.equal(status.status,200);assert.equal(status.body.recent.length,1);assert.equal(status.body.recent[0].operationId,intent.operationId);
 assert.equal(status.body.recent.some(x=>x.operationId===other.operationId),false);
 assert.deepEqual(await send(reconnected,a,{...intent,sessionId:sessions[a]}),rows[1]);
 assert.equal((await send(reconnected,a,{...intent,sessionId:sessions[a],x:intent.x+200})).status,409);
 assert.equal(await economy(),before);assert.equal(await query('SELECT count(*) FROM cw041.buildings'),'2');
});
test('two purchased production chains settle server elapsed time exactly without touching the other account',async()=>{
 const h=handler();
 for(const actor of [a,b])for(const [i,type] of ['smallHouse','powerPlant','cornerStore','carbonPlant'].entries())assert.equal((await send(h,actor,place(actor,type,i))).status,200);
 const other=await query(`SELECT row_to_json(t) FROM cw041.accounts t WHERE actor='${b}'`);
 // Trusted test-clock fixture only. Never accepts a browser timestamp or stock.
 await query(`UPDATE cw041.accounts SET state=jsonb_set(state,'{economy,lastTick}',to_jsonb((state#>>'{economy,lastTick}')::bigint-1800000)) WHERE actor='${a}'`);
 const initial=JSON.parse(await query(`SELECT state FROM cw041.accounts WHERE actor='${a}'`));
 const receipt=await send(h,a,{action:'settle',operationId:uuid(),sessionId:sessions[a]});assert.equal(receipt.status,200);
 const reference=E.model.clone(initial);const advanced=E.model.advance(reference,receipt.body.snapshot.checkpoint,false,E.defs,{maxEvaluations:100000});assert.equal(advanced.complete,true);
 assert.deepEqual(receipt.body.snapshot.balances,reference.economy.precision);
 assert(BigInt(reference.economy.precision.carbon)>BigInt(initial.economy.precision.carbon));
 assert(BigInt(reference.economy.precision.money)>BigInt(initial.economy.precision.money));
 assert.equal(await query(`SELECT row_to_json(t) FROM cw041.accounts t WHERE actor='${b}'`),other);
 assert.deepEqual(JSON.parse(await query(`SELECT state#>'{economy,precision}' FROM cw041.accounts WHERE actor='${a}'`)),reference.economy.precision);
});
test('emergency stop, owner-only session recovery and explicit fixture resumption retain paid receipts and ledgers',async()=>{
 const h=handler(),intent=place(a),original=await send(h,a,intent);assert.equal(original.status,200);assert.equal((await send(h,b,place(b))).status,200);
 const before=await economy(),audits=await query('SELECT count(*) FROM cw041.audit');
 await query(fs.readFileSync(path.join(__dirname,'../../rollback-disable.sql'),'utf8'));
 assert.equal(await query('SELECT enabled FROM cw041.settings'),'f');
 assert.notEqual((await send(h,a,place(a,'smallHouse',1))).status,200);assert.equal(await economy(),before);
 const op=uuid();const recovery=JSON.parse(await query(`SELECT cw041_staging_security.recover_sessions_offline('${op}','${a}','operator_recovery')`));assert.equal(recovery.revokedSessions,1);
 assert.equal(await economy(),before);assert.equal(await query('SELECT count(*) FROM cw041.audit'),audits);
 sessions[a]=await join(a);const restarted=handler();
 // Explicit isolated-test resumption only; production/staging never auto-enable.
 await query("GRANT EXECUTE ON FUNCTION public.cw041_context(uuid,uuid,jsonb),public.cw041_commit(uuid,uuid,bigint,text,jsonb,boolean,bigint,jsonb,jsonb),public.cw041_region(uuid,text),public.cw041_status(uuid) TO service_role;UPDATE cw041.settings SET enabled=true;");
 assert.deepEqual(await send(restarted,a,{...intent,sessionId:sessions[a]}),original);assert.equal(await economy(),before);
 await query('UPDATE cw041.settings SET enabled=false');
});
