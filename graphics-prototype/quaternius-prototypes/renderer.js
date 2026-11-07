// Opt-in showroom pool only. No hooks into the main game, saves or economy.
(() => {
 'use strict';
 const B=window.BABYLON,base=new URL('.',document.currentScript.src),levels=['low','medium','high'];
 function nextLOD(previous,ratio){if(previous===0)return ratio<6?1:0;if(previous===2)return ratio>3.5?1:2;return ratio<2.7?2:ratio>7?0:1;}
 async function load(scene){
  const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('Pilot manifest unavailable');const manifest=await response.json();
  if(manifest.version!==1||manifest.kenneyUsed!==false||manifest.liveRendererEnabled!==false||manifest.url!=='generated/pilots.glb')throw Error('Unreviewed visual manifest');
  for(const spec of manifest.buildings){const def=mapGameBuildings.item(spec.id);if(!def||JSON.stringify(def.footprint)!==JSON.stringify(spec.footprint))throw Error('Canonical footprint mismatch');}
  const container=await B.SceneLoader.LoadAssetContainerAsync(new URL('generated/',base).href,'pilots.glb',scene),records=new Set(),distant=new Map();let disposed=false,elapsed=0;
  try{
   const templates=new Map(manifest.buildings.map(b=>[b.id,container.transformNodes.find(n=>n.name===b.id)]));if([...templates.values()].some(x=>!x))throw Error('Missing pilot template');
   // Low/medium keep the real base-color maps; expensive normal/PBR work is close-only.
   for(const mesh of container.meshes){
    if(!/^(low|medium)-/.test(mesh.name)||!mesh.material)continue;
    const src=mesh.material;if(!distant.has(src)){
     const m=new B.StandardMaterial(src.name+'-distant',scene);m.diffuseTexture=src.albedoTexture;m.diffuseColor=src.albedoColor.clone();m.alpha=src.alpha;m.backFaceCulling=src.backFaceCulling;m.specularColor=new B.Color3(.07,.07,.07);m.specularPower=24;m.freeze();distant.set(src,m);
    }mesh.material=distant.get(src);
   }
   for(const m of container.materials)m.freeze();
   for(const m of container.meshes)m.receiveShadows=true;
   function create(id,row={},quality='high'){
    if(disposed)throw Error('Disposed pool');const spec=manifest.buildings.find(b=>b.id===id);if(!spec)throw Error('Unsupported pilot');
    const root=new B.TransformNode('quaternius-'+(row.id??records.size),scene);root.position.set(row.x||0,row.y||0,row.z||0);root.rotation.y=row.rotation||0;
    const conversion=new B.TransformNode('gltf-coordinate-conversion',scene);conversion.parent=root;const imported=container.rootNodes[0];conversion.scaling.copyFrom(imported.scaling);if(imported.rotationQuaternion)conversion.rotationQuaternion=imported.rotationQuaternion.clone();
    const clone=templates.get(id).instantiateHierarchy(conversion,{doNotInstantiate:false},(source,copy)=>{copy.metadata={pilotSourceName:source.name};});
    if(!clone){root.dispose();throw Error('Unable to instance pilot');}
    const groups=levels.map(l=>clone.getDescendants().find(n=>n.metadata?.pilotSourceName===l));if(groups.some(x=>!x)){root.dispose();throw Error('Missing pilot LOD');}
    const record={root,clone,spec,lod:2,quality};for(const m of root.getChildMeshes()){m.isPickable=false;}
    record.level=index=>{record.lod=Math.min(index,levels.indexOf(record.quality));groups.forEach((g,i)=>g.setEnabled(i===record.lod));};record.level(levels.indexOf(quality));
    record.dispose=()=>{records.delete(record);root.dispose();};records.add(record);return record;
   }
   const observer=scene.onBeforeRenderObservable.add(()=>{elapsed+=scene.getEngine().getDeltaTime();if(elapsed<150)return;elapsed=0;const camera=scene.activeCamera;if(!camera)return;for(const r of records){const ratio=B.Vector3.Distance(camera.globalPosition,r.root.position)/Math.max(...r.spec.footprint),lod=nextLOD(r.lod,ratio);if(lod!==r.lod)r.level(lod);}});
   const api={manifest,create,setQuality(q){if(!levels.includes(q))throw Error('Unsupported detail');for(const r of records){r.quality=q;r.level(levels.indexOf(q));}},stats(){return{instances:records.size,templates:templates.size,lodCounts:levels.map((_,i)=>[...records].filter(r=>r.lod===i).length),configuredTriangles:[...records].reduce((sum,r)=>sum+r.spec.lods[r.lod].triangles,0),sharedMaterials:container.materials.length+distant.size,sharedTextureFiles:manifest.textures.length,estimatedTextureRgbaMipBytes:manifest.textures.reduce((sum,t)=>sum+t.estimatedRgbaMipBytes,0)};},dispose(){if(disposed)return;disposed=true;scene.onBeforeRenderObservable.remove(observer);for(const r of [...records])r.dispose();for(const m of distant.values())m.dispose(false,false);container.dispose();}};scene.onDisposeObservable.add(()=>api.dispose());return api;
  }catch(e){for(const m of distant.values())m.dispose(false,false);container.dispose();throw e;}
 }
 window.mapGameQuaterniusGraphics={load,nextLOD};
})();
