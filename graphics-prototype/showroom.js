(() => {
 'use strict';
 const B=window.BABYLON,canvas=document.getElementById('scene');
 if(!B){document.getElementById('status').textContent='Babylon unavailable. Original game is unchanged.';return;}
 const variant=new URLSearchParams(location.search).get('variant')==='baseline'?'baseline':'prototype';
 const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}),scene=new B.Scene(engine);
 scene.clearColor=new B.Color4(.64,.72,.75,1);scene.ambientColor=new B.Color3(.25,.25,.25);
 const camera=new B.ArcRotateCamera('camera',-Math.PI*.68,1.05,340,new B.Vector3(25,0,-15),scene);camera.attachControl(canvas,true);camera.lowerRadiusLimit=14;camera.upperRadiusLimit=1100;camera.wheelPrecision=8;camera.minZ=.2;
 const hemi=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);hemi.intensity=.85;
 const sun=new B.DirectionalLight('sun',new B.Vector3(.5,-1,.45),scene);sun.position=new B.Vector3(-150,240,-100);sun.intensity=2.2;
 // Static contact shadows avoid a second per-frame shadow-map render pass.
 const shadowTexture=new B.DynamicTexture('contact-shadow',128,scene,false),ctx=shadowTexture.getContext();
 const gradient=ctx.createRadialGradient(64,64,8,64,64,64);gradient.addColorStop(0,'rgba(0,0,0,.55)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);shadowTexture.hasAlpha=true;shadowTexture.update();
 const shadowMaterial=new B.StandardMaterial('contact-shadow',scene);shadowMaterial.diffuseTexture=shadowTexture;shadowMaterial.useAlphaFromDiffuseTexture=true;shadowMaterial.disableLighting=true;shadowMaterial.emissiveColor=B.Color3.White();
 const P=window.mapGameGraphicsPrototype,rt={scene,camera,graphicsPreset:'REGULAR'},roots={};
 const original=()=>{const m=new B.StandardMaterial('baseline-ground',scene);m.diffuseColor=new B.Color3(.32,.43,.24);m.specularColor=B.Color3.Black();return m;};
 const ground=B.MeshBuilder.CreateGround('ground',{width:520,height:390},scene);ground.material=variant==='prototype'?P.surface(scene,'grass',520,390):original();ground.receiveShadows=true;
 const items=[{id:'prototype-house',type:'smallHouse',x:-95,z:-25},{id:'prototype-factory',type:'steelMill',x:10,z:25},{id:'prototype-office',type:'officeLow',x:135,z:-20}];
 for(const item of items){roots[item.type]=variant==='prototype'?P.createBuilding(rt,item):P.legacyBuilding(rt,item);for(const mesh of roots[item.type].getChildMeshes())mesh.receiveShadows=true;const fp=mapGameBuildings.item(item.type).footprint,shadow=B.MeshBuilder.CreateGround('contact',{width:fp[0]*1.16,height:fp[1]*1.16},scene);shadow.position.set(item.x+1,.025,item.z+1.5);shadow.material=shadowMaterial;}
 function road(x,z,w,d){const mesh=B.MeshBuilder.CreateBox('road',{width:w,depth:d,height:.30},scene);mesh.position.set(x,.35,z);mesh.material=P.surface(scene,'asphalt',w,d);mesh.receiveShadows=true;}
 road(0,-110,360,14);road(0,-110,14,100);
 const node={id:'preview-crossing',x:0,z:-110,y:0},arms=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>({type:'road2',width:14,path:[{x:0,y:0,z:-110},{x:x*50,y:0,z:-110+z*50}]}));
 if(variant==='prototype')roots.intersection=P.intersection(rt,node,arms,null,true);
 for(const [i,name] of ['grass','dirt','gravel','asphalt','concrete'].entries()){const tile=B.MeshBuilder.CreateGround('swatch-'+name,{width:28,height:28},scene);tile.position.set(-75+i*36,.04,120);tile.material=P.surface(scene,name,28,28);tile.receiveShadows=true;}
 const views={overview:[25,0,-15,340],smallHouse:[-95,4,-25,35],steelMill:[10,8,25,165],officeLow:[135,10,-20,140],intersection:[0,0,-110,42],surfaces:[0,0,120,135]};
 function view(id){const v=views[id]||views.overview;camera.setTarget(new B.Vector3(v[0],v[1],v[2]));camera.alpha=-Math.PI*.68;camera.beta=1.05;camera.radius=v[3];}
 document.getElementById('view').onchange=e=>view(e.target.value);
 document.getElementById('mode').textContent=variant==='prototype'?'Prototype · original procedural shapes and surface tiles':'Baseline · existing catalog renderers, identical camera and lighting';
 const intervals=[],longTasks=[];let last=0;
 if(window.PerformanceObserver)try{new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});}catch(_){}
 engine.runRenderLoop(()=>{if(document.hidden)return;const now=performance.now();if(last)intervals.push(now-last);last=now;if(intervals.length>1000)intervals.shift();scene.render();});
 window.addEventListener('resize',()=>engine.resize());window.addEventListener('pagehide',()=>{scene.dispose();engine.dispose();});
 scene.executeWhenReady(()=>document.getElementById('status').textContent='Ready · '+scene.meshes.length+' mesh batches');
 window.graphicsShowroom={scene,engine,camera,roots,variant,view,metrics:()=>({intervals:intervals.slice(),longTasks:longTasks.slice(),meshes:scene.meshes.length,active:scene.getActiveMeshes().length,materials:scene.materials.length,prototype:P.diagnostics(scene),camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:camera.target.asArray()}}),resetMetrics:()=>{intervals.length=0;longTasks.length=0;last=0;}};
})();
