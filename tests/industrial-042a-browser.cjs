// Explicit archived-release fixture, then real Singleplayer UI transactions.
// Offline intervals are test fixtures; no accounts, Supabase writes or rewards.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {archived,defs,ids}=require('./helpers/industrial-042a.cjs');
const out=process.argv[2]||'/tmp/mapgame-042a-browser';fs.mkdirSync(out,{recursive:true});
const prior=['chromiteMine','chromiumRefinery','stainlessSteelWorks','photoresistWorks','waferFab','servoDriveWorks','stainlessModuleWorks','electricTransportWorks'];
const Old=archived('economy_model.js'),OldP=archived('industrial/progression.js'),OldR=archived('industrial/registry.js');
const now=Date.now(),types=[...Array(12).fill('smallHouse'),...Array(8).fill('powerPlant'),...prior];
const fixture=Old.normalize({money:1e8,steel:100000,carbon:100000,concrete:100000,glass:100000,inventory:Object.fromEntries(OldR.materialIds.filter(id=>!Old.RESOURCES.includes(id)).map(id=>[id,100000])),
 placedIncomeItems:types.map((type,i)=>({id:'retained-'+i,type,progressionAcquired:1,level:1,territoryId:'T_190_27',x:1000+i*220,z:1000,rotation:0})),custom042a:{retained:true},economy:{version:4,lastTick:now,population:240}},now);
