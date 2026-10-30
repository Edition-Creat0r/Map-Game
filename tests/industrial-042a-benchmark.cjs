// All twenty expansion factories operate under the unchanged exact solver.
const {performance}=require('node:perf_hooks'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {R,P,M,defs,ids,epoch,drain,archived}=require('./helpers/industrial-042a.cjs');
const out=process.argv[2]||'/tmp/industrial-042a-benchmark';fs.mkdirSync(out,{recursive:true});
const prior=['chromiteMine','chromiumRefinery','stainlessSteelWorks','photoresistWorks','waferFab','servoDriveWorks','stainlessModuleWorks','electricTransportWorks'];
const pattern=[...Array(12).fill('smallHouse'),...Array(8).fill('powerPlant'),...prior,...ids];
function fixture(count,scarce){
 const rows=Array.from({length:count},(_,i)=>({id:'b'+i,type:pattern[i%pattern.length],progressionAcquired:1}));
 const stock=Object.fromEntries(R.materialIds.filter(id=>!M.RESOURCES.includes(id)).map(id=>[id,scarce?3:1e8]));
 const s=M.normalize({money:1e12,steel:1e8,carbon:1e8,concrete:1e8,glass:1e8,inventory:stock,placedIncomeItems:rows,economy:{version:4,lastTick:epoch,population:rows.filter(r=>r.type==='smallHouse').length*20}},epoch);M.bindContracts(s,defs);P.init(s,defs);s.economy.progression.era=6;s.economy.progression.completed=P.research.nodes.map(n=>n.id);return s;
}
const report=[];
for(const count of [100,1000,10000])for(const scarce of [false,true]){
 const a=fixture(count,scarce),b=M.clone(a);drain(a,epoch+600000,true);drain(b,epoch+600000,true,{accelerate:false,maxEvaluations:10000});assert.deepEqual(a.economy.precision,b.economy.precision);
 const times=[],preparation=[];let work;
 for(let i=0;i<7;i++){
  let t=performance.now();const s=fixture(count,scarce);const prepared=performance.now()-t;t=performance.now();work=drain(s,epoch+1000*365.25*86400000,false,{maxEvaluations:64});const elapsed=performance.now()-t;
  if(i>=2){times.push(elapsed);preparation.push(prepared);}
 }
 const sorted=[...times].sort((a,b)=>a-b),prep=[...preparation].sort((a,b)=>a-b);
 const row={count,scenario:scarce?'mixed-scarce':'mixed-stocked',years:1000,warmups:2,samples:5,medianMs:sorted[2],minMs:sorted[0],maxMs:sorted[4],preparationMedianMs:prep[2],rawSamples:times,...work,tenMinuteReferenceAgreement:true};report.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
// Same saved fixture, alternating order, actual archived modules and unchanged
// work/constraints. New zero-valued ledger slots are checked separately.
const Old=archived('economy_model.js'),OldP=archived('industrial/progression.js'),oldDefs=defs.filter(d=>!ids.includes(d.id));
const paired=[];
for(const count of [100,1000,10000]){
 const chain=['smallHouse','smallHouse','powerPlant','ironMine','coalMine','ironSmelter','cokeWorks','steelFoundry','cornerStore'];
 const saved=Old.normalize({money:1e12,steel:100,carbon:40,iron:0,inventory:{ironOre:3,coal:2},placedIncomeItems:Array.from({length:count},(_,i)=>({id:'p'+i,type:chain[i%chain.length]})),economy:{version:4,lastTick:epoch,population:count*10}},epoch);
 Old.bindContracts(saved,oldDefs);OldP.init(saved,oldDefs,{legacy:true});saved.economy.progression.era=6;saved.economy.progression.completed=OldP.research.nodes.map(n=>n.id);
 const samples={baseline:[],candidate:[]};
 for(let i=0;i<12;i++){
  const ledgers={};
  for(const label of i%2?['candidate','baseline']:['baseline','candidate']){
   const model=label==='baseline'?Old:M,progress=label==='baseline'?OldP:P,catalog=label==='baseline'?oldDefs:defs;
   const s=model.normalize(saved,epoch);model.bindContracts(s,catalog);progress.init(s,catalog);
   const begin=performance.now();let result;do{result=model.advance(s,epoch+1000*365.25*86400000,false,catalog,{maxEvaluations:64})}while(!result.complete);
   if(i>=3)samples[label].push(performance.now()-begin);ledgers[label]=s.economy.precision;
  }
  for(const [id,value] of Object.entries(ledgers.baseline))assert.equal(ledgers.candidate[id],value,id);
  for(const m of P.extensions[1].materials)assert.equal(ledgers.candidate[m.id],'0');
 }
 const stats=values=>{const x=[...values].sort((a,b)=>a-b);return{medianMs:x[4],minMs:x[0],maxMs:x[8],rawSamples:values}};
 const row={count,warmups:3,samples:9,baseline:stats(samples.baseline),candidate:stats(samples.candidate),exactOriginalLedgerAgreement:true};paired.push(row);console.log(JSON.stringify({paired:row}));
}
fs.writeFileSync(path.join(out,'paired-results.json'),JSON.stringify(paired,null,2));
