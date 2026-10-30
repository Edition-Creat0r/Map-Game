const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const R=require('../../industrial/registry.js'),P=require('../../industrial/progression.js'),M=require('../../economy_model.js');
const root=path.resolve(__dirname,'../..'),epoch=1800000000000,scale=300000000000n;
const ids=require('../../industrial/player-materials-042a.json').materials.map(m=>m.acquisition.building);
const c={window:{mapGameIndustrialRegistry:R},console:{log(){}}};
for(const f of ['buildings.js','industrial/integration.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const defs=M.clone(c.window.mapGameBuildings.CATALOG);
function archived(file,ref='d62525e',cache=new Map()){
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const require=p=>archived(path.posix.normalize(path.posix.join(path.posix.dirname(file),p)),ref,cache);
 new Function('require','module','exports',execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8'}))(require,module,module.exports);
 return module.exports;
}
function state(types=[],extra={}){
 const inventory=Object.fromEntries(R.materialIds.filter(id=>!M.RESOURCES.includes(id)).map(id=>[id,100000]));
 const s=M.normalize({money:1e9,steel:100000,carbon:100000,concrete:100000,glass:100000,inventory,
  ...extra,placedIncomeItems:types.map((type,i)=>({id:'b'+i,type,progressionAcquired:1,territoryId:'T_190_27',x:500+i*220,z:500,rotation:0})),
  economy:{version:4,lastTick:epoch,population:100,...extra.economy}},epoch);
 M.bindContracts(s,defs);P.init(s,defs);s.economy.progression.era=6;s.economy.progression.completed=P.research.nodes.map(n=>n.id);
 return s;
}
function drain(s,target,online=false,options={}){let r,passes=0,evaluations=0;do{r=M.advance(s,target,online,defs,options);evaluations+=r.evaluations;if(++passes>10000)throw Error('Catch-up did not converge');}while(!r.complete);return{passes,evaluations};}
async function runtime(raw){
 const records=new Map(raw?[["mapgame_economy_021e",JSON.stringify(raw)]]:[]);let failure=false;
 const context={window:{mapGameEconomyModel:M,mapGameProgression:P,mapGameBuildings:{CATALOG:defs},mapGameSharedTerrain:{local:()=>({water:false,steepness:0,buildability:'BUILDABLE'})},addEventListener(){},dispatchEvent(){}},
  document:{hidden:false,addEventListener(){}},navigator:{locks:{request:async(n,o,fn)=>fn({})}},
  localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(failure)throw Error('Simulated storage failure');records.set(k,v)}},
  Date:{now:()=>epoch},performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,CustomEvent:function(){},console};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'economy.js'),'utf8'),context);
 const api=context.window.mapGameEconomy;api.start();await new Promise(setImmediate);
 return{api,records,failStorage:()=>{failure=true;}};
}
module.exports={R,P,M,defs,ids,root,epoch,scale,archived,state,drain,runtime};
