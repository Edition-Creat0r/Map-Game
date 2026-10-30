const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {R,P,M,defs,ids,root,epoch,scale,archived,state,drain,runtime}=require('./helpers/industrial-042a.cjs');
test('retained release stays intact: 139/140/5/118/21/14 and advancedMetallurgy is unchanged',()=>{
 assert.equal(R.materialIds.length,139);assert.equal(R.data.buildings.length,140);assert.equal(defs.filter(d=>d.economy&&!d.industrial).length,5);assert.equal(P.manifest.materials.length,118);assert.equal(P.manifest.excluded.length,21);assert.equal(P.research.nodes.length,14);
 const old=archived('industrial/catalog-data.js');
 for(const key of ['materials','buildings','technologies'])for(const item of old[key])assert.deepEqual(R.data[key].find(v=>v.id===item.id),item);
 const research=archived('industrial/research-data.js');for(const n of research.nodes)assert.deepEqual(P.research.nodes.find(v=>v.id===n.id),n);
 assert.equal(P.research.nodes.filter(n=>n.id==='advancedMetallurgy').length,1);
});
test('original 100-manifest is byte-immutable; extensions compose deterministically without mutation',()=>{
 assert.equal(fs.readFileSync(path.join(root,'industrial/player-materials.json'),'utf8'),execFileSync('git',['show','bc8945d:industrial/player-materials.json'],{cwd:root,encoding:'utf8'}));
 assert.deepEqual(P.extensions[0].materials,archived('industrial/player-materials-data.js').materials.filter(m=>!P.baseManifest.materials.some(v=>v.id===m.id)));
 assert.equal(P.baseManifest.materials.length,100);assert.deepEqual(P.extensions.map(e=>e.materials.length),[6,12]);
 const before=JSON.stringify([P.baseManifest,P.extensions]);
 assert.deepEqual(P.composeManifests(P.baseManifest,P.extensions),P.manifest);assert.equal(JSON.stringify([P.baseManifest,P.extensions]),before);
 for(const mutate of [e=>e.reverse(),e=>e[1].version=99,e=>e[1].baseManifestVersion=2,e=>e[1].materials[0].id=e[0].materials[0].id]){
  const ext=M.clone(P.extensions);mutate(ext);assert.throws(()=>P.composeManifests(P.baseManifest,ext));
 }
});
test('acquisition graph includes paid research and construction; no new unused material',()=>{
 const known=new Set(['money','steel','carbon','concrete','glass']),done=new Set(),byId=new Map(defs.map(d=>[d.id,d]));
 const s=state([]);s.economy.progression.completed=[];let passes=0;
 while((known.size<118||done.size<14)&&passes++<139){
  for(const n of P.research.nodes)if(!done.has(n.id)&&n.prerequisites.every(id=>done.has(id))&&Object.keys(n.cost).every(id=>known.has(id))){done.add(n.id);s.economy.progression.completed=[...done];}
  for(const m of P.manifest.materials){const d=byId.get(m.acquisition.building);if(m.id==='money'||known.has(m.id))continue;if(!P.reason(s,d)&&[...Object.keys(d.cost),...Object.keys(d.economy.inputs||{})].every(id=>known.has(id)))known.add(m.id);}
 }
 assert.equal(known.size,118);assert.equal(done.size,14);
 for(const m of P.extensions[1].materials)assert.ok(R.data.buildings.some(b=>b.cost[m.id]>0||b.recipes[0].inputsPerMinute[m.id]>0)||P.research.nodes.some(n=>n.cost[m.id]>0),m.id+' has no consumer');
});
test('new recipe references, amounts and material/research cycles fail closed',()=>{
 for(const patch of [b=>b.recipes[0].inputsPerMinute.missing=1,b=>b.recipes[0].outputsPerMinute.nickel=Infinity,b=>b.recipes[0].inputsPerMinute.nickelOre=-1,b=>b.operating.upkeep=0,b=>b.recipes[0].outputsPerMinute.nickelOre=1,b=>b.recipes[0].outputsPerMinute.money=1,b=>b.visual.existingModelId='missing']){
  const data=M.clone(R.data);patch(data.buildings.find(b=>b.id==='nickelRefinery'));assert.equal(R.validate(data).valid,false);
 }
 const tree=M.clone(P.research);tree.nodes.find(n=>n.id==='advancedMaterialsScience').prerequisites=['telecommunications'];assert.equal(P.validate(P.manifest,tree).valid,false);
 const selfFunding=M.clone(P.research);selfFunding.nodes.find(n=>n.id==='advancedMaterialsScience').cost.graphite=1;assert.equal(P.validate(P.manifest,selfFunding).valid,false);
 const lateCost=M.clone(P.research);lateCost.nodes.find(n=>n.id==='advancedMaterialsScience').cost.machineFrames=1;assert.equal(P.validate(P.manifest,lateCost).valid,false);
 const latePrerequisite=M.clone(P.research);latePrerequisite.nodes.find(n=>n.id==='advancedMaterialsScience').prerequisites.push('industrialAutomation');assert.equal(P.validate(P.manifest,latePrerequisite).valid,false);
 const construction=M.clone(R.data.buildings);construction.find(b=>b.id==='nickelMine').cost.nickel=1;assert.equal(P.validate(P.manifest,P.research,construction).valid,false);
});
test('four new licenses charge exact material costs once and cannot bypass prerequisites or era',()=>{
 const s=state();s.economy.progression.completed=P.research.nodes.slice(0,10).map(n=>n.id);
 const original=archived('industrial/research-data.js').nodes.find(n=>n.id==='advancedMetallurgy');
 assert.deepEqual(P.research.nodes.find(n=>n.id===original.id),original);const unchanged=M.clone(s.economy.precision);assert.equal(P.complete(s,'advancedMetallurgy',M),true);assert.deepEqual(s.economy.precision,unchanged);
 for(const node of P.research.nodes.slice(10)){
  s.economy.progression.era=node.minimumEra-1;const frozen=M.clone(s);assert.equal(P.complete(s,node.id,M),false);assert.deepEqual(s,frozen);s.economy.progression.era=6;
  const before=M.clone(s.economy.precision);assert.equal(P.complete(s,node.id,M),true);
  for(const [k,n] of Object.entries(node.cost))assert.equal(BigInt(s.economy.precision[k]),BigInt(before[k])-BigInt(n)*scale);
  const paid=M.clone(s);assert.equal(P.complete(s,node.id,M),true);assert.deepEqual(s,paid);
 }
});
test('missing research stock prevents payment atomically, including multi-material capstone',()=>{
 for(const node of P.research.nodes.slice(10)){
  const s=state();s.economy.progression.completed=s.economy.progression.completed.filter(id=>id!==node.id);
  const material=Object.keys(node.cost).find(id=>id!=='money');M.spend(s,{[material]:M.quantity(s,material)});
  const before=M.clone(s);assert.equal(P.complete(s,node.id,M),false);assert.deepEqual(s,before);
 }
});
test('all twelve fixed recipes conserve inputs/outputs online and offline exactly',()=>{
 for(const id of ids)for(const online of [false,true]){
  const s=state(['smallHouse','powerPlant',id],{economy:{population:20}}),b=R.building(id),before=M.clone(s.economy.precision);drain(s,epoch+60000,online);
  const amount=n=>BigInt(n)*scale*(online?6n:5n)/5n;
  for(const [k,n] of Object.entries(b.recipes[0].inputsPerMinute))assert.equal(BigInt(s.economy.precision[k]),BigInt(before[k])-amount(n),id+' input '+k);
  for(const [k,n] of Object.entries(b.recipes[0].outputsPerMinute))assert.equal(BigInt(s.economy.precision[k]),BigInt(before[k])+amount(n),id+' output '+k);
 }
});
test('input, upkeep, power and workforce shortages never produce negative or phantom output',()=>{
 for(const [types,extra] of [
  [['smallHouse','powerPlant','nickelRefinery'],{inventory:{nickelOre:0}}],
  [['smallHouse','nickelRefinery'],{}],
  [['smallHouse','powerPlant','nickelRefinery'],{economy:{population:0}}],
  [['smallHouse','powerPlant','nickelRefinery'],{money:0}]
 ]){const s=state(types,extra),before=M.quantity(s,'nickel');drain(s,epoch+10000);assert.equal(M.quantity(s,'nickel'),before);for(const v of Object.values(s.economy.precision))assert.match(v,/^\d+$/);}
});
test('mixed retained/new factories match bounded reference during scarcity/growth/online and offline',()=>{
 const retained=P.extensions[0].materials.map(m=>m.acquisition.building);
 for(const online of [false,true])for(const scarce of [false,true]){
  const s=state([...Array(12).fill('smallHouse'),...Array(6).fill('powerPlant'),...retained,...ids],{economy:{population:scarce?10:240}});
  if(!scarce)assert.ok(M.summary(s,defs).buildings.filter(b=>ids.includes(b.type)).every(b=>b.operating),'Stocked supported city must actually operate all twelve new factories');
  if(scarce)for(const m of P.extensions.flatMap(e=>e.materials))M.spend(s,{[m.id]:M.quantity(s,m.id)});
  const ref=M.clone(s);drain(s,epoch+3600000,online);drain(ref,epoch+3600000,online,{accelerate:false,maxEvaluations:10000});assert.deepEqual(s.economy.precision,ref.economy.precision);
 }
});
test('expanded 1000-year catchup stays uncapped, budgeted, reloadable and replay safe',()=>{
 const s=state([...Array(12).fill('smallHouse'),...Array(6).fill('powerPlant'),...ids]);const target=epoch+1000*365.25*86400000;
 assert.equal(M.advance(s,target,false,defs,{maxEvaluations:1}).complete,false);
 const resumed=M.normalize(M.clone(s),epoch);M.bindContracts(resumed,defs);P.init(resumed,defs);drain(s,target);drain(resumed,target);assert.deepEqual(s.economy.precision,resumed.economy.precision);
 const before=M.clone(s.economy.precision);drain(s,target);assert.deepEqual(s.economy.precision,before);assert.equal(s.economy.lastTick,target);
});
test('d62525e saves retain all original stocks, contracts, research, priorities and manufacturing output',()=>{
 const Old=archived('economy_model.js'),OldP=archived('industrial/progression.js'),oldDefs=defs.filter(d=>!ids.includes(d.id));
 const fixture=state([...Array(5).fill('smallHouse'),...Array(5).fill('powerPlant'),'chromiteMine','chromiumRefinery','stainlessSteelWorks','photoresistWorks','waferFab','servoDriveWorks','stainlessModuleWorks','electricTransportWorks']);
 // Construct the actual prior format with the archived modules, not just renamed fields.
 delete fixture.economy.progression;fixture.economy.rules={};
 for(const m of P.extensions[1].materials){delete fixture.inventory[m.id];delete fixture.economy.precision[m.id];}
 fixture.placedIncomeItems.find(r=>r.type==='stainlessSteelWorks').level=7;
 fixture.placedIncomeItems.find(r=>r.type==='stainlessSteelWorks').specializations={Automation:2};
 const raw=Old.normalize(fixture,epoch);Old.bindContracts(raw,oldDefs);OldP.init(raw,oldDefs);raw.economy.progression.era=6;raw.economy.progression.completed=OldP.research.nodes.map(n=>n.id);raw.custom={keep:true};raw.economy.progression.custom='retain';raw.inventory.futureUnknown={keep:true};
 raw.economy.progression.priorities={mode:'automatic',order:raw.placedIncomeItems.map(r=>r.id),custom:'retain'};
 const frozen=M.clone(raw),s=M.normalize(raw,epoch);M.bindContracts(s,defs);P.init(s,defs);
 assert.deepEqual(raw,frozen);assert.deepEqual(s.economy.rules,raw.economy.rules);assert.deepEqual(s.economy.progression,{...raw.economy.progression,manifestVersion:2});assert.deepEqual(s.custom,raw.custom);assert.deepEqual(s.inventory.futureUnknown,raw.inventory.futureUnknown);
 for(const [id,value] of Object.entries(raw.economy.precision))assert.equal(s.economy.precision[id],value);
 for(const m of P.extensions[1].materials)assert.equal(s.economy.precision[m.id],'0');
 assert.deepEqual(s.placedIncomeItems,raw.placedIncomeItems);
 const oldBefore=M.clone(raw.economy.precision);Old.advance(raw,epoch+60000,true,oldDefs);drain(s,epoch+60000,true);
 assert.ok(BigInt(raw.economy.precision.stainlessSteel)>BigInt(oldBefore.stainlessSteel));
 for(const [id,value] of Object.entries(raw.economy.precision))assert.equal(s.economy.precision[id],value,id);
});
test('unsupported future manifests/research fail closed; manifest migration is idempotent',()=>{
 const raw=state();const source=M.clone(raw);
 raw.economy.progression.manifestVersion=3;assert.throws(()=>M.normalize(raw,epoch),/progression save/);assert.equal(raw.economy.progression.manifestVersion,3);
 const old=M.clone(source);old.economy.progression.manifestVersion=1;assert.throws(()=>M.normalize(old,epoch),/progression save/); // new research cannot masquerade as an older format
 const s=M.normalize(source,epoch);P.init(s,defs);const before=M.clone(s);P.init(s,defs);assert.deepEqual(s,before);
});
test('research after v1/v2 normalization never mutates the original save input',()=>{
 for(const version of [1,2]){
  const raw=state();raw.economy.progression.completed=P.research.nodes.slice(0,10).map(n=>n.id);raw.economy.progression.manifestVersion=version;raw.economy.progression.extra={nested:['retain']};
  const before=M.clone(raw),s=M.normalize(raw,epoch);P.init(s,defs);assert.equal(P.complete(s,'advancedMaterialsScience',M),true);assert.deepEqual(raw,before);
 }
});
test('real Singleplayer purchase API enforces licenses, payment, overlap and persistence for twelve sites',async()=>{
 const s=state(),r=await runtime(s);const initial=r.api.snapshot().money;
 for(const [i,id] of ids.entries()){
  const d=defs.find(d=>d.id===id),site={id:'new-'+i,territoryId:'T_190_27',x:1000+i*220,z:2000,rotation:0};
  assert.equal(r.api.purchaseAndRegisterBuilding(d,site),true,id);const paid=r.api.snapshot().money;assert.equal(r.api.purchaseAndRegisterBuilding(d,site),true);assert.equal(r.api.snapshot().money,paid);
  assert.equal(r.api.purchaseAndRegisterBuilding(d,{...site,id:'overlap-'+i}),false);
 }
 assert.equal(r.api.listPlacedBuildings().length,12);assert.equal(r.api.snapshot().money,initial-ids.reduce((n,id)=>n+R.building(id).cost.money,0));
 const saved=JSON.parse(r.records.get('mapgame_economy_021e'));r.api.stop();const reload=await runtime(saved);assert.equal(reload.api.listPlacedBuildings().length,12);assert.deepEqual(reload.api.snapshot().economy.rules,saved.economy.rules);
 const noLicense=state();noLicense.economy.progression.completed=P.research.nodes.slice(0,10).map(n=>n.id);const locked=await runtime(noLicense);assert.notEqual(locked.api.purchaseReason('fiberOpticWorks'),'');
 const fail=await runtime(state());const before=fail.api.snapshot();fail.failStorage();assert.equal(fail.api.purchaseAndRegisterBuilding(defs.find(d=>d.id==='nickelMine'),{id:'fail',territoryId:'T_190_27',x:1000,z:2000}),false);assert.equal(fail.api.snapshot().money,before.money);assert.equal(fail.api.listPlacedBuildings().length,0);
});
test('worker composes all extensions and preserves exact mixed-chain simulation',()=>{
 let response;const ctx={console,postMessage:r=>response=r};ctx.self=ctx;vm.createContext(ctx);ctx.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f.split('?')[0]),'utf8'),ctx);};
 vm.runInContext(fs.readFileSync(path.join(root,'economy_worker.js'),'utf8'),ctx);assert.equal(ctx.mapGameProgression.manifest.materials.length,118);
 const s=state([...Array(12).fill('smallHouse'),...Array(6).fill('powerPlant'),...ids]),ref=M.clone(s);ctx.onmessage({data:{state:s,defs,target:epoch+3600000,online:true}});assert.equal(response.error,undefined);drain(ref,epoch+3600000,true);assert.deepEqual(JSON.parse(JSON.stringify(response.state.economy.precision)),ref.economy.precision);
});
