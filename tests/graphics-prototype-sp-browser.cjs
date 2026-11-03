const {chromium}=require('playwright-core'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const out=process.argv[2]||'/tmp/mapgame-graphics-sp',origin=process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8017';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});const p=await browser.newPage({viewport:{width:1440,height:1000}}),r={errors:[],failed:[],http:[],textureRequests:[],checks:[]};
try{
 p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text());});p.on('requestfailed',q=>r.failed.push(q.url()));p.on('response',q=>{if(q.status()>=400)r.http.push([q.url(),q.status()]);});p.on('request',q=>{if(q.url().includes('/graphics-prototype/assets/'))r.textureRequests.push(q.url());});
 await p.addInitScript(()=>{if(!localStorage.getItem('graphics-fixture')){localStorage.setItem('graphics-fixture','1');localStorage.setItem('mapgame_frontier_preferences_v1',JSON.stringify({version:1,theme:'frontier',graphicsPrototype:false,unknownPreference:'retain'}));}});
 const t=Date.now();await p.goto(origin);await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);r.bootMs=Date.now()-t;
 await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);await p.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await p.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);
 await p.evaluate(()=>mapGameEconomy.stop());
 const before=await p.evaluate(()=>JSON.stringify(mapGameEconomy.snapshot().economy.precision));
 await p.click('[data-c1="more"]');
 await p.click('[data-action="settings"]');
 await p.waitForSelector('[data-pref="graphicsPrototype"]',{state:'attached'});
 await p.evaluate(()=>{document.querySelector('[data-pref="graphicsPrototype"]').closest('details').open=true;});
 await p.locator('[data-pref="graphicsPrototype"]').check();
 assert.equal(await p.evaluate(()=>mapGameFrontier.preferences().graphicsPrototype),true);assert.equal(await p.evaluate(()=>mapGameGraphicsPrototype.enabled({graphicsPreset:'BASIC'})),false);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mapgame_frontier_preferences_v1')).unknownPreference),'retain');assert.equal(await p.evaluate(()=>JSON.stringify(mapGameEconomy.snapshot().economy.precision)),before);
 await p.screenshot({path:path.join(out,'settings.png')});
 await p.reload();await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);assert.equal(await p.evaluate(()=>mapGameFrontier.preferences().graphicsPrototype),true);
 await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);assert.equal(await p.evaluate(()=>mapGameGraphicsPrototype.diagnostics(mapGameRuntime.scene).roots),0);
 await p.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await p.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);
 const canvas=p.locator('#basicWorldCanvas');if(await canvas.count()){await canvas.hover();await p.mouse.wheel(0,-200);await p.mouse.move(850,500);await p.mouse.down();await p.mouse.move(950,530,{steps:10});await p.mouse.up();}
 await p.evaluate(()=>mapGameStrategicWorld.open());await p.waitForTimeout(200);await p.screenshot({path:path.join(out,'world-map.png')});
 assert.deepEqual(r.textureRequests,[]);assert.deepEqual(r.errors,[]);assert.deepEqual(r.http,[]);assert.deepEqual(r.failed,[]);
 r.checks=['Singleplayer and local territory launch','Existing preference key and unknown fields preserved','Opt-in setting survives reload without changing balances','Basic never allocates prototype materials or meshes','Local navigation, pan/zoom and World Map return'];
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2));
}catch(e){r.failure=e.message;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
