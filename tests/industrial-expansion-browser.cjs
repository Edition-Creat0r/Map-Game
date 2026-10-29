// Local Singleplayer only. Prepared legacy save is explicit; no auth/remote writes.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.argv[2]||'/tmp/mapgame-expansion-browser';fs.mkdirSync(out,{recursive:true});
const ids=['chromiteMine','chromiumRefinery','stainlessSteelWorks','photoresistWorks','waferFab','servoDriveWorks','stainlessModuleWorks','electricTransportWorks'];
const research=['advancedMetallurgy','precisionFabrication','industrialAutomation'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const report={mode:'prepared legacy Singleplayer save; actual UI research and eight canvas purchases',errors:[],failed:[],http:[],checks:[]};
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('requestfailed',r=>report.failed.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.http.push([r.url(),r.status()])});
 await page.addInitScript(()=>{window.expansionLongTasks=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())expansionLongTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})}catch{}});
 try{
  await page.goto(process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8001');await page.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);
  await page.evaluate(()=>{
   const M=mapGameEconomyModel,P=mapGameProgression,R=mapGameIndustrialRegistry,now=Date.now();
   const types=[...Array(10).fill('smallHouse'),...Array(4).fill('powerPlant')];
   const s=M.normalize({money:10000000,steel:100000,carbon:100000,iron:100000,concrete:100000,glass:100000,
    inventory:Object.fromEntries(R.materialIds.filter(id=>!M.RESOURCES.includes(id)&&!['chromiteOre','chromium','stainlessSteel','photoresist','siliconWafers','servoDrives','electricVehicles'].includes(id)).map(id=>[id,100000])),
    customExpansionTest:{retained:true},placedIncomeItems:types.map((type,i)=>({id:'legacy-'+i,type,territoryId:'T_190_27',x:1000+i*350,z:1000,rotation:0})),economy:{version:4,lastTick:now,population:100}},now);
   M.bindContracts(s,mapGameBuildings.CATALOG);P.init(s,mapGameBuildings.CATALOG);s.economy.progression.era=6;s.economy.progression.completed=P.research.nodes.filter(n=>!n.minimumEra).map(n=>n.id);
   localStorage.setItem(mapGameEconomy.SAVE_KEY,JSON.stringify(s));
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await page.click('#mgStartSingle');await page.waitForFunction(()=>mapGameEconomy.getStatus().enabled);
  await page.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await page.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);
  assert.equal(await page.evaluate(()=>mapGameIndustrialRegistry.materialIds.length),127);
  assert.equal(await page.evaluate(()=>mapGameProgression.manifest.materials.filter(m=>mapGameProgression.unlocked(mapGameEconomy.snapshot(),m.id)).length),100);
  await page.click('[data-c1="research"]');await page.screenshot({path:path.join(out,'research-before.png')});
  for(const id of research){await page.locator(`[data-research="${id}"]`).scrollIntoViewIfNeeded();await page.click(`[data-research="${id}"]`);await page.waitForFunction(id=>mapGameEconomy.snapshot().economy.progression.completed.includes(id),id);}
  assert.equal(await page.evaluate(()=>mapGameProgression.manifest.materials.filter(m=>mapGameProgression.unlocked(mapGameEconomy.snapshot(),m.id)).length),106);
  await page.click('#mgProgressionPanel .mg-resource-discovery summary');
  assert.match(await page.locator('#mgProgressionPanel').innerText(),/106/);
  await page.screenshot({path:path.join(out,'research-expanded.png')});await page.click('[data-c1-close]');
  const sites=[];
  for(const id of ids){
   await page.click('[data-action="shop"]');await page.selectOption('#mgEconomyShop [data-category]','industries');await page.selectOption('#mgEconomyShop [data-availability]','all');await page.fill('#mgEconomyShop [data-search]',id);
   assert.equal(await page.locator(`[data-buy="${id}"]`).isDisabled(),false,id);
   if(id==='servoDriveWorks')await page.screenshot({path:path.join(out,'servo-drive-shop.png')});
   const point=await page.evaluate(({id,sites})=>{const v=mapGameBasicWorld.getState(),d=mapGameBuildings.CATALOG.find(d=>d.id===id);for(let z=v.cameraZ-500;z<v.cameraZ+500;z+=180)for(let x=v.cameraX-950;x<v.cameraX+950;x+=180)if(!sites.some(p=>Math.hypot(p.x-x,p.z-z)<160)&&mapGameEconomy.checkPlacement(d,{territoryId:v.territory.id,x,z,rotation:0}).allowed)return{x,z};},{id,sites});
   assert.ok(point,'No buildable site for '+id);sites.push(point);
   await page.click(`[data-buy="${id}"]`);
   const click=await page.evaluate(p=>{const v=mapGameBasicWorld.getState(),r=document.querySelector('#basicCanvas').getBoundingClientRect();return{x:r.x+r.width/2+(p.x-v.cameraX)*v.zoom,y:r.y+r.height/2+(p.z-v.cameraZ)*v.zoom}},{...point});
   await page.mouse.click(click.x,click.y);await page.waitForFunction(id=>mapGameEconomy.listPlacedBuildings().some(b=>b.type===id),id);
  }
  report.checks.push('Legacy seven-license save retains its 100 unlocked materials; three paid research purchases unlock six more; all eight new factories purchased through canvas placement');
  await page.screenshot({path:path.join(out,'expansion-factories.png')});
  // An explicit ten-minute offline fixture exercises persisted new recipes.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(mapGameEconomy.SAVE_KEY));s.economy.lastTick=Date.now()-600000;s.lastEconomyTick=s.economy.lastTick;localStorage.setItem(mapGameEconomy.SAVE_KEY,JSON.stringify(s));});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await page.click('#mgStartSingle');await page.waitForFunction(()=>mapGameEconomy.getStatus().enabled&&!mapGameEconomy.getStatus().catchingUp);
  const saved=await page.evaluate(()=>mapGameEconomy.snapshot());
  assert.equal(saved.placedIncomeItems.filter(b=>b.progressionAcquired===1&&b.type!=='smallHouse'&&b.type!=='powerPlant').length,8);
  assert.equal(saved.economy.progression.completed.length,10);assert.equal(saved.customExpansionTest.retained,true);
  for(const id of ['chromium','stainlessSteel','photoresist','siliconWafers','servoDrives','electricVehicles'])assert.ok(saved.inventory[id]>0,id+' did not produce');
  report.checks.push('Ten-minute synthetic offline reload operates the expanded chains, preserves contracts, unknown fields and research');
  await page.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await page.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);
  const frames=page.evaluate(()=>new Promise(resolve=>{const v=[];let last;function frame(t){if(last)v.push(t-last);last=t;if(v.length<120)requestAnimationFrame(frame);else resolve(v)}requestAnimationFrame(frame)}));
  await page.mouse.move(750,600);await page.mouse.down();await page.mouse.move(870,660,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-100);await page.mouse.wheel(0,100);
  const intervals=(await frames).sort((a,b)=>a-b);report.frames={samples:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)],fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length)};
  report.longTasks=await page.evaluate(()=>expansionLongTasks);report.result={newFactories:8,materials:106,research:10,produced:Object.fromEntries(['chromium','stainlessSteel','photoresist','siliconWafers','servoDrives','electricVehicles'].map(id=>[id,saved.inventory[id]]))};
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.http,[]);assert.deepEqual(report.failed,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
 }catch(error){report.failure=String(error);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));throw error;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
