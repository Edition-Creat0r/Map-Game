const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(){const calls=[],window={mapGameBuildings:{renderPlacedBuilding:(...args)=>{calls.push(args);return 'legacy';}},mapGameFrontier:{preferences:()=>({graphicsPrototype:false})}};vm.runInNewContext(fs.readFileSync(path.join(root,'graphics-prototype/prototype.js'),'utf8'),{window,document:{currentScript:null},URL,Map,Set,WeakMap,Object,Math});return {window,calls,p:window.mapGameGraphicsPrototype};}
test('graphics map uses three exact existing catalog footprints and no new building IDs',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'buildings.js'),'utf8'),{window,console:{log(){}}});const p=load().p;
 assert.deepEqual(Object.keys(p.specs),['smallHouse','steelMill','officeLow']);for(const [id,d]of Object.entries(p.specs))assert.deepEqual(Array.from(window.mapGameBuildings.item(id).footprint),[d[0],d[2]]);
 assert.equal(window.mapGameBuildings.item('officeLow').economy,undefined);
});
test('Basic and preference-off render paths preserve the original renderer arguments/result',()=>{
 const {window,calls}=load(),data={type:'smallHouse',id:'stable',x:1,z:2},parent={};
 assert.equal(window.mapGameBuildings.renderPlacedBuilding({graphicsPreset:'BASIC'},data,parent),'legacy');assert.equal(window.mapGameBuildings.renderPlacedBuilding({graphicsPreset:'REGULAR'},data,parent),'legacy');assert.equal(calls[0][1],data);assert.equal(calls[0][2],parent);assert.deepEqual(data,{type:'smallHouse',id:'stable',x:1,z:2});
});
test('three LOD levels have deterministic hysteresis without camera-driven positions',()=>{
 const p=load().p;assert.equal(p.lod(0,2.9),0);assert.equal(p.lod(0,3.1),1);assert.equal(p.lod(1,2.5),1);assert.equal(p.lod(1,1.9),0);assert.equal(p.lod(1,7.1),2);assert.equal(p.lod(2,5.1),2);assert.equal(p.lod(2,4.9),1);
 for(let i=0;i<100;i++)assert.equal(p.lod(1,2.5+(i%2?0.1:-0.1)),1);
});
test('intersection refuses unsupported geometry before allocation',()=>{
 const p=load().p;assert.equal(p.intersection({scene:{}},{},[{type:'road2'}],null,true),null);assert.equal(p.intersection({scene:{}},{},Array.from({length:4},()=>({type:'highway',width:28})),null,true),null);
});
test('existing preferences store is extended; no new world-save or settings key is introduced',()=>{
 const source=fs.readFileSync(path.join(root,'modern-frontier/ui.js'),'utf8');assert.ok(source.includes("graphicsPrototype:false"));assert.ok(source.includes('data-pref="graphicsPrototype"'));assert.ok(source.includes("PREF='mapgame_frontier_preferences_v1'"));assert.equal(fs.readFileSync(path.join(root,'graphics-prototype/prototype.js'),'utf8').includes('localStorage.setItem'),false);
});

test('actual application defers the prototype hook after catalog and existing preferences',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const hook=html.indexOf('src="graphics-prototype/prototype.js');assert(hook>html.indexOf('src="buildings.js'));assert(hook>html.indexOf('src="modern-frontier/ui.js'));assert.match(html,/src="graphics-prototype\/prototype\.js[^\"]*" defer/);
});
