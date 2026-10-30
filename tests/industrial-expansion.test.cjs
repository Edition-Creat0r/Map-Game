const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const R=require('../industrial/registry.js'),P=require('../industrial/progression.js'),M=require('../economy_model.js');
const root=path.resolve(__dirname,'..'),epoch=1800000000000,scale=300000000000n;
const materialIds=['chromiteOre','chromium','stainlessSteel','photoresist','siliconWafers','servoDrives'];
const buildingIds=['chromiteMine','chromiumRefinery','stainlessSteelWorks','photoresistWorks','waferFab','servoDriveWorks','stainlessModuleWorks','electricTransportWorks'];
const researchIds=['advancedMetallurgy','precisionFabrication','industrialAutomation'];
const context={window:{mapGameIndustrialRegistry:R},console:{log(){}}};
for(const file of ['buildings.js','industrial/integration.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const defs=M.clone(context.window.mapGameBuildings.CATALOG);
function fromBase(file){return execFileSync('git',['show','bc8945d:'+file],{cwd:root,encoding:'utf8'});}
function oldModule(file,cache=new Map()){
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const req=p=>oldModule(path.posix.normalize(path.posix.join(path.posix.dirname(file),p)),cache);
 new Function('require','module','exports',fromBase(file))(req,mod,mod.exports);
 return mod.exports;
}
function city(types=[],extra={}){
 const inventory=Object.fromEntries(R.materialIds.filter(id=>!M.RESOURCES.includes(id)).map(id=>[id,100000]));
 const s=M.normalize({money:1e9,steel:100000,carbon:100000,concrete:100000,glass:100000,inventory,
  ...extra,placedIncomeItems:types.map((type,i)=>({id:'b'+i,type,progressionAcquired:1,territoryId:'T_190_27',x:500+i*200,z:500,rotation:0})),
  economy:{version:4,lastTick:epoch,population:60,...extra.economy}},epoch);
 M.bindContracts(s,defs);P.init(s,defs);
 s.economy.progression.era=6;s.economy.progression.completed=P.research.nodes.map(n=>n.id);
 return s;
}
function drain(s,target,online=false,options={}){let r,passes=0;do{r=M.advance(s,target,online,defs,options);assert.ok(++passes<5000);}while(!r.complete);return passes;}
test('bounded expansion preserves every existing material, factory, license and unlock record verbatim',()=>{
 const old=JSON.parse(fromBase('industrial/catalog.json'));
 assert.equal(R.materialIds.length,139);assert.equal(R.data.buildings.length,140);assert.equal(defs.filter(d=>d.economy).length,145);
 for(const key of ['materials','buildings','technologies'])for(const item of old[key])assert.deepEqual(R.data[key].find(x=>x.id===item.id),item);
 for(const key of ['materials','excluded'])for(const item of JSON.parse(fromBase('industrial/player-materials.json'))[key])assert.deepEqual(P.manifest[key].find(x=>x.id===item.id),item);
 for(const item of JSON.parse(fromBase('industrial/research.json')).nodes)assert.deepEqual(P.research.nodes.find(x=>x.id===item.id),item);
});
test('every new material is unique, produced and consumed by a reachable licensed chain',()=>{
 assert.equal(new Set(R.materialIds).size,R.materialIds.length);
 for(const id of materialIds){
  const entry=P.manifest.materials.find(m=>m.id===id),producer=R.building(entry.acquisition.building);
  assert.ok(producer.recipes[0].outputsPerMinute[id]>0);
  assert.ok(R.data.buildings.some(b=>b.recipes[0].inputsPerMinute[id]>0),'No consumer: '+id);
  assert.ok(entry.unlockRequirements.every(id=>P.research.nodes.some(n=>n.id===id)));
  assert.ok(R.topological.includes(id));
 }
 for(const id of buildingIds){const d=defs.find(d=>d.id===id);assert.equal(P.reason(city(),d),'');assert.ok(d.researchRequirements.length);}
});
test('new recipes reject undefined references, unsafe numbers, duplicate recipes and circular/free production',()=>{
 for(const mutate of [
  b=>{b.recipes[0].inputsPerMinute.ghost=1},
  b=>{b.recipes[0].outputsPerMinute.chromium=NaN},
  b=>{b.operating.upkeep=Infinity},
  b=>{b.recipes[0].inputsPerMinute.chromiteOre=-1},
  b=>{b.recipes[0].inputsPerMinute={}},
  b=>{b.recipes[0].outputsPerMinute.chromiteOre=1},
  b=>{b.recipes[0].outputsPerMinute.money=1},
  b=>{b.researchRequirements=['invalid research id']}
 ]){const d=M.clone(R.data);mutate(d.buildings.find(b=>b.id==='chromiumRefinery'));assert.equal(R.validate(d).valid,false);}
 const t=M.clone(P.research);t.nodes.find(n=>n.id==='industrialAutomation').cost.money=NaN;assert.equal(P.validate(P.manifest,t).valid,false);
 const p=M.clone(P.manifest);p.materials.find(m=>m.id==='servoDrives').unlockRequirements=['missing'];assert.equal(P.validate(p).valid,false);
});
test('three appended research nodes enforce prerequisites, era, exact costs and idempotency',()=>{
 const s=city();s.economy.progression.completed=[];s.economy.progression.era=6;
 assert.equal(P.complete(s,'advancedMetallurgy',M),false);
 for(const n of P.research.nodes.filter(n=>!n.minimumEra))assert.equal(P.complete(s,n.id,M),true);
 for(const [i,id] of researchIds.entries()){
  const node=P.research.nodes.find(n=>n.id===id);
  s.economy.progression.era=node.minimumEra-1;
  const before=M.clone(s);assert.equal(P.complete(s,id,M),false);assert.deepEqual(s,before);
  s.economy.progression.era=6;const balance=BigInt(s.economy.precision.money);
  assert.equal(P.complete(s,id,M),true);assert.equal(BigInt(s.economy.precision.money),balance-BigInt(node.cost.money)*scale);
  const paid=s.economy.precision.money;assert.equal(P.complete(s,id,M),true);assert.equal(s.economy.precision.money,paid);
 }
});
test('new factory licenses cannot be bypassed using an old fully researched save',()=>{
 const s=city();s.economy.progression.completed=JSON.parse(fromBase('industrial/research.json')).nodes.map(n=>n.id);
 assert.equal(P.manifest.materials.filter(m=>P.unlocked(s,m.id)).length,100);
 for(const id of buildingIds)assert.notEqual(P.reason(s,defs.find(d=>d.id===id)),'');
 for(const id of researchIds)assert.equal(P.complete(s,id,M),true);
 assert.equal(P.manifest.materials.filter(m=>P.unlocked(s,m.id)).length,110);
});
test('new advancements recognize actual expansion research without changing old goals or awarding resources',()=>{
 const F=require('../modern-frontier/model.js');
 const old=oldModule('modern-frontier/model.js');
 for(const goal of old.goals)assert.deepEqual(F.goals.find(g=>g.id===goal.id),goal);
 let progress=F.advance({}, {research:7});
 assert.ok(progress.completed.includes('innovator'));
 assert.equal(progress.completed.includes('metallurgyLicense'),false);
 progress=F.advance(progress,{research:10,advancedMetallurgy:1,precisionFabrication:1,industrialAutomation:1});
 for(const id of ['metallurgyLicense','fabricationLicense','automationLicense'])assert.ok(progress.completed.includes(id));
 assert.equal(progress.pins.length,0);assert.equal(progress.money,undefined);
});
test('expansion licenses cannot prematurely complete the original seven-introductory-research goal',()=>{
 const F=require('../modern-frontier/model.js');
 const done=['basicIndustry','miningRefining','constructionTechnology','electricity','electronicsFoundations','advancedMetallurgy','precisionFabrication'];
 const metrics=F.researchMetrics(done);
 assert.equal(metrics.research,5);assert.equal(metrics.advancedMetallurgy,1);
 assert.equal(F.advance({},metrics).completed.includes('innovator'),false);
 assert.equal(F.advance({},F.researchMetrics([...done,'urbanDevelopment','industrialMachinery'])).completed.includes('innovator'),true);
});
test('each new recipe conserves exact per-minute inputs/outputs and the online 1.2x bonus',()=>{
 for(const id of buildingIds)for(const online of [false,true]){
  const s=city(['smallHouse','powerPlant',id],{economy:{population:20}}),d=R.building(id),before=M.clone(s.economy.precision);
  drain(s,epoch+60000,online);
  const multiply=n=>BigInt(n)*scale*(online?6n:5n)/5n;
  for(const [k,n] of Object.entries(d.recipes[0].inputsPerMinute))assert.equal(BigInt(s.economy.precision[k]),BigInt(before[k])-multiply(n),id+' consumes '+k);
  for(const [k,n] of Object.entries(d.recipes[0].outputsPerMinute))assert.equal(BigInt(s.economy.precision[k]),BigInt(before[k])+multiply(n),id+' produces '+k);
 }
});
test('input, power, workforce and upkeep shortages block factories without negative or NaN balances',()=>{
 for(const [types,extra] of [
  [['smallHouse','powerPlant','chromiumRefinery'],{inventory:{chromiteOre:0,industrialAcid:0}}],
  [['smallHouse','chromiumRefinery'],{}],
  [['smallHouse','powerPlant','chromiumRefinery'],{economy:{population:0}}],
  [['smallHouse','powerPlant','chromiumRefinery'],{money:0}]
 ]){const s=city(types,extra);const before=M.quantity(s,'chromium');drain(s,epoch+10000);assert.equal(M.quantity(s,'chromium'),before);for(const v of Object.values(s.economy.precision))assert.ok(/^\d+$/.test(v));}
});
test('mixed expanded chains agree with bounded reference across scarcity, growth and online/offline intervals',()=>{
 for(const online of [false,true])for(const scarce of [false,true]){
  const s=city(['smallHouse','smallHouse','smallHouse','powerPlant','powerPlant',...buildingIds],{economy:{population:scarce?12:60}});
  if(scarce)for(const k of ['chromiteOre','chromium','stainlessSteel','photoresist','siliconWafers','servoDrives'])M.spend(s,{[k]:M.quantity(s,k)});
  const ref=M.clone(s);drain(s,epoch+3600000,online);drain(ref,epoch+3600000,online,{accelerate:false,maxEvaluations:10000});
  assert.deepEqual(s.economy.precision,ref.economy.precision);
 }
});
test('expanded long offline catch-up remains uncapped, incremental and replay safe',()=>{
 const s=city(['smallHouse','smallHouse','smallHouse','powerPlant','powerPlant',...buildingIds]);
 const target=epoch+1000*365.25*86400000;
 const first=M.advance(s,target,false,defs,{maxEvaluations:1});assert.equal(first.complete,false);
 drain(s,target,false,{maxEvaluations:64});assert.equal(s.economy.lastTick,target);
 const ledger=M.clone(s.economy.precision);drain(s,target);assert.deepEqual(s.economy.precision,ledger);
});
test('worker imports the expanded catalog and returns the same exact industrial ledger',()=>{
 let response;const ctx={console,postMessage:value=>{response=value}};ctx.self=ctx;
 vm.createContext(ctx);
 ctx.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file.split('?')[0]),'utf8'),ctx);};
 vm.runInContext(fs.readFileSync(path.join(root,'economy_worker.js'),'utf8'),ctx);
 assert.equal(ctx.mapGameIndustrialRegistry.materialIds.length,139);
 const s=city(['smallHouse','smallHouse','smallHouse','powerPlant','powerPlant',...buildingIds]),ref=M.clone(s);
 ctx.onmessage({data:{state:s,defs,target:epoch+3600000,online:true}});
 assert.equal(response.error,undefined);drain(ref,epoch+3600000,true);
 assert.deepEqual(JSON.parse(JSON.stringify(response.state.economy.precision)),ref.economy.precision);
});
test('baseline save reload retains unknown fields, inventories, pinned contracts and all earned progress',()=>{
 const Old=oldModule('economy_model.js'),OldP=oldModule('industrial/progression.js');
 const oldDefs=defs.filter(d=>!buildingIds.includes(d.id));
 const raw={money:400000,steel:100,carbon:40,custom:{retain:true},inventory:{copper:17.25,unknownFuture:{keep:true}},placedIncomeItems:['smallHouse','powerPlant','steelMill'].map((type,i)=>({id:'old-'+i,type})),economy:{version:4,lastTick:epoch,population:20,custom:'keep'}};
 const original=Old.normalize(raw,epoch);Old.bindContracts(original,oldDefs);OldP.init(original,oldDefs,{legacy:true});
 original.economy.progression.era=6;original.economy.progression.completed=OldP.research.nodes.map(n=>n.id);
 const frozen=M.clone(original),s=M.normalize(original,epoch);M.bindContracts(s,defs);P.init(s,defs);
 assert.deepEqual(original,frozen);assert.deepEqual(s.custom,original.custom);assert.deepEqual(s.inventory.unknownFuture,original.inventory.unknownFuture);
 assert.deepEqual(s.economy.rules,original.economy.rules);assert.deepEqual(s.economy.progression,{...original.economy.progression,manifestVersion:2});
 for(const [id,value] of Object.entries(original.economy.precision))assert.equal(s.economy.precision[id],value);
 for(const id of materialIds)assert.equal(s.economy.precision[id],'0');
 Old.advance(original,epoch+3600000,true,oldDefs);drain(s,epoch+3600000,true);
 assert.ok(original.steel>100,'Legacy factory must actually operate in this compatibility fixture');
 for(const [id,value] of Object.entries(original.economy.precision))assert.equal(s.economy.precision[id],value,'Old ledger changed: '+id);
 const again=M.normalize(JSON.parse(JSON.stringify(s)),s.economy.lastTick);M.bindContracts(again,defs);assert.deepEqual(again.economy.precision,s.economy.precision);
});
