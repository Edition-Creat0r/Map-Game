'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const SOURCE='8b5d6a99967b83a831cd3d640492d7d3b0746ee0';
const IDS=['steelMill','precisionElectronicsWorks','machineWorks','acidWorks','glassWorks','semiconductorFab','utilityVehicleWorks','warehouse','batteryWorks'];
function verify(root=__dirname){
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'PACKAGE-INVENTORY.json')));
 assert.equal(inventory.sourceCommit,SOURCE);
 for(const [name,hash]of Object.entries(inventory.files)){
  assert(!path.isAbsolute(name)&&!name.split('/').includes('..'),'Unsafe package path');
  const file=path.join(root,name);assert(!fs.lstatSync(file).isSymbolicLink(),'Package links are not allowed');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'Package file changed: '+name);
 }
 const folder=path.join(root,'graphics-prototype/quaternius-prototypes'),m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
 assert.deepEqual(m.buildings.map(b=>b.id),IDS);assert.equal(m.textures.length,19);assert.equal(m.liveRendererEnabled,false);assert.equal(m.kenneyUsed,false);
 for(const a of [m,...m.textures])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,a.url))).digest('hex'),a.sha256,'Approved asset changed: '+a.url);
 return inventory;
}
if(require.main===module){verify();console.log('Verified Phase 2 checkpoint '+SOURCE+': nine approved models, 19 textures, all package hashes.');}
module.exports={verify,SOURCE,IDS};
