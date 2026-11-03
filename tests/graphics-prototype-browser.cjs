const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.argv[2]||'/tmp/mapgame-graphics-browser',origin=process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8017';fs.mkdirSync(out,{recursive:true});
const stats=a=>{const s=a.slice().sort((x,y)=>x-y);return {fps:1000/(a.reduce((x,y)=>x+y,0)/a.length),p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],min:s[0],max:s.at(-1),samples:a.length};};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const report={scope:'Real Babylon software WebGL showroom, identical source/catalog/camera/light; not deployed/Regular-world performance',variants:{},errors:[],failed:[],http:[]};
 try{
  for(const [variant,run] of [['baseline',0],['prototype',0],['prototype',1],['baseline',1],['baseline',2],['prototype',2]]){
   const runs=report.variants[variant]?.runs||[];
    const p=await browser.newPage({viewport:{width:1440,height:1000}});
    p.on('pageerror',e=>report.errors.push([variant,e.message]));p.on('console',m=>{if(m.type()==='error')report.errors.push([variant,m.text()]);});p.on('requestfailed',r=>report.failed.push([variant,r.url()]));p.on('response',r=>{if(r.status()>=400)report.http.push([variant,r.url(),r.status()]);});
    const t=Date.now();await p.goto(origin+'/graphics-prototype/index.html?variant='+variant);await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'),null,{timeout:60000});const bootMs=Date.now()-t;
    await p.waitForTimeout(1500);const startupLongTasks=await p.evaluate(()=>graphicsShowroom.metrics().longTasks);await p.evaluate(()=>graphicsShowroom.resetMetrics());await p.waitForFunction(()=>graphicsShowroom.metrics().intervals.length>=120,null,{timeout:60000});
    const metrics=await p.evaluate(()=>graphicsShowroom.metrics());runs.push({bootMs,startupLongTasks,...stats(metrics.intervals),longTasks:metrics.longTasks,meshes:metrics.meshes,active:metrics.active,materials:metrics.materials,camera:metrics.camera,missingTextures:metrics.prototype.missingTextures});
    if(run===0){
     for(const view of ['overview','smallHouse','steelMill','officeLow','intersection','surfaces']){await p.selectOption('#view',view);await p.waitForTimeout(400);if(variant==='prototype'&&['smallHouse','steelMill','officeLow'].includes(view))await p.waitForFunction(id=>graphicsShowroom.roots[id].metadata.graphicLOD===0,view,{timeout:20000});await p.screenshot({path:path.join(out,variant+'-'+view+'.png')});}
     if(variant==='prototype'){
      const checks=await p.evaluate(()=>{
       const {roots,camera,scene}=graphicsShowroom,positions={};for(const [id,root] of Object.entries(roots))positions[id]=root.position.asArray();
       const footprint=[];for(const id of ['smallHouse','steelMill','officeLow']){const root=roots[id],inverse=root.getWorldMatrix().clone().invert(),points=root.getChildMeshes().flatMap(m=>{m.computeWorldMatrix(true);return m.getBoundingInfo().boundingBox.vectorsWorld.map(v=>BABYLON.Vector3.TransformCoordinates(v,inverse).asArray());});const fp=mapGameBuildings.item(id).footprint;footprint.push({id,inside:points.every(v=>Math.abs(v[0])<=fp[0]/2+.02&&Math.abs(v[2])<=fp[1]/2+.02)});}
       return {positions,footprint,roots:mapGameGraphicsPrototype.diagnostics(scene).roots};
      });
      assert.ok(checks.footprint.every(x=>x.inside),JSON.stringify(checks));
      for(let i=0;i<12;i++){await p.evaluate(i=>{graphicsShowroom.view('smallHouse');graphicsShowroom.camera.radius=i%2?170:42;},i);await p.waitForTimeout(100);}
      const after=await p.evaluate(()=>Object.fromEntries(Object.entries(graphicsShowroom.roots).map(([id,r])=>[id,r.position.asArray()])));assert.deepEqual(after,checks.positions);
      const lods=[];for(const radius of [35,90,190]){await p.evaluate(r=>{graphicsShowroom.view('smallHouse');graphicsShowroom.camera.radius=r;},radius);await p.waitForFunction(expected=>graphicsShowroom.roots.smallHouse.metadata.graphicLOD===expected,lods.length,{timeout:15000});lods.push(await p.evaluate(()=>graphicsShowroom.roots.smallHouse.metadata.graphicLOD));}assert.deepEqual(lods,[0,1,2]);
      const cleanup=await p.evaluate(()=>{graphicsShowroom.roots.smallHouse.dispose();return mapGameGraphicsPrototype.diagnostics(graphicsShowroom.scene).roots;});assert.equal(cleanup,2);report.prototypeChecks={...checks,lods,positionsStable:true,disposeRegistry:cleanup};
      const hook=await p.evaluate(()=>{const g=graphicsShowroom,before=mapGameGraphicsPrototype.diagnostics(g.scene).roots;window.mapGameFrontier={preferences:()=>({graphicsPrototype:true})};const data={id:'hook-probe',type:'smallHouse',x:1000,z:1000},copy=JSON.stringify(data),n=mapGameBuildings.renderPlacedBuilding({scene:g.scene,graphicsPreset:'REGULAR'},data);const result={procedural:n.metadata.proceduralPrototype,unchanged:JSON.stringify(data)===copy,before};n.dispose();result.after=mapGameGraphicsPrototype.diagnostics(g.scene).roots;delete window.mapGameFrontier;return result;});assert.equal(hook.procedural,true);assert.equal(hook.unchanged,true);assert.equal(hook.before,hook.after);report.prototypeChecks.hook=hook;
     }
    }
    await p.close();
   report.variants[variant]={runs,medianBootMs:runs.map(x=>x.bootMs).sort((a,b)=>a-b)[1],medianFPS:runs.map(x=>x.fps).sort((a,b)=>a-b)[1]};
  }
  // Expected negative test, separate from normal-loading errors above.
  const fallback=await browser.newPage({viewport:{width:800,height:600}});
  await fallback.route('**/graphics-prototype/assets/stock/textures/grass.png',r=>r.fulfill({status:404,body:''}));
  await fallback.goto(origin+'/graphics-prototype/index.html?variant=prototype');
  await fallback.waitForFunction(()=>graphicsShowroom.metrics().prototype.missingTextures.includes('grass'),null,{timeout:30000});
  report.expectedMissingTextureFallback=await fallback.evaluate(()=>({reported:graphicsShowroom.metrics().prototype.missingTextures,neutralGround:graphicsShowroom.scene.getMeshByName('ground').material.diffuseTexture===null}));
  assert.equal(report.expectedMissingTextureFallback.neutralGround,true);await fallback.close();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);assert.deepEqual(report.http,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
 }catch(e){report.failure=e.message;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
