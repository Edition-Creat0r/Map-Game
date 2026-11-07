// Actual renderer capture, not an AI-generated illustration or resized image.
(async()=>{
 const ids=['steelMill','precisionElectronicsWorks','machineWorks'];window.factoryComparison={cameras:[],ready:false};
 for(const[i,frame]of [...document.querySelectorAll('iframe')].entries()){
  frame.src='./?type='+ids[i]+'&capture=1&radius=200.6&shadows=1';await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
  await new Promise((resolve,reject)=>{const start=performance.now(),poll=()=>{const s=frame.contentWindow.quaterniusShowroom;if(s?.ready)resolve();else if(performance.now()-start>90000)reject(Error('Factory capture timed out'));else setTimeout(poll,100);};poll();});
  const s=frame.contentWindow.quaterniusShowroom;await new Promise(resolve=>s.scene.executeWhenReady(()=>resolve()));s.engine.stopRenderLoop();s.pool?.sync(true);s.scene.render();await new Promise(requestAnimationFrame);factoryComparison.cameras.push(s.metrics().camera);
 }
 document.querySelector('#status').textContent='Quaternius architecture and source maps · original static industrial components · no Kenney models · machinery remains low detail. All three views use identical camera distance and pixel dimensions.';factoryComparison.ready=true;
})().catch(e=>{document.querySelector('#status').textContent=e.message;console.error(e);});
