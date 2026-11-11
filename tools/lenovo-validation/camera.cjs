'use strict';
const assert=require('node:assert/strict');
// Same ordering and view-ray assertions as the accepted Phase 2 capture test.
function assertTopDown(m){
 assert(Math.abs(m.camera.beta)<1e-6,'top-down beta must be zero');
 assert(Math.abs(m.camera.alpha+Math.PI/2)<1e-6,'top-down azimuth must align with the site');
 assert.deepEqual(m.camera.target,[0,4,0]);
 assert(m.forward[1]<-.999999&&Math.abs(m.forward[0])<.001&&Math.abs(m.forward[2])<.001,'top-down view ray must point vertically down');
}
function prepareCapture({model,view}){
 const s=quaterniusShowroom;
 s.engine.stopRenderLoop();
 if(view==='overhead'){
  s.camera.setTarget(new BABYLON.Vector3(0,4,0));
  s.camera.lowerBetaLimit=0;s.camera.beta=0;s.camera.alpha=-Math.PI/2;
  s.camera.radius=Math.max(...model.footprint)*1.45;
 }
 s.scene.render();s.pool.sync(true);s.scene.render();
 return {...s.metrics(),forward:s.camera.getForwardRay().direction.asArray()};
}
module.exports={assertTopDown,prepareCapture};
