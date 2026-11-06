// Isolated Kenney showroom renderer. Never installs a live-game rendering hook.
(() => {
 'use strict';
 const B=window.BABYLON,base=new URL('.',document.currentScript.src),scenes=new WeakMap();
 const levels=['low','medium','high'],budgets={low:0,medium:1,high:2,ultra:2};
 function nextLOD(previous,ratio){if(previous===0)return ratio<6?1:0;if(previous===2)return ratio>3.5?1:2;return ratio<2.7?2:ratio>7?0:1;}
 async function load(scene,options={}){
  if(scenes.has(scene))return scenes.get(scene);
  const pending=(async()=>{
   const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('Factory manifest unavailable');const manifest=await response.json();
   if(manifest.version!==1||manifest.buildings.length!==4)throw Error('Unsupported factory manifest');
   for(const b of manifest.buildings){const def=mapGameBuildings.item(b.id);if(!def||JSON.stringify(def.footprint)!==JSON.stringify(b.footprint)||b.url!=='generated/'+b.id+'.glb')throw Error('Factory/catalog mismatch');}
   const containers=new Map(),animated=new Map(),roots=new Set(),materials=new Map(),textures=new Map(),distantMaterials=new Map();let disposed=false,tick=0;
   const imported=[];
   try{
    // Sequential imports make shared palette ownership deterministic.
    for(const spec of manifest.buildings){
     const container=await B.SceneLoader.LoadAssetContainerAsync(base.href,spec.url,scene);imported.push(container);containers.set(spec.id,container);
     for(const mat of container.materials){
      if(materials.has(mat.name)){for(const mesh of container.meshes)if(mesh.material===mat)mesh.material=materials.get(mat.name);mat.dispose(false,false);}
      else{
       materials.set(mat.name,mat);const tex=mat.albedoTexture;if(tex){const key=mat.name.split('-')[0];if(textures.has(key)){mat.albedoTexture=textures.get(key);if(tex!==mat.albedoTexture)tex.dispose();}else textures.set(key,tex);}
       mat.freeze();
      }
     }
     // Palette PBR is costly at city-scale screen coverage on software GPUs.
     // Distant LODs retain the palette and normals with shared diffuse/specular
     // shading. High detail keeps the original PBR/glazing treatment.
     for(const mesh of container.meshes){
      if(options.distantMaterials===false||!/^(low|medium)-/.test(mesh.name)||!mesh.material)continue;
      const source=mesh.material;
      if(!distantMaterials.has(source.name)){
       const mat=new B.StandardMaterial(source.name+'-distant',scene);mat.diffuseTexture=source.albedoTexture;mat.diffuseColor=source.albedoColor.clone();mat.alpha=source.alpha;mat.backFaceCulling=source.backFaceCulling;mat.twoSidedLighting=source.twoSidedLighting;mat.specularColor=new B.Color3(.08,.08,.08);mat.specularPower=24;mat.freeze();distantMaterials.set(source.name,mat);
      }
      mesh.material=distantMaterials.get(source.name);
     }
     for(const part of spec.animatedParts){
      if(part.source!=='source/factory/piston-square.glb')throw Error('Unreviewed animated source');
      const c=await B.SceneLoader.LoadAssetContainerAsync(new URL('source/factory/',base).href,'piston-square.glb',scene);imported.push(c);animated.set(spec.id,c);
     }
    }
   }catch(error){for(const m of distantMaterials.values())m.dispose(false,false);for(const c of imported)c.dispose();throw error;}
   function create(id,data={},options={}){
    if(disposed)throw Error('Factory pool disposed');const spec=manifest.buildings.find(x=>x.id===id);if(!spec)return null;
    const root=new B.TransformNode('factory-'+(data.id||roots.size),scene);root.position.set(data.x||0,data.y||0,data.z||0);root.rotation.y=data.rotation||0;
    const entry=containers.get(id).instantiateModelsToScene(n=>root.name+':'+n,false,{doNotInstantiate:options.ghost===true});for(const n of entry.rootNodes)n.parent=root;
    const groups=levels.map(label=>root.getDescendants().find(n=>n.name===root.name+':'+label));if(groups.some(n=>!n)){entry.dispose();root.dispose();throw Error('Missing factory LOD');}
    const record={root,spec,groups,entry,lod:-1,quality:options.quality||'high',ghost:options.ghost===true,animated:null};roots.add(record);
    const ghostMaterials=new Map();
    for(const mesh of root.getChildMeshes()){
     mesh.isPickable=false;mesh.receiveShadows=true;
     if(record.ghost&&mesh.material){
      const source=mesh.material;
      if(!ghostMaterials.has(source.name)){
       // A depth prepass makes the translucent preview show its front surface,
       // rather than unsorted interior triangles from a merged factory batch.
       const mat=new B.StandardMaterial(root.name+':ghost:'+source.name,scene);mat.diffuseTexture=source.diffuseTexture||source.albedoTexture;mat.diffuseColor=(source.diffuseColor||source.albedoColor).clone();mat.specularColor=new B.Color3(.05,.05,.05);mat.alpha=.38;mat.needDepthPrePass=true;mat.backFaceCulling=true;ghostMaterials.set(source.name,mat);
      }
      mesh.material=ghostMaterials.get(source.name);
     }
    }
    function level(index){index=Math.max(0,Math.min(index,budgets[record.quality]??2));record.lod=index;groups.forEach((n,i)=>n.setEnabled(i===index));if(record.animated)record.animated.root.setEnabled(index===2);}
    record.level=level;level(budgets[record.quality]??2);addAnimation(record);if(record.animated)record.animated.root.setEnabled(false);
    record.dispose=()=>{if(!roots.has(record))return;roots.delete(record);record.animated?.entry.dispose();record.animated?.root.dispose();entry.dispose();root.dispose();};
    root.onDisposeObservable.add(()=>{roots.delete(record);for(const mat of ghostMaterials.values())mat.dispose(false,false);ghostMaterials.clear();});
    return record;
   }
   function addAnimation(record){
    if(record.animated||!animated.has(record.spec.id)||record.ghost)return;
    const part=record.spec.animatedParts[0],r=new B.TransformNode('separate-piston',scene),entry=animated.get(record.spec.id).instantiateModelsToScene(n=>'piston:'+n,false,{doNotInstantiate:false});for(const n of entry.rootNodes)n.parent=r;
    r.rotation.y=(part.rotation||0)*Math.PI/180;r.computeWorldMatrix(true);const bounds=r.getHierarchyBoundingVectors(true),size=bounds.max.subtract(bounds.min);
    r.scaling.set(part.dimensions[0]/size.x,part.dimensions[1]/size.y,part.dimensions[2]/size.z);if(part.preserveAspect)r.scaling.setAll(Math.min(r.scaling.x,r.scaling.y,r.scaling.z));r.computeWorldMatrix(true);const fit=r.getHierarchyBoundingVectors(true);
    r.position.set(part.position[0]-(fit.min.x+fit.max.x)/2,part.position[1]-fit.min.y,part.position[2]-(fit.min.z+fit.max.z)/2);r.parent=record.root;
    for(const mesh of r.getChildMeshes())mesh.isPickable=false;record.animated={root:r,entry};
   }
   const observer=scene.onBeforeRenderObservable.add(()=>{
    tick+=scene.getEngine().getDeltaTime();if(tick<150)return;tick=0;const camera=scene.activeCamera;if(!camera)return;
    const near=[];
    for(const r of roots){if(r.ghost)continue;const distance=B.Vector3.Distance(camera.globalPosition,r.root.getAbsolutePosition()),ratio=distance/Math.max(...r.spec.footprint);const lod=Math.min(nextLOD(r.lod,ratio),budgets[r.quality]??2);if(lod!==r.lod)r.level(lod);if(r.lod===2&&r.spec.animatedParts.length)near.push({r,distance});}
    near.sort((a,b)=>a.distance-b.distance);const allowed=new Set(near.slice(0,8).map(x=>x.r));
    for(const r of roots){if(!r.animated)continue;const on=allowed.has(r)&&r.lod===2;r.animated.root.setEnabled(on);for(const g of r.animated.entry.animationGroups){const play=on&&r.quality==='ultra'&&g.name.endsWith('toggle')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(play&&!g.isPlaying)g.start(true);if(!play&&g.isPlaying)g.stop();}}
   });
   const pool={manifest,create,setQuality(quality){if(!(quality in budgets))throw Error('Unknown graphics quality');for(const r of roots){r.quality=quality;r.level(Math.min(r.lod,budgets[quality]));}},stats(){return{instances:roots.size,templates:containers.size,sharedMaterials:materials.size+distantMaterials.size,sharedPalettes:textures.size,lodCounts:levels.map((_,i)=>[...roots].filter(r=>r.lod===i).length),configuredTriangles:[...roots].reduce((n,r)=>n+r.spec.lods[r.lod].triangles,0),animatedProps:[...roots].filter(r=>r.animated?.root.isEnabled()).length};},dispose(){if(disposed)return;disposed=true;scene.onBeforeRenderObservable.remove(observer);for(const r of [...roots])r.dispose();for(const m of distantMaterials.values())m.dispose(false,false);for(const c of imported)c.dispose();roots.clear();scenes.delete(scene);}};
   scene.onDisposeObservable.add(()=>pool.dispose());return pool;
  })();scenes.set(scene,pending);try{return await pending;}catch(e){scenes.delete(scene);throw e;}
 }
 window.mapGameFactoryGraphics={load,nextLOD,budgets};
})();
