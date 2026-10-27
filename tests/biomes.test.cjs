const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../world_terrain.js'),'utf8');
function load(seed,code=source){const context={window:{mapGameWorldConfig:{WORLD_ROWS:316}},localStorage:{getItem:()=>String(seed)}};vm.runInNewContext(code,context);return context.window.mapGameSharedTerrain}
const t=load(734221);
const plain=v=>JSON.parse(JSON.stringify(v));
test('existing seed, geography and terrain fields are unchanged',()=>{const fixtures=require('./terrain-baseline.json');for(const {seed,x,y,sample} of fixtures){const current=plain(load(seed).sample(x,y));delete current.biome;assert.deepEqual(current,sample)}});
test('same global coordinates agree across reloads and strategic/local interfaces',()=>{const again=load(734221);for(let i=0;i<316;i+=3){const j=(i*71)%316;assert.deepEqual(plain(t.strategic(i,j).biome),plain(t.local(i,j,16384,16384).biome));assert.deepEqual(plain(t.sample(i*32768,j*32768)),plain(again.sample(i*32768,j*32768)))}});
test('chunk and territory borders share identical samples; blends remain continuous',()=>{for(let i=1;i<64;i++){const x=i*512,y=i*719;assert.deepEqual(plain(t.local(0,0,x,y)),plain(t.sample(x,y)));assert.deepEqual(plain(t.local(0,0,32768,y)),plain(t.local(1,0,0,y)));assert.deepEqual(plain(t.local(0,0,y,32768)),plain(t.local(0,1,y,0)));const a=t.sample(x-.01,y).biome,b=t.sample(x+.01,y).biome;for(const id in a.weights)assert.ok(Math.abs(a.weights[id]-b.weights[id])<.001)}});
test('all eight families occur; weights are finite, nonnegative and normalized',()=>{const counts={};for(let y=0;y<316;y+=2)for(let x=0;x<316;x+=2){const b=t.strategic(x,y).biome;counts[b.id]=(counts[b.id]||0)+1;assert.ok(t.BIOMES[b.id]);assert.ok(Math.abs(Object.values(b.weights).reduce((a,b)=>a+b,0)-1)<1e-10);assert.ok(Object.values(b.weights).every(w=>Number.isFinite(w)&&w>=0))}console.log('Default-seed territory-center distribution:',JSON.stringify(counts));assert.equal(Object.keys(counts).length,8)});

test('representative climate regions classify as the expected biome families',()=>{
 const sites={taiga:[256,64],tundra_snow:[4,0],grassland:[48,160],dry_plains:[20,64],coastal:[300,72],wetlands:[260,108],alpine:[312,20],temperate_forest:[140,180]};
 for(const [id,[x,y]] of Object.entries(sites))assert.equal(t.strategic(x,y).biome.id,id);
});

test('height-only hillshade queries exactly match full terrain elevations',()=>{for(const seed of [734221,42,-123]){const terrain=load(seed);for(let i=0;i<500;i++){const x=(i*193919)%10354688-42,y=(i*791919)%10354688-42;assert.equal(terrain.elevationAt(x,y),terrain.sample(x,y).elevation)}}});