Old.bindContracts(fixture,defs.filter(d=>!ids.includes(d.id)));OldP.init(fixture,defs);fixture.economy.progression.era=6;fixture.economy.progression.completed=OldP.research.nodes.map(n=>n.id);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const report={mode:'archived d62525e save, then real UI research/construction and explicit offline fixtures',errors:[],failed:[],http:[],checks:[]};
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('requestfailed',r=>report.failed.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.http.push([r.url(),r.status()])});
 await page.addInitScript(()=>{window.testLongTasks=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())testLongTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})}catch{}});
 const sites=[];
 async function ready(){await page.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await page.click('#mgStartSingle');await page.waitForFunction(()=>mapGameEconomy.getStatus().enabled);await page.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await page.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);}
 async function offline(){await page.evaluate(()=>{mapGameEconomy.stop();const s=JSON.parse(localStorage.getItem(mapGameEconomy.SAVE_KEY));s.economy.lastTick=Date.now()-300000;s.lastEconomyTick=s.economy.lastTick;localStorage.setItem(mapGameEconomy.SAVE_KEY,JSON.stringify(s));});await page.reload();await ready();}
 async function license(id){await page.click('[data-c1="research"]');const button=page.locator(`[data-research="${id}"]`);await button.scrollIntoViewIfNeeded();if(await button.isDisabled())report.blocked=await page.evaluate(id=>{const s=mapGameEconomy.snapshot(),n=mapGameProgression.research.nodes.find(n=>n.id===id);return{id,reason:mapGameProgression.researchReason(s,id),cost:n.cost,stock:Object.fromEntries(Object.keys(n.cost).map(k=>[k,mapGameEconomyModel.quantity(s,k)])),statuses:s.summary.buildings}},id);assert.equal(await button.isDisabled(),false,id);await button.click();await page.waitForFunction(id=>mapGameEconomy.snapshot().economy.progression.completed.includes(id),id);await page.click('[data-c1-close]');}
 async function place(id){
  await page.click('[data-action="shop"]');await page.selectOption('#mgEconomyShop [data-category]','industries');await page.selectOption('#mgEconomyShop [data-availability]','all');await page.fill('#mgEconomyShop [data-search]',id);
  assert.equal(await page.locator(`[data-buy="${id}"]`).isDisabled(),false,id);
  if(id==='fiberOpticWorks')await page.screenshot({path:path.join(out,'fiber-optic-shop.png')});
  const point=await page.evaluate(({id,sites})=>{const v=mapGameBasicWorld.getState(),d=mapGameBuildings.CATALOG.find(d=>d.id===id);for(let z=v.cameraZ-600;z<v.cameraZ+600;z+=180)for(let x=v.cameraX-1000;x<v.cameraX+1000;x+=180)if(!sites.some(p=>Math.hypot(p.x-x,p.z-z)<160)&&mapGameEconomy.checkPlacement(d,{territoryId:v.territory.id,x,z,rotation:0}).allowed)return{x,z};},{id,sites});
  assert.ok(point,'No site for '+id);sites.push(point);await page.click(`[data-buy="${id}"]`);
  const screen=await page.evaluate(p=>{const v=mapGameBasicWorld.getState(),r=document.querySelector('#basicCanvas').getBoundingClientRect();return{x:r.x+r.width/2+(p.x-v.cameraX)*v.zoom,y:r.y+r.height/2+(p.z-v.cameraZ)*v.zoom}},point);
  await page.mouse.click(screen.x,screen.y);await page.waitForFunction(id=>mapGameEconomy.listPlacedBuildings().some(b=>b.type===id),id);
 }
 try{
  await page.goto(process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8001');await page.waitForFunction(()=>!!window.mapGameEconomy);await page.evaluate(f=>localStorage.setItem(mapGameEconomy.SAVE_KEY,JSON.stringify(f)),fixture);await page.reload();await ready();
  const migrated=await page.evaluate(()=>mapGameEconomy.snapshot());assert.equal(migrated.economy.progression.manifestVersion,2);assert.equal(migrated.economy.progression.completed.length,10);assert.equal(migrated.custom042a.retained,true);
  for(const type of prior)assert.ok(migrated.placedIncomeItems.some(r=>r.type===type));
  assert.deepEqual(migrated.economy.rules,fixture.economy.rules);
  await page.click('[data-c1="research"]');assert.equal(await page.locator('[data-research="advancedMetallurgy"]').isDisabled(),true);assert.equal(await page.locator('[data-research="advancedMaterialsScience"]').isDisabled(),true);assert.match(await page.locator('[data-node="advancedMaterialsScience"]').innerText(),/Nickel/);await page.screenshot({path:path.join(out,'research-before-production.png')});await page.click('[data-c1-close]');
  for(const id of ['nickelMine','nickelRefinery','manganeseMine','manganeseRefinery'])await place(id);
  await offline();await license('advancedMaterialsScience');
  for(const id of ['graphiteMine','graphitePurifier','bioResinWorks'])await place(id);
  await offline();await license('precisionManufacturing');
  await place('precisionCastingWorks');await place('thermalComponentWorks');await offline();
  await place('machineFrameWorks');await license('opticalEngineering');await place('opticalGlassWorks');await offline();await place('fiberOpticWorks');await offline();await offline();
  await page.click('[data-c1="research"]');const capstone=await page.locator('[data-node="telecommunications"]').innerText();assert.match(capstone,/Fiber-optic Cable/);assert.match(capstone,/Machine Frames/);await page.click('[data-c1-close]');
  const before=await page.evaluate(()=>mapGameEconomy.snapshot());await license('telecommunications');
  const after=await page.evaluate(()=>mapGameEconomy.snapshot());assert.equal(after.economy.progression.completed.length,14);assert.ok(before.inventory.fiberOpticCable-after.inventory.fiberOpticCable>=19);
  await page.click('[data-c1="research"]');await page.click('.mg-resource-discovery summary');assert.match(await page.locator('#mgProgressionPanel').innerText(),/118 \/ 118 unlocked/);await page.screenshot({path:path.join(out,'research-118-materials.png')});await page.click('[data-c1-close]');
  await page.screenshot({path:path.join(out,'twenty-industrial-factories.png')});await offline();
  const final=await page.evaluate(()=>mapGameEconomy.snapshot());assert.equal(final.placedIncomeItems.length,fixture.placedIncomeItems.length+12);assert.equal(final.economy.progression.completed.length,14);assert.equal(final.custom042a.retained,true);for(const id of ids)assert.ok(final.placedIncomeItems.some(r=>r.type===id));for(const [key,value] of Object.entries(fixture.economy.rules))assert.deepEqual(final.economy.rules[key],value);
  report.checks.push('Real archived save migration retains eight prior factories/contracts and ten purchased licenses','Twelve new canvas purchases bootstrap four paid research nodes through actual produced material stocks','Capstone consumes fiber cable/frames/thermal components; all 118 materials unlock; reload retains old/new factories and research');
  const frames=page.evaluate(()=>new Promise(resolve=>{const v=[];let last;function f(t){if(last)v.push(t-last);last=t;if(v.length<120)requestAnimationFrame(f);else resolve(v)}requestAnimationFrame(f)}));await page.mouse.move(750,600);await page.mouse.down();await page.mouse.move(870,660,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-100);await page.mouse.wheel(0,100);const times=(await frames).sort((a,b)=>a-b);report.frames={fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),p50:times[60],p95:times[114],samples:times.length};report.longTasks=await page.evaluate(()=>testLongTasks);
  report.totals=await page.evaluate(()=>({internal:mapGameIndustrialRegistry.materialIds.length,industrial:mapGameIndustrialRegistry.data.buildings.length,starter:mapGameBuildings.CATALOG.filter(d=>d.economy&&!d.industrial).length,player:mapGameProgression.manifest.materials.length,excluded:mapGameProgression.manifest.excluded.length,research:mapGameProgression.research.nodes.length}));
  assert.deepEqual(report.totals,{internal:139,industrial:140,starter:5,player:118,excluded:21,research:14});assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);assert.deepEqual(report.http,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
 }catch(e){report.failure=String(e);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
