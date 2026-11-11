'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),{startServer}=require('./serve.cjs'),{verify,SOURCE}=require('./verify.cjs'),{assertTopDown,prepareCapture}=require('./camera.cjs');
const args=process.argv.slice(2),allowed=new Set(['--chrome','--lenovo','--gpu-note','--quick','--captures-only','--bench-only','--harness-test']);
const flags={};for(let i=0;i<args.length;i++){assert(allowed.has(args[i]),'Unknown argument: '+args[i]);const name=args[i];flags[name]=['--chrome','--lenovo','--gpu-note'].includes(name)?args[++i]:true;if(flags[name]===undefined)throw Error('Missing value for '+name);}
assert(!(flags['--captures-only']&&flags['--bench-only']),'Select captures-only or bench-only');
const harness=!!flags['--harness-test'],quick=!!flags['--quick'];
assert(harness||process.platform==='win32','Hardware workflow targets Windows; --harness-test is only for validating the tool itself.');
assert(flags['--chrome']&&fs.existsSync(flags['--chrome']),'Pass --chrome with the installed Google Chrome executable.');
assert(Number(process.versions.node.split('.')[0])>=20,'Node.js 20 or newer is required');
verify();
const name='run-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
const out=path.join(__dirname,'results',name),profileDir=path.join(out,'chrome-profile');fs.mkdirSync(out,{recursive:true});
const report={schema:1,sourceCommit:SOURCE,completed:false,purpose:harness?'cloud harness verification, NOT hardware validation':'Lenovo hardware measurements pending review',hardwareValidationEligible:!harness,lenovoModel:flags['--lenovo']||'not supplied',gpuNote:flags['--gpu-note']||'not supplied',viewport:[1366,768],quality:'high',shadows:false,protocol:harness?'short harness test':quick?'24 warm-up frames, 32 intervals per segment':'10 seconds warm-up, 30 seconds static and 30 seconds orbit',runs:harness?1:2,rows:[],captures:[],errors:[],warnings:[],requestsFailed:[]};
const csv=value=>'"'+String(value??'').replaceAll('"','""')+'"';
function median(a){a=[...a].sort((a,b)=>a-b);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;}
function save(){
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 const columns=['count','run','segment','fps','p95Ms','drawCalls','triangles','meshes','geometryMiB','textureEstimateMiB','jsHeapUsedMiB','readyMs','backend'];
 const lines=[columns.join(',')];
 for(const r of report.rows)for(const segment of ['static','orbit']){const m=r[segment];lines.push([r.count,r.run,segment,m.fps,m.p95FrameMs,m.drawCalls,m.activeTriangles,m.sceneMeshes,r.geometryBytes/2**20,m.textureEstimateBytes/2**20,m.jsHeapUsedBytes==null?'unavailable':m.jsHeapUsedBytes/2**20,r.readyMs,m.backend].map(csv).join(','));}
 fs.writeFileSync(path.join(out,'results.csv'),lines.join('\n')+'\n',{flag:'wx'});
 const table=['# Lenovo graphics results','',`Completed: ${report.completed}. Purpose: ${report.purpose}.`,'','| Count | Segment | Runs | Median FPS | Median per-run p95 ms | Draw calls | Geometry MiB | Texture estimate MiB |','|---:|---|---:|---:|---:|---:|---:|---:|'];
 for(const count of [10,50,100,250])for(const segment of ['static','orbit']){const rows=report.rows.filter(r=>r.count===count);if(!rows.length)continue;table.push(`| ${count} | ${segment} | ${rows.length} | ${median(rows.map(r=>r[segment].fps)).toFixed(2)} | ${median(rows.map(r=>r[segment].p95FrameMs)).toFixed(1)} | ${median(rows.map(r=>r[segment].drawCalls))} | ${(median(rows.map(r=>r.geometryBytes))/2**20).toFixed(2)} | ${(median(rows.map(r=>r[segment].textureEstimateBytes))/2**20).toFixed(2)} |`);}
 table.push('','Texture/geometry estimates and optional JS heap are not physical VRAM. Medians of per-run p95 values are not pooled percentiles. Share results.json and results.csv plus chrome://gpu status and visual notes.');
 fs.writeFileSync(path.join(out,'results.md'),table.join('\n')+'\n',{flag:'wx'});
}
(async()=>{
 let context,server;
 try{
  const started=await startServer();server=started.server;const origin=started.origin;
  context=await chromium.launchPersistentContext(profileDir,{executablePath:path.resolve(flags['--chrome']),headless:harness,viewport:{width:1366,height:768},deviceScaleFactor:1,serviceWorkers:'block',chromiumSandbox:process.platform==='win32',args:harness?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.requestsFailed.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.requestsFailed.push(r.status()+' '+r.url());});page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
  const cdp=await context.browser().newBrowserCDPSession();report.browser=await cdp.send('Browser.getVersion');
  try{const info=await cdp.send('SystemInfo.getInfo');report.gpu={devices:info.gpu.devices,featureStatus:info.gpu.featureStatus,glRenderer:info.gpu.auxAttributes?.glRenderer};}catch(e){report.gpu={unavailable:e.message};}
  async function load(count=1,type='steelMill',capture=false){
   await page.bringToFront();const start=performance.now();const response=await page.goto(origin+'/graphics-prototype/quaternius-prototypes/?count='+count+'&quality=high&type='+type+(capture?'&capture=1&shadows=1&radius='+(Math.max(...manifest.buildings.find(m=>m.id===type).footprint)*1.45):''));
   assert(response?.ok(),'Showroom HTTP request failed: '+response?.status());
   await page.waitForFunction(()=>{const text=document.getElementById('status')?.textContent||'';if(text.startsWith('Pilot unavailable'))throw Error(text);return window.quaterniusShowroom?.ready;},null,{timeout:120000});
   await page.evaluate(()=>new Promise(resolve=>quaterniusShowroom.scene.executeWhenReady(()=>resolve())));
   const backend=await page.evaluate(()=>quaterniusShowroom.metrics().backend);report.backend=backend;
   const software=/swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp/i.test(backend);
   report.softwareRendererDetected=software;report.hardwareValidationEligible=!harness&&!software;
   if(software&&!harness)throw Error('Chrome reports software rendering: '+backend+'. Review chrome://gpu and acceleration settings; these are not Lenovo GPU validation results.');
   return performance.now()-start;
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'graphics-prototype/quaternius-prototypes/manifest.json')));
  if(!flags['--captures-only'])for(const count of [10,50,100,250])for(let run=1;run<=report.runs;run++){
   const readyMs=await load(count);
   await page.evaluate(async({harness,quick})=>{if(document.hidden)throw Error('Keep the test window visible');if(quick||harness){for(let i=0;i<(harness?2:24);i++)await new Promise(requestAnimationFrame);}else{const start=performance.now();while(performance.now()-start<10000)await new Promise(requestAnimationFrame);}}, {harness,quick});
   async function measure(orbit){return page.evaluate(async({orbit,harness,quick})=>{
    const s=quaterniusShowroom,intervals=[];let invalid=document.hidden;const changed=()=>{if(document.hidden)invalid=true;};document.addEventListener('visibilitychange',changed);
    const start=performance.now();let previous=await new Promise(requestAnimationFrame);s.resetMetrics();
    try{while(harness?intervals.length<8:quick?intervals.length<32:performance.now()-start<30000){
     if(invalid)throw Error('Test tab was hidden; rerun without minimizing or switching tabs');
     if(orbit)s.camera.alpha=-Math.PI*.68+Math.sin((performance.now()-start)/30000*Math.PI*2)*.12;
     const now=await new Promise(requestAnimationFrame);intervals.push(now-previous);previous=now;
    }
    if(invalid)throw Error('Test tab was hidden');const m=s.metrics(),sorted=[...intervals].sort((a,b)=>a-b);if(intervals.length<2)throw Error('Insufficient frames');
    return {...m,fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95FrameMs:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],frameIntervalsMs:intervals,jsHeapUsedBytes:performance.memory?.usedJSHeapSize??null};
    }finally{document.removeEventListener('visibilitychange',changed);}
   },{orbit,harness,quick});}
   const stationary=await measure(false),orbit=await measure(true);
   const geometryBytes=await page.evaluate(()=>{let bytes=0;for(const g of new Set(quaterniusShowroom.scene.meshes.map(m=>m.geometry).filter(Boolean))){for(const key of g.getVerticesDataKinds()){const a=g.getVerticesData(key);if(a)bytes+=a.byteLength||a.length*4;}const a=g.getIndices();if(a)bytes+=a.byteLength||a.length*4;}return bytes;});
   report.rows.push({count,run,readyMs,geometryBytes,static:stationary,orbit});console.log(`${count} buildings, run ${run}: ${stationary.fps.toFixed(2)} FPS, p95 ${stationary.p95FrameMs.toFixed(1)} ms, ${stationary.drawCalls} draws; orbit ${orbit.fps.toFixed(2)} FPS`);
  }
  if(!flags['--bench-only']){
   fs.mkdirSync(path.join(out,'captures'));
   for(const model of manifest.buildings)for(const view of ['close','overhead']){
    await load(1,model.id,true);
    if(view==='overhead'){const initial=await page.evaluate(()=>({...quaterniusShowroom.metrics(),forward:quaterniusShowroom.camera.getForwardRay().direction.asArray()}));assert.throws(()=>assertTopDown(initial),/top-down/);}
    const metric=await page.evaluate(prepareCapture,{model,view});if(view==='overhead')assertTopDown(metric);assert.deepEqual(metric.pool.lodCounts,[0,0,1]);
    const file=model.id+'-'+view+'.png';await page.screenshot({path:path.join(out,'captures',file)});report.captures.push({id:model.id,view,file,camera:metric.camera,forward:metric.forward});console.log('Capture passed: '+file);
   }
   assert.equal(report.captures.length,18);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requestsFailed,[]);report.completed=true;
 }catch(e){report.failure=e.message;console.error(e.message);process.exitCode=1;}
 finally{if(context)await context.close();if(server)await new Promise(resolve=>server.close(resolve));save();console.log('Results saved in '+out);}
})();
