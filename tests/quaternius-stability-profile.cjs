// Diagnostic only: local isolated showroom; no game entry or backend requests.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:8025';
const out=path.resolve(process.env.OUT_DIR||'graphics-prototype/quaternius-prototypes/evidence/stability-phase2/profile');
fs.mkdirSync(out,{recursive:true});
const samples=Number(process.env.FRAME_SAMPLES||48);
assert(Number.isInteger(samples)&&samples>=2,'FRAME_SAMPLES must be an integer >= 2');
const report={scope:'Chromium SwiftShader diagnostics with CPU/heap sampling overhead; not the matched FPS benchmark or Lenovo validation.',samples,rows:[],assetLoads:[]};
async function heap(cdp){return (await cdp.send('Runtime.getHeapUsage'));}
async function segment(page,orbit){
 return page.evaluate(async ({samples,orbit})=>{
  const s=quaterniusShowroom,initial=s.pool.stats(),tasks=[];
  const cpu=new BABYLON.SceneInstrumentation(s.scene);cpu.captureFrameTime=true;cpu.captureRenderTime=true;cpu.captureActiveMeshesEvaluationTime=true;
  const gpu=new BABYLON.EngineInstrumentation(s.engine);gpu.captureGPUFrameTime=true;
  const observer=new PerformanceObserver(l=>tasks.push(...l.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
  s.resetMetrics();
  for(let i=0;i<samples+1;i++){if(orbit)s.camera.alpha=-Math.PI*.68+Math.sin(i/(samples-1)*Math.PI*2)*.12;await new Promise(requestAnimationFrame);}
  const result={...s.metrics(),cpuFrameMs:cpu.frameTimeCounter.average,cpuRenderMs:cpu.renderTimeCounter.average,cpuActiveMs:cpu.activeMeshesEvaluationTimeCounter.average,gpuQuerySupported:!!s.engine.getCaps().timerQuery,gpuFrameMs:gpu.gpuFrameTimeCounter.average/1e6,gpuSamples:gpu.gpuFrameTimeCounter.count,bufferUploads:s.pool.stats().bufferUploads-initial.bufferUploads,cullingPasses:s.pool.stats().cullingPasses-initial.cullingPasses,longTasks:tasks.concat(observer.takeRecords().map(e=>e.duration))};
  observer.disconnect();cpu.dispose();gpu.dispose();return result;
 },{samples,orbit});
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const count of [10,50,100,250]){
   const p=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],failed=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));p.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
   const cdp=await p.context().newCDPSession(p);await cdp.send('Performance.enable');
   const start=performance.now();await p.goto(base+'/graphics-prototype/quaternius-prototypes/?count='+count+'&quality=high');
   await p.waitForFunction(()=>window.quaterniusShowroom?.ready,null,{timeout:90000});
   const readyMs=performance.now()-start,readyHeap=await heap(cdp),startup=await p.evaluate(()=>quaterniusShowroom.metrics());
   await p.evaluate(async()=>{for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);});
   await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768});
   const beforeHeap=await heap(cdp),stationary=await segment(p,false),orbit=await segment(p,true),afterHeap=await heap(cdp);
   const {profile:cpu}=await cdp.send('Profiler.stop'),{profile:allocations}=await cdp.send('HeapProfiler.stopSampling');
   const nodes=new Map(cpu.nodes.map(n=>[n.id,n])),cost={};
   for(let i=0;i<(cpu.samples||[]).length;i++){const frame=nodes.get(cpu.samples[i]).callFrame,key=frame.functionName+' @ '+frame.url.split('/').pop();cost[key]=(cost[key]||0)+cpu.timeDeltas[i];}
   const allocationSites=[];function visit(node){if(node.selfSize)allocationSites.push({fn:node.callFrame.functionName,url:node.callFrame.url.split('/').pop(),sampledBytes:node.selfSize});for(const child of node.children||[])visit(child);}visit(allocations.head);
   const row={count,readyMs,readyHeap,startupLongTasks:startup.longTasks,beforeHeap,afterHeap,static:stationary,orbit,cpuExclusiveTop:Object.entries(cost).sort((a,b)=>b[1]-a[1]).slice(0,20),sampledSurvivingAllocationSites:allocationSites.sort((a,b)=>b.sampledBytes-a.sampledBytes).slice(0,20)};
   if(count===250){await p.evaluate(async()=>{quaterniusShowroom.engine.setHardwareScalingLevel(2);for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);});row.halfResolutionDiagnostic=await segment(p,false);}
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);report.rows.push(row);
   console.log(JSON.stringify({count,readyMs,cpuMs:stationary.cpuFrameMs,gpuMs:stationary.gpuFrameMs,gpuSamples:stationary.gpuSamples,staticFPS:stationary.fps,p95:stationary.p95FrameMs,heapDelta:afterHeap.usedSize-beforeHeap.usedSize,uploads:stationary.bufferUploads}));await p.close();
  }
  // Read-only loader probe. Measure all assets and two named-root imports in
  // fresh engines. No modified GLB, texture downsampling or renderer activation.
  for(const selection of ['all','steelMill','acidWorks']){
   const p=await browser.newPage({viewport:{width:1366,height:768}});await p.goto(base+'/graphics-prototype/quaternius-prototypes/?capture=1');await p.waitForFunction(()=>window.quaterniusShowroom?.ready,null,{timeout:90000});
   const result=await p.evaluate(async selection=>{
    quaterniusShowroom.dispose();const canvas=document.createElement('canvas');canvas.width=1366;canvas.height=768;document.body.append(canvas);
    const engine=new BABYLON.Engine(canvas,true),scene=new BABYLON.Scene(engine),started=performance.now();
    const result=await BABYLON.SceneLoader.ImportMeshAsync(selection==='all'?'':selection,'graphics-prototype/quaternius-prototypes/generated/','pilots.glb',scene);
    const geometryBytes=[...new Set(scene.meshes.map(m=>m.geometry).filter(Boolean))].reduce((n,g)=>{for(const k of g.getVerticesDataKinds()){const a=g.getVerticesData(k);n+=a.byteLength||a.length*4;}const a=g.getIndices();return n+(a.byteLength||a.length*4);},0);
    const value={selection,loadMs:performance.now()-started,meshes:result.meshes.length,geometryBytes,textureEstimateBytes:engine.getLoadedTexturesCache().reduce((n,t)=>n+(t.width||0)*(t.height||0)*4*(t.generateMipMaps?4/3:1),0),textures:scene.textures.length};scene.dispose();engine.dispose();return value;
   },selection);
   report.assetLoads.push(result);console.log(JSON.stringify(result));await p.close();
  }
 }catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(out,'stability-profile.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
