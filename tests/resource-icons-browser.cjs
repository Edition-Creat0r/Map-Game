// Synthetic Singleplayer fixture. No multiplayer requests or crafting mutations.
const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {state}=require('./helpers/industrial-042a.cjs');
const origin=process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8017',out=process.argv[2]||'/tmp/resource-icons-browser';fs.mkdirSync(out,{recursive:true});
const fixture=state(['smallHouse','powerPlant','steelMill','carbonPlant']);fixture.economy.lastTick=Date.now();fixture.steel=4321.25;fixture.economy.precision.steel=String(432125n*3000000000n); // exact scale 3e11
const files=['index.html','visual_ui.js','economy_ui.js','industrial/progression-ui.js','visual.css'];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});const report={errors:[],http:[],failed:[],checks:[]};try{
for(const variant of ['baseline','current']){
 const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});p.on('response',r=>{if(r.status()>=400)report.http.push([r.url(),r.status()])});p.on('requestfailed',r=>report.failed.push(r.url()));
 if(variant==='baseline'){const sources=new Map(files.map(f=>['/'+f,execFileSync('git',['show','dba4aac:'+f])]));await p.route('**/*',r=>{const u=new URL(r.request().url()),key=u.pathname==='/'?'/index.html':u.pathname;return u.origin===origin&&sources.has(key)?r.fulfill({body:sources.get(key),contentType:key.endsWith('.html')?'text/html':key.endsWith('.css')?'text/css':'application/javascript'}):r.fallback();});}
 await p.addInitScript(s=>{if(!localStorage.getItem('resource-fixture')){localStorage.setItem('resource-fixture','1');localStorage.setItem('mapgame_economy_021e',JSON.stringify(s));}},fixture);
 await p.goto(origin);await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);await p.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'});mapGameEconomy.stop();});await p.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);
 const before=await p.evaluate(()=>JSON.stringify(mapGameEconomy.snapshot().economy.precision));
 await p.screenshot({path:path.join(out,variant+'-resources.png')});
 await p.evaluate(()=>mapGameEconomyUI.toggleStats());await p.locator('#mgEconomyStats [data-inventory]').evaluate(el=>el.open=true);await p.screenshot({path:path.join(out,variant+'-inventory.png')});
 const steel=await p.evaluate(()=>mapGameEconomy.snapshot().steel);assert.match(await p.locator('#mgEconomyStats').innerText(),new RegExp(Number(steel).toLocaleString(undefined,{maximumFractionDigits:2}).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 await p.evaluate(()=>mapGameEconomyUI.showShop());await p.click('[data-inspect="steelMill"]');await p.screenshot({path:path.join(out,variant+'-shop.png')});
 await p.click('#mgEconomyShop [data-close]');await p.click('[data-c1="research"]');await p.screenshot({path:path.join(out,variant+'-research.png')});await p.click('[data-c1-close]');
 if(variant==='current'){
  assert.equal(await p.locator('#mgResourceStrip .mg-resource-art').count(),1);assert.equal(await p.locator('#mgResourceStrip .mg-resource-art').evaluate(el=>el.complete&&el.naturalWidth===64),true);
  await p.click('#mgEasyCraftButton');await p.selectOption('[data-recipe-choice]','steelMill');await p.screenshot({path:path.join(out,'easy-craft.png')});
  assert.match(await p.locator('#mgEasyCraft').innerText(),/4321|4,321/);assert.equal(await p.locator('#mgEasyCraft button:has-text("Crafting is automatic")').isDisabled(),true);
  await p.evaluate(()=>document.body.dataset.world='central');await p.selectOption('[data-recipe-choice]','carbonPlant');assert.match(await p.locator('[data-recipe-status]').innerText(),/Central World crafting unavailable/);assert.equal(await p.locator('[data-recipe-shop]').isDisabled(),true);await p.evaluate(()=>document.body.dataset.world='singleplayer');await p.selectOption('[data-recipe-choice]','steelMill');
  await p.click('[data-recipe-shop]');assert.equal(await p.locator('#mgEconomyShop [data-search]').inputValue(),'steelMill');await p.click('#mgEconomyShop [data-close]');
  for(let i=0;i<8;i++)await p.click('#mgEasyCraftButton');assert.equal(await p.locator('#mgEasyCraft').isVisible(),false);
  assert.equal(await p.evaluate(()=>JSON.stringify(mapGameEconomy.snapshot().economy.precision)),before);
  await p.reload();await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);assert.equal(await p.locator('#mgEasyCraft').count(),0); // collapsed and lazy after reload
  report.checks.push('Original money ID / artwork loaded; exact stopped ledger unchanged','Inventory quantity, shop and research icons','Recipe browsing, automatic-only crafting, Central World disabled','Repeated collapse, construction navigation, save/reload');
 }
 await p.close();
}
// Separate expected failed decode. Text remains visible, no broken-image glyph.
const p=await b.newPage();await p.route('**/assets/resource-icons/credit.svg',r=>r.fulfill({status:200,contentType:'image/png',body:'corrupt'}));await p.goto(origin);await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await p.click('#mgStartSingle');await p.waitForFunction(()=>document.querySelector('#mgResourceStrip [data-material="money"]')&&!document.querySelector('#mgResourceStrip .mg-resource-art'));assert.match(await p.locator('#mgResourceStrip [data-material="money"]').innerText(),/\$/);report.expectedDecodeFallback=true;await p.close();
assert.deepEqual(report.errors,[]);assert.deepEqual(report.http,[]);assert.deepEqual(report.failed,[]);
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
