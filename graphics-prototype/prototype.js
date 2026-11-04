// Render-only, opt-in presentation. No economy/save/world/ownership mutation.
(() => {
 'use strict';
 const specs=Object.freeze({smallHouse:Object.freeze([18,12,22]),steelMill:Object.freeze([118,32,92]),officeLow:Object.freeze([86,24,72])});
 const scenes=new WeakMap(),script=document.currentScript;
 const base=script?new URL('.',script.src).href:'graphics-prototype/';
 function enabled(runtime){return ['REGULAR','DEEP'].includes(runtime?.graphicsPreset)&&window.mapGameFrontier?.preferences().graphicsPrototype===true;}
 function lod(previous,ratio){if(previous===0)return ratio>3?1:0;if(previous===2)return ratio<5?1:2;return ratio<2?0:ratio>7?2:1;}
 function resources(scene){
  if(scenes.has(scene))return scenes.get(scene);
  const B=window.BABYLON,state={materials:{},roots:new Set(),surfaceClones:new Set(),surfaces:new Map(),tick:0,textures:[],failed:[]};
  const colors={wall:[.62,.57,.47],roof:[.20,.25,.28],glass:[.16,.31,.37],trim:[.22,.25,.27],brick:[.48,.28,.21],metal:[.57,.61,.59],line:[.90,.86,.66],grass:[.35,.44,.23],dirt:[.52,.41,.28],gravel:[.49,.50,.47],asphalt:[.21,.23,.25],concrete:[.67,.66,.61]};
  for(const [key,rgb] of Object.entries(colors)){
   const isSurface=['grass','dirt','gravel','asphalt','concrete'].includes(key);
   const m=isSurface?new B.StandardMaterial('gp-'+key,scene):new B.PBRMaterial('gp-'+key,scene);
   if(isSurface){m.diffuseColor=new B.Color3(...rgb);m.specularColor=B.Color3.Black();}
   else{m.albedoColor=new B.Color3(...rgb);m.metallic=['metal','trim'].includes(key)?.35:0;m.roughness=key==='glass'?.28:.87;}
   if(key==='glass')m.emissiveColor=new B.Color3(.015,.025,.025);
   state.materials[key]=m;
   if(isSurface){
    // Bilinear within a mip; nearest mip selection avoids trilinear double sampling.
    const t=new B.Texture(base+'assets/stock/textures/'+key+'.png',scene,false,false,B.Texture.LINEAR_LINEAR_MIPNEAREST,()=>{},()=>{m.diffuseTexture=null;m.diffuseColor=new B.Color3(...rgb);state.failed.push(key);for(const clone of state.surfaceClones)if(clone.metadata?.prototypeSurface===key){clone.diffuseTexture?.dispose();clone.diffuseTexture=null;clone.diffuseColor=new B.Color3(...rgb);}});t.uScale=t.vScale=1;t.anisotropicFilteringLevel=1;state.textures.push(t);m.diffuseTexture=t;m.diffuseColor=B.Color3.White();
   }
  }
  state.observer=scene.onBeforeRenderObservable.add(()=>{
   state.tick+=scene.getEngine().getDeltaTime();if(state.tick<100)return;state.tick=0;
   const c=scene.activeCamera;if(!c)return;
   for(const root of state.roots){if(root.isDisposed())continue;const ratio=B.Vector3.Distance(c.globalPosition,root.getAbsolutePosition())/root.metadata.graphicSpan,next=lod(root.metadata.graphicLOD,ratio);if(next!==root.metadata.graphicLOD){root.metadata.graphicLOD=next;root._gpLevels.forEach((n,i)=>n.setEnabled(i===next));}}
  });
  scene.onDisposeObservable.add(()=>{state.roots.clear();state.surfaceClones.clear();state.surfaces.clear();scenes.delete(scene);});scenes.set(scene,state);return state;
 }
 function assembly(scene,parent){
  const B=window.BABYLON,parts=new Map();
  function add(key,mesh,x,y,z,rotation=0){mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.isPickable=false;if(!parts.has(key))parts.set(key,[]);parts.get(key).push(mesh);return mesh;}
  return {box(key,x,y,z,w,h,d,r=0){return add(key,B.MeshBuilder.CreateBox('gp-part',{width:w,height:h,depth:d},scene),x,y,z,r);},cylinder(key,x,y,z,d,h){return add(key,B.MeshBuilder.CreateCylinder('gp-cylinder',{diameter:d,height:h,tessellation:10},scene),x,y,z);},finish(){const result=[];for(const [key,list] of parts){const merged=B.Mesh.MergeMeshes(list,true,true,undefined,false,false);merged.name='gp-'+key;merged.parent=parent;merged.material=resources(scene).materials[key];merged.isPickable=false;merged.receiveShadows=true;result.push(merged);}return result;}};
 }
 function createBuilding(runtime,data,parent){
  const B=window.BABYLON,scene=runtime?.scene,def=window.mapGameBuildings?.item(data.type),size=specs[data.type];
  if(!scene||!B||!size||!def)return null;
  const root=new B.TransformNode('gp-'+data.id,scene);root.parent=parent||null;root.position.set(data.x||0,data.y||0,data.z||0);root.rotation.y=data.rotation||0;
  root.metadata={placedBuilding:true,placedBuildingId:data.id,buildingType:data.type,ownerId:data.ownerId||'local',footprint:def.footprint.slice(),architecturalStyle:data.style||null,graphicLOD:0,graphicSpan:Math.max(size[0],size[2]),proceduralPrototype:true};
  root._gpLevels=[];const before=new Set(scene.meshes);
  try{
   for(let level=0;level<3;level++){
    const group=new B.TransformNode('gp-lod-'+level,scene);group.parent=root;root._gpLevels.push(group);const a=assembly(scene,group),[w,h,d]=size;
    a.box('concrete',0,.15,0,w,.3,d);
    if(data.type==='smallHouse'){
     a.box('wall',0,3.7,0,w*.78,7,d*.65);
     if(level===2)a.box('roof',0,8,0,w*.84,1.6,d*.72);
     else{const half=w*.46,roof=a.box('roof',-w*.20,9,0,half,.55,d*.74);roof.rotation.z=.48;const other=a.box('roof',w*.20,9,0,half,.55,d*.74);other.rotation.z=-.48;}
     if(level<2){a.box('brick',w*.25,9.4,d*.12,1.8,3,1.8);a.box('roof',0,3.4,-d*.40,6,.4,3.3);a.box('trim',0,1.5,-d*.335,1.8,3,.25);}
    }else if(data.type==='steelMill'){
     a.box('metal',0,8.1,0,w*.84,16,d*.68);
     const count=level===2?1:3;for(let i=0;i<count;i++){const panel=a.box('roof',0,18,(i-(count-1)/2)*d*.20,w*.87,.65,d*.21);if(level<2)panel.rotation.x=-.16;}
     if(level<2){for(let i=0;i<2;i++){a.cylinder('brick',w*(.27+i*.10),14,d*.29,3.2,28);a.cylinder('trim',w*(.27+i*.10),28.2,d*.29,3.8,.8);}for(let i=0;i<4;i++)a.box('trim',(i-1.5)*w*.17,3.5,-d*.345,w*.12,7,.4);}
    }else{
     a.box('wall',-w*.19,10,0,w*.40,20,d*.65);a.box('wall',w*.22,7,d*.10,w*.38,14,d*.58);a.box('roof',-w*.19,20.3,0,w*.43,.6,d*.68);a.box('roof',w*.22,14.3,d*.10,w*.41,.6,d*.61);
     if(level<2){a.box('glass',-w*.19,9,-d*.33,w*.38,16,.3);a.box('glass',w*.22,6,-d*.195,w*.36,10,.3);a.box('trim',0,1.8,-d*.36,w*.13,3.6,2);}
    }
    if(level===0){
     const rows=data.type==='smallHouse'?1:data.type==='steelMill'?2:5,cols=data.type==='smallHouse'?3:data.type==='officeLow'?6:8;
     for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=data.type==='officeLow'?-w*.19+(col-(cols-1)/2)*w*.34/cols:(col-(cols-1)/2)*w*.72/cols,y=data.type==='smallHouse'?4:data.type==='steelMill'?9+row*3.2:3+row*3.2,z=data.type==='smallHouse'?-d*.33:data.type==='steelMill'?-d*.346:-d*.332;
      a.box('trim',x,y,z,w*.55/cols,2.1,.4);a.box('glass',x,y,z-.23,w*.45/cols,1.65,.08);
     }
     if(data.type==='officeLow')for(let r=0;r<3;r++)for(let c=0;c<5;c++){a.box('trim',w*.22+(c-2)*w*.06,3+r*3.2,-d*.196,w*.055,2.1,.4);a.box('glass',w*.22+(c-2)*w*.06,3+r*3.2,-d*.200,w*.045,1.6,.1);}
     if(data.type!=='smallHouse')for(let i=0;i<3;i++)a.box('trim',w*(i-1)*.17,data.type==='steelMill'?19:21,0,w*.10,1.8,d*.12);
    }
    a.finish();group.setEnabled(level===0);
   }
  }catch(error){root.dispose();for(const mesh of scene.meshes.slice())if(!before.has(mesh))mesh.dispose();throw error;}
  const state=resources(scene);state.roots.add(root);root.onDisposeObservable.add(()=>state.roots.delete(root));return root;
 }
 function intersection(runtime,node,connections,parent,force=false){
  if(!force&&!enabled(runtime))return null;
  if(!runtime?.scene||!Number.isFinite(node?.x)||!Number.isFinite(node?.z)||!Number.isFinite(node.y||0)||connections?.length!==4||connections.some(s=>s.type!=='road2'||!Number.isFinite(Number(s.width||14))||Math.abs(Number(s.width||14)-14)>.1))return null;
  // Match graph tangents at this node; exclude bends, skewed and elevated crossings.
  const angles=[];
  for(const s of connections){const points=s.points||s.path||[];let p=points[0],q=points[1];if(!p||!q)return null;if(Math.hypot(p.x-node.x,p.z-node.z)>1){p=points.at(-1);q=points.at(-2);}if(![p.x,p.z,q.x,q.z,p.y||0,q.y||0].every(Number.isFinite)||Math.hypot(p.x-node.x,p.z-node.z)>1||Math.abs((p.y||0)-(node.y||0))>0.5||Math.abs((q.y||0)-(p.y||0))>.5)return null;angles.push(Math.atan2(q.z-p.z,q.x-p.x));}
  angles.sort((a,b)=>a-b);for(let i=0;i<4;i++){let gap=(angles[(i+1)%4]-angles[i]+Math.PI*2)%(Math.PI*2);if(Math.abs(gap-Math.PI/2)>.10)return null;}
  const B=window.BABYLON,root=new B.TransformNode('gp-intersection',runtime.scene);root.parent=parent||null;root.position.set(node.x,node.y||0,node.z);root.rotation.y=-angles[0];root.metadata={visualOnly:true,roadWidth:14,nodeId:node.id};
  const a=assembly(runtime.scene,root);a.box('asphalt',0,.44,0,20,.22,20);
  for(let i=0;i<4;i++){const r=i*Math.PI/2;for(let k=0;k<7;k++){const across=(k-3)*1.8;const x=across*Math.cos(r)+8*Math.sin(r),z=-across*Math.sin(r)+8*Math.cos(r);a.box('line',x,.61,z,1.1,.03,2.8,r);}a.box('concrete',(Math.cos(r)-Math.sin(r))*9,.34,(Math.sin(r)+Math.cos(r))*9,2,.42,2);}
  a.finish();return root;
 }
 function surface(scene,name,width,depth){const state=resources(scene),original=state.materials[name];if(!original||![width,depth].every(v=>Number.isFinite(v)&&v>0))return null;const cacheKey=JSON.stringify([name,width,depth]);if(state.surfaces.has(cacheKey))return state.surfaces.get(cacheKey);const mat=original.clone('gp-surface-'+name);const key=original.diffuseTexture?'diffuseTexture':'albedoTexture';if(original[key]){mat[key]=original[key].clone();mat[key].uScale=width/4;mat[key].vScale=depth/4;mat[key].anisotropicFilteringLevel=1;}mat.metadata={prototypeSurface:name};state.surfaceClones.add(mat);state.surfaces.set(cacheKey,mat);mat.onDisposeObservable.add(()=>{state.surfaceClones.delete(mat);state.surfaces.delete(cacheKey);});return mat;}
 const old=window.mapGameBuildings?.renderPlacedBuilding;
 if(old)window.mapGameBuildings.renderPlacedBuilding=function(runtime,data,parent){if(enabled(runtime)&&specs[data.type]){try{const root=createBuilding(runtime,data,parent);if(root)return root;}catch(_){/* Original visual remains usable. */}}return old(runtime,data,parent);};
 window.mapGameGraphicsPrototype={version:1,specs,lod,enabled,createBuilding,intersection,surface,legacyBuilding:old,diagnostics:scene=>({roots:scenes.get(scene)?.roots.size||0,missingTextures:[...(scenes.get(scene)?.failed||[])],surfaceCache:scenes.get(scene)?.surfaces.size||0})};
})();
