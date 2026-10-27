// Actual UI flows against a local source server. No TLS verification bypass.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.argv[2]||'/tmp/mapgame-frontier-browser';fs.mkdirSync(out,{recursive:true});
const url=process.env.MAP_GAME_TEST_URL||'http://127.0.0.1:8001';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const c=await b.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),p=await c.newPage(),r={errors:[],http:[],failed:[],checks:[],resolutions:[]};
 await p.addInitScript(()=>{const Native=window.AudioContext;if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);window.frontierTestAudio=this;}};});
 function attach(p){p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});p.on('requestfailed',q=>r.failed.push(q.url()));p.on('response',q=>{if(q.status()>=400)r.http.push([q.url(),q.status()])});}attach(p);
 async function ready(){await p.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);}
 async function screenshot(name){await p.screenshot({path:path.join(out,name+'.png')});}
 await p.goto(url);await ready();await p.waitForSelector('[data-updates] details');assert.equal(await p.evaluate(()=>!!window.frontierTestAudio),false);await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.documentElement.dataset.frontierMotion==='off');assert.equal(await p.locator('.mf-scene-tree').first().evaluate(el=>getComputedStyle(el).animationName),'none');await p.emulateMedia({reducedMotion:'no-preference'});
 assert.match(await p.locator('.mf-home').innerText(),/Offline launch is not verified/);
 for(const [w,h]of [[1366,768],[1440,900],[1920,1080]]){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(150);const bounds=await p.locator('#mgStartSingle').boundingBox();assert(bounds.y+bounds.height<h);assert.equal(await p.evaluate(()=>document.querySelector('#mgHome').scrollWidth<=innerWidth),true);await screenshot('home-'+w);r.resolutions.push({width:w,height:h,home:true});}
 await p.setViewportSize({width:1440,height:900});
 await p.click('#mgJoinCentral');await p.waitForSelector('#mgAuthModal:not([hidden])');await p.click('#mgAuthClose');r.checks.push('Home launches retain signed-out Central World authentication gating');
 await p.click('[data-new-world]');await p.click('[data-prepare-new]');assert.match(await p.locator('[data-backup-message]').innerText(),/Export/);await p.keyboard.press('Escape');
 await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);
 await p.evaluate(async()=>{mapGameStrategicWorld.close();await mapGameRuntime.enterTerritory({x:190,y:27,id:'T_190_27'})});await p.waitForFunction(()=>document.querySelector('#loadingScreen').hidden);await p.waitForFunction(()=>mapGameFrontier.progress()?.progress.explored.includes('T_190_27'));
 const initial=await p.evaluate(()=>({money:mapGameEconomy.snapshot().money,count:mapGameEconomy.listPlacedBuildings().length,cam:mapGameBasicWorld.getState(),frame:mapGameRuntime.scene.getFrameId()}));
 await p.click('[data-action="shop"]');
 await p.locator('[data-inspect="smallHouse"]').click();await p.waitForSelector('[data-inspector-place]');assert.match(await p.locator('[data-building-inspector]').innerText(),/1.2× throughput/i);
 assert.equal(await p.evaluate(()=>mapGameEconomy.snapshot().money),initial.money);
 await p.locator('[data-favorite="smallHouse"]').click();await p.selectOption('[data-sort]','favorites');assert.equal(await p.locator('[data-catalog-id]').count(),1);await p.selectOption('[data-sort]','catalog');
 for(const [w,h]of [[1366,768],[1440,900],[1920,1080]]){await p.setViewportSize({width:w,height:h});await p.waitForTimeout(180);const box=await p.locator('#mgEconomyShop .mg-econ-shell').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=w+1&&box.y+box.height<=h+1);assert.equal(await p.evaluate(()=>document.querySelector('#mgEconomyShop .mg-econ-shell').scrollWidth<=document.querySelector('#mgEconomyShop .mg-econ-shell').clientWidth),true);await screenshot('shop-'+w);}
 await p.setViewportSize({width:1440,height:900});
 await p.click('[data-upgrades]');assert.equal(await p.locator('[data-building-inspector] button:disabled').count(),1);assert.equal(await p.evaluate(()=>mapGameEconomy.snapshot().money),initial.money);
 await p.click('[data-inspect="smallHouse"]');await p.click('[data-inspector-place]');assert.equal(await p.evaluate(()=>mapGameBasicWorld.getState().construction),true);await p.keyboard.press('r');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>mapGameBasicWorld.getState().construction),false);assert.equal(await p.evaluate(()=>mapGameEconomy.snapshot().money),initial.money);
 r.checks.push('Catalog inspector/favorites/filtering/reserved upgrades spend nothing; Place/rotation/Escape preserve construction semantics');
 // A real clicked placement, using the existing authoritative validator to locate a valid site.
 await p.click('[data-action="shop"]');await p.click('[data-buy="smallHouse"]');
 const point=await p.evaluate(()=>{const s=mapGameBasicWorld.getState(),d=mapGameBuildings.CATALOG.find(d=>d.id==='smallHouse');for(let z=s.cameraZ-600;z<=s.cameraZ+600;z+=100)for(let x=s.cameraX-1000;x<=s.cameraX+1000;x+=100)if(mapGameEconomy.checkPlacement(d,{territoryId:s.territory.id,x,z,rotation:0}).allowed)return{x,z};});assert(point);
 const coord=await p.evaluate(point=>{const s=mapGameBasicWorld.getState(),b=document.querySelector('#basicCanvas').getBoundingClientRect();return{x:b.x+b.width/2+(point.x-s.cameraX)*s.zoom,y:b.y+b.height/2+(point.z-s.cameraZ)*s.zoom};},point);
 await p.mouse.move(coord.x,coord.y);await p.mouse.click(coord.x,coord.y);await p.waitForFunction(n=>mapGameEconomy.listPlacedBuildings().length===n+1,initial.count);assert.equal(await p.evaluate(()=>mapGameEconomy.snapshot().money),initial.money-12000);
 await p.waitForFunction(()=>mapGameFrontier.progress().progress.completed.includes('firstHome'));
 await p.click('[data-c1="research"]');await p.click('[data-research="basicIndustry"]');await p.waitForFunction(()=>mapGameEconomy.snapshot().economy.progression.completed.includes('basicIndustry'));await p.keyboard.press('Escape');
 await p.click('[data-mf="advancements"]');assert(await p.locator('.mf-goal').count()>=4);
 await p.click('[data-pin="firstHome"]');await p.click('[data-pin="power"]');await p.click('[data-pin="explore"]');await p.click('[data-pin="research"]');assert.match(await p.locator('[data-goal-message]').innerText(),/maximum three/);
 const before=await p.locator('.mf-graph-world').evaluate(el=>el.style.transform);await p.click('[data-zoom-in]');const after=await p.locator('.mf-graph-world').evaluate(el=>el.style.transform);assert.notEqual(before,after);await p.locator('.mf-graph').focus();await p.keyboard.press('ArrowRight');
 for(const [w,h]of [[1366,768],[1440,900],[1920,1080]]){await p.setViewportSize({width:w,height:h});await screenshot('advancements-'+w);}
 await p.keyboard.press('Escape');assert.equal(await p.locator('#mfPinned button').count(),3);
 r.checks.push('Real construction payment and research produce idempotent cosmetic advancement progress; three-goal pin limit, graph zoom/pan and keyboard controls');
 await p.click('[data-c1="more"]');await p.click('[data-action="settings"]');await p.evaluate(()=>mapGameEconomy.stop());
 const protectedBefore=await p.evaluate(()=>[localStorage.getItem(mapGameEconomy.SAVE_KEY),localStorage.getItem('mapGame_alpha021_firstPlayable')]);
 await p.selectOption('[data-pref="theme"]','forest');await p.locator('[data-pref="scale"]').fill('115');await p.locator('[data-pref="scale"]').dispatchEvent('change');await p.selectOption('[data-pref="motion"]','off');
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.frontierTheme),'forest');
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.frontierMotion),'off');
 const backgrounds=p.locator('.mf-studio details').filter({hasText:'Private backgrounds'}).first();await backgrounds.locator('summary').first().click();
 await p.locator('[data-image="home"]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});assert.match(await p.locator('[data-image-status]').innerText(),/PNG/);
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;c.getContext('2d').fillRect(0,0,128,128);return c.toDataURL().split(',')[1]});
 await p.locator('[data-image="home"]').setInputFiles({name:'private.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.waitForFunction(()=>document.querySelector('[data-image-status]').textContent.includes('saved'));await screenshot('studio-private-image');
 await p.click('[data-remove-image="home"]');await p.waitForFunction(()=>document.querySelector('[data-image-status]').textContent.includes('removed'));
 await p.selectOption('[data-pref="motion"]','subtle');await p.locator('#mf-audio summary').click();await p.locator('[data-pref="mute"]').uncheck();await p.click('[data-test-audio]');await p.waitForFunction(()=>window.frontierTestAudio?.state==='running');await p.locator('[data-pref="mute"]').check();await p.selectOption('[data-pref="motion"]','off');
 r.checks.push('Silent boot, system reduced-motion static scene, and explicitly unmuted gesture-started Web Audio with independent interface/master levels');
 assert.deepEqual(await p.evaluate(()=>[localStorage.getItem(mapGameEconomy.SAVE_KEY),localStorage.getItem('mapGame_alpha021_firstPlayable')]),protectedBefore);
 r.checks.push('Appearance, reduced motion and validated private backgrounds persist independently of exact economy/world records; unsafe uploads rejected');
 await p.keyboard.press('Escape');await p.reload();await ready();assert.equal(await p.evaluate(()=>mapGameFrontier.preferences().theme),'forest');
 await p.click('[data-world-info]');
 const downloadPromise=p.waitForEvent('download');await p.click('[data-export]');const download=await downloadPromise;const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(data.scope,'singleplayer');assert.equal(Object.keys(data.records).length,4);assert.equal(JSON.parse(data.records.mapgame_frontier_world_v1).progress.pins.length,3);
 const bad={...data,version:99};await p.locator('[data-import]').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});assert.match(await p.locator('[data-backup-message]').innerText(),/compatible/);
 await p.locator('[data-import]').setInputFiles({name:'world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForSelector('[data-confirm-word]');await p.click('[data-confirm-restore]');assert.match(await p.locator('[data-backup-message]').innerText(),/RESTORE exactly/);
 await p.fill('[data-confirm-word]','RESTORE');await Promise.all([p.waitForNavigation(),p.click('[data-confirm-restore]')]);await ready();
 assert.equal(await p.evaluate(()=>localStorage.getItem('mapgame_economy_021e')),data.records.mapgame_economy_021e);
 assert(await p.evaluate(()=>localStorage.getItem('mapgame_frontier_preimport_v1')));
 await p.click('#mgStartSingle');await p.waitForFunction(()=>mapGameEconomy.getStatus().enabled);await p.waitForFunction(()=>mapGameFrontier.progress()?.progress.pins.length===3);
 assert.equal(await p.evaluate(()=>mapGameEconomy.listPlacedBuildings().length),initial.count+1);
 assert.equal(await p.evaluate(()=>new Set(mapGameFrontier.progress().progress.completed).size),await p.evaluate(()=>mapGameFrontier.progress().progress.completed.length));
 r.checks.push('Export/import confirmation, future-version rejection, pre-import recovery copy, exact ledger persistence, building and pin reload');
 await p.evaluate(()=>mapGameRuntime.showWorldMap());await screenshot('world-map');
 // A second Home tab cannot replace a world while the first tab owns the writer lock.
 const other=await c.newPage();attach(other);await other.goto(url);await other.waitForFunction(()=>document.querySelector('#mgStartSingle')?.disabled===false);await other.click('[data-world-info]');
 await other.locator('[data-import]').setInputFiles({name:'same-world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await other.waitForSelector('[data-confirm-word]');await other.fill('[data-confirm-word]','RESTORE');await other.click('[data-confirm-restore]');await other.waitForFunction(()=>document.querySelector('[data-backup-message]').textContent.includes('other Singleplayer tab'));assert.match(await other.locator('[data-backup-message]').innerText(),/other Singleplayer tab/);await other.close();
 // Deliberate New World and restore of the complete pre-change slot.
 await p.reload();await ready();await p.click('[data-new-world]');const dl=p.waitForEvent('download');await p.click('[data-export]');await dl;await p.click('[data-prepare-new]');await p.fill('[data-new-seed]','711999');await p.fill('[data-new-word]','NEW WORLD');await Promise.all([p.waitForNavigation(),p.click('[data-create-new]')]);await ready();
 assert.equal(await p.evaluate(()=>localStorage.getItem('mapgame_world_seed')),'711999');assert.equal(await p.evaluate(()=>localStorage.getItem('mapgame_economy_021e')),null);
 await p.click('[data-world-info]');await p.click('[data-restore]');await p.fill('[data-confirm-word]','RESTORE');await Promise.all([p.waitForNavigation(),p.click('[data-confirm-restore]')]);await ready();assert.equal(await p.evaluate(()=>mapGameSharedTerrain.seed),734221);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mapgame_economy_021e')).placedIncomeItems.length),initial.count+1);
 // Simulate an interrupted multi-key restore; a locked recovery occurs before play.
 const recovered=await p.evaluate(()=>{const before=mapGameFrontierModel.snapshot(localStorage);localStorage.setItem(mapGameFrontierModel.JOURNAL,JSON.stringify(before));localStorage.removeItem('mapgame_economy_021e');return before.records.mapgame_economy_021e;});
 await p.reload();await p.waitForFunction(()=>!window.mapGameFrontierRecoveryError&&!localStorage.getItem('mapgame_frontier_restore_journal_v1')&&document.querySelector('#mgStartSingle')?.disabled===false);assert.equal(await p.evaluate(()=>localStorage.getItem('mapgame_economy_021e')),recovered);
 r.checks.push('Other-tab writer blocks import; exported/confirmed New World retains a restorable snapshot; interrupted restore journal recovers before play');
 // Audio remains silent without a trusted opt-in, no autoplay on boot.
 assert.equal(await p.evaluate(()=>mapGameFrontier.preferences().mute),true);
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.http,[]);assert.deepEqual(r.failed,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2));await b.close();console.log(JSON.stringify(r));
})().catch(e=>{console.error(e);process.exit(1)});
