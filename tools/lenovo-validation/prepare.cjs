'use strict';
// Export only the accepted static showroom and explicit local validation tools.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {SOURCE,IDS}=require('./verify.cjs');
const repo=path.resolve(__dirname,'../..'),dest=path.resolve(process.argv[2]||path.join(repo,'graphics-prototype/quaternius-prototypes/evidence/lenovo-phase3/package'));
assert(!fs.existsSync(dest),'Destination already exists; choose a brand-new directory.');
const read=name=>execFileSync('git',['show',SOURCE+':'+name],{cwd:repo,maxBuffer:32*1024*1024});
const folder='graphics-prototype/quaternius-prototypes/',manifest=JSON.parse(read(folder+'manifest.json'));
assert.deepEqual(manifest.buildings.map(b=>b.id),IDS);assert.equal(manifest.textures.length,19);
fs.mkdirSync(dest,{recursive:true});
const files={};function put(name,bytes){const target=path.join(dest,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});files[name]=crypto.createHash('sha256').update(bytes).digest('hex');}
let html=read(folder+'index.html').toString();
html=html.replace('https://cdn.babylonjs.com/babylon.js','vendor/babylon.js').replace('https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js','vendor/babylonjs.loaders.min.js');
// Only the export adapter changes: no gameplay entry, economy engine or legacy asset showroom.
html=html.replace('<script defer src="economy_model.js"></script>','').replace('<option value="baseline">Original catalog renderer</option>','').replace('<a href="graphics-prototype/modular-factories/">Legacy comparison</a>','<a href="index.html">Local test instructions</a>');
put(folder+'index.html',Buffer.from(html));
const scripts=[...html.matchAll(/<script defer src="([^"]+)"/g)].map(m=>m[1]).filter(s=>!s.startsWith('vendor/'));
for(const name of new Set([...scripts,folder+'showroom.css',folder+'manifest.json',folder+'License_Standard.txt']))put(name,read(name));
for(const asset of [manifest,...manifest.textures]){const bytes=read(folder+asset.url);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);put(folder+asset.url,bytes);}
for(const name of ['asphalt','concrete','dirt','grass','gravel'])put('graphics-prototype/assets/stock/textures/'+name+'.png',read('graphics-prototype/assets/stock/textures/'+name+'.png'));
for(const name of ['serve.cjs','verify.cjs','camera.cjs','run.cjs','package.json','package-lock.json','README.md','RESULTS-TEMPLATE.md'])put(name,fs.readFileSync(path.join(__dirname,name)));
const vendor=path.join(repo,'graphics-prototype/quaternius-prototypes/evidence/stability-phase2/vendor');
const pinned={'babylon.js':'58c486bececb6cde67b188e6410321e72d1d051ea7a9e5f23c560b6049ab37a5','babylonjs.loaders.min.js':'38096724c9dff7584c4e85ba65b34c8f15394e381815c23071761f05c08a192e'};
for(const [name,hash]of Object.entries(pinned)){const bytes=fs.readFileSync(path.join(vendor,name));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash);put('vendor/'+name,bytes);}
for(const name of ['Babylon-LICENSE.md','Babylon-loaders-LICENSE.md'])put('vendor/'+name,fs.readFileSync(path.join(repo,'graphics-prototype/quaternius-prototypes/evidence/lenovo-phase3/licenses',name)));
put('index.html',Buffer.from('<!doctype html><meta charset="utf-8"><title>Isolated Lenovo showroom test</title><h1>Map Game: isolated Quaternius hardware test</h1><p>Approved graphics checkpoint '+SOURCE+'</p><p><a href="graphics-prototype/quaternius-prototypes/">Open static showroom</a></p><p><a href="README.md">Instructions</a> · <a href="RESULTS-TEMPLATE.md">Results template</a></p><p>This package contains no game entry, authentication client, multiplayer client, save files or quarantined assets. Read-only catalog definitions are included to retain the approved building IDs and footprints.</p>'));
fs.writeFileSync(path.join(dest,'PACKAGE-INVENTORY.json'),JSON.stringify({sourceCommit:SOURCE,modelIds:IDS,adapterChanges:['Local pinned Babylon scripts','Omit unused economy engine','Remove original catalog choice and legacy link'],files},null,2)+'\n',{flag:'wx'});
require('./verify.cjs').verify(dest);console.log(dest+'\nVerified '+Object.keys(files).length+' files from the approved checkpoint and validation tools.');
