'use strict';
// Integration checks of the exported package, without a browser or backend.
const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'graphics-prototype/quaternius-prototypes/evidence/lenovo-phase3/package-v2');
(async()=>{const {startServer}=require(path.join(root,'serve.cjs')),{verify}=require(path.join(root,'verify.cjs'));const inventory=verify();const{server,origin}=await startServer();try{
 const index=await fetch(origin+'/graphics-prototype/quaternius-prototypes/');assert.equal(index.status,200);const text=await index.text();assert(text.includes('vendor/babylon.js'));assert(!text.includes('cdn.babylonjs.com'));assert(!text.includes('economy_model.js'));assert(!text.includes('value="baseline"'));
 assert(index.headers.get('content-security-policy').includes("connect-src 'self'"));
 for(const name of ['game.js','auth.js','multiplayer.js','economy.js','economy_model.js','PACKAGE-INVENTORY.json','results/private.json','graphics-prototype/modular-factories/index.html'])assert.equal((await fetch(origin+'/'+name)).status,404,name);
 assert.equal((await fetch(origin+'/',{method:'POST',body:'no writes'})).status,405);
 const folder='graphics-prototype/quaternius-prototypes/',m=JSON.parse(fs.readFileSync(path.join(root,folder,'manifest.json')));
 for(const a of [m,...m.textures]){const response=await fetch(origin+'/'+folder+a.url);assert.equal(response.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),a.sha256);}
 console.log('PASS: package hashes; directory routing; local-only CSP; denied game/auth/multiplayer/economy/results paths; POST denied; all 20 approved assets served with exact hashes. Inventory files: '+Object.keys(inventory.files).length);
 }finally{await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
