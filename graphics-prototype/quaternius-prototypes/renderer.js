// Isolated showroom only: shared source geometry, pooled thin-instance LOD batches.
(() => {
 'use strict';
 const B=window.BABYLON,base=new URL('.',document.currentScript.src),levels=['low','medium','high'],qualities=[...levels,'ultra'];
 const cap=q=>q==='ultra'?2:levels.indexOf(q),lodRatio=(q,r)=>q==='ultra'?r/1.5:r;
 function nextLOD(previous,ratio){if(previous===0)return ratio<6?1:0;if(previous===2)return ratio>3.5?1:2;return ratio<2.7?2:ratio>7?0:1;}
 function initialLOD(ratio){return ratio>7?0:ratio>3.5?1:2;}
 async function load(scene){
  const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('Pilot manifest unavailable');const manifest=await response.json();
  if(manifest.version!==1||manifest.kenneyUsed!==false||manifest.liveRendererEnabled!==false||manifest.url!=='generated/pilots.glb')throw Error('Unreviewed visual manifest');
  for(const spec of manifest.buildings){const def=mapGameBuildings.item(spec.id);if(!def||JSON.stringify(def.footprint)!==JSON.stringify(spec.footprint))throw Error('Canonical footprint mismatch');}
  const container=await B.SceneLoader.LoadAssetContainerAsync(new URL('generated/',base).href,'pilots.glb',scene),records=new Set(),distant=new Map(),batches=[],buckets=new Map(),planes=B.Frustum.GetPlanes(B.Matrix.Identity());
  let disposed=false,elapsed=150,dirty=true,lastCamera=null,bufferUploads=0,cullingPasses=0,poseRevision=0,nextId=1;
  try{
   // Exact High PBR materials and geometry remain in the source container.
   // Distant LODs retain real albedo maps with the existing cheaper shading.
   for(const mesh of container.meshes){
    if(!/^(low|medium)-/.test(mesh.name)||!mesh.material)continue;
    const src=mesh.material;
    if(!distant.has(src)){
     const m=new B.StandardMaterial(src.name+'-distant',scene);m.diffuseTexture=src.albedoTexture;m.diffuseColor=src.albedoColor.clone();m.alpha=src.alpha;m.backFaceCulling=src.backFaceCulling;m.specularColor=new B.Color3(.07,.07,.07);m.specularPower=24;m.freeze();distant.set(src,m);
    }mesh.material=distant.get(src);
   }
   for(const m of container.materials)m.freeze();
   const initialized=new Set();
   function ensureSpec(spec){
    if(initialized.has(spec.id))return;
    const template=container.transformNodes.find(n=>n.name===spec.id);if(!template)throw Error('Missing pilot template');
    for(let lod=0;lod<3;lod++){
     const group=template.getDescendants().find(n=>n.name===levels[lod]);if(!group)throw Error('Missing pilot LOD');
     const bucket={spec,lod,records:[],batches:[],lastKey:null};buckets.set(spec.id+':'+lod,bucket);
     for(const src of group.getChildMeshes()){
      // Keep the source glTF coordinate conversion on the batch mesh. Conjugate
      // instance matrices by it, so reflected handedness does not invert faces.
      const sourceWorld=src.computeWorldMatrix(true).clone(),inverse=sourceWorld.clone().invert(),mesh=src.clone('thin:'+spec.id+':'+src.name,null,true);
      mesh.parent=null;mesh.rotationQuaternion=new B.Quaternion();sourceWorld.decompose(mesh.scaling,mesh.rotationQuaternion,mesh.position);mesh.freezeWorldMatrix();mesh.isPickable=false;mesh.receiveShadows=true;mesh.setEnabled(false);
      const batch={mesh,sourceWorld,inverse,buffer:null,capacity:0};bucket.batches.push(batch);batches.push(batch);
     }
    }
    initialized.add(spec.id);
   }
   function invalidate(){dirty=true;poseRevision++;}
   function create(id,row={},quality='high'){
    if(disposed)throw Error('Disposed pool');const spec=manifest.buildings.find(b=>b.id===id);if(!spec||!qualities.includes(quality))throw Error('Unsupported pilot or quality');
    ensureSpec(spec);
    const root=new B.TransformNode('quaternius-'+(row.id??records.size),scene);root.position.set(row.x||0,row.y||0,row.z||0);root.rotation.y=row.rotation||0;
    const height=spec.lods[2].bounds[1][1],record={root,spec,quality,lod:0,culled:false,center:new B.Vector3(root.position.x,root.position.y+height/2,root.position.z),radius:Math.hypot(spec.footprint[0]/2,spec.footprint[1]/2,height/2),world:B.Matrix.Identity(),revision:0,uid:nextId++};
    record.level=index=>{record.lod=Math.max(0,Math.min(index,cap(record.quality)));invalidate();};
    record.update=(next={})=>{for(const key of ['x','y','z'])if(next[key]!==undefined){if(!Number.isFinite(next[key]))throw Error('Invalid position');root.position[key]=next[key];}if(next.rotation!==undefined){if(!Number.isFinite(next.rotation))throw Error('Invalid rotation');root.rotation.y=next.rotation;}record.center.copyFrom(root.position);record.center.y+=height/2;record.revision++;invalidate();};
    root.onDisposeObservable.add(()=>{if(records.delete(record))invalidate();});
    record.dispose=()=>{if(!records.delete(record))return;root.dispose();invalidate();};
    record.lod=Math.min(initialLOD(lodRatio(quality,B.Vector3.Distance(scene.activeCamera?.globalPosition||B.Vector3.Zero(),root.position)/Math.max(...spec.footprint))),cap(quality));records.add(record);invalidate();return record;
   }
   function sync(force=false){
    if(disposed)return;const camera=scene.activeCamera;if(!camera)return;
    const transform=scene.getTransformMatrix(),m=transform.m;let moved=force||!lastCamera;
    if(!moved)for(let i=0;i<16;i++)if(Math.abs(m[i]-lastCamera[i])>1e-7){moved=true;break;}
    if(!dirty&&!moved)return;
    if(!lastCamera)lastCamera=new Float32Array(16);lastCamera.set(m);B.Frustum.GetPlanesToRef(transform,planes);cullingPasses++;
    for(const bucket of buckets.values())bucket.records.length=0;
    let settling=false;
    for(const r of records){
     const ratio=B.Vector3.Distance(camera.globalPosition,r.root.position)/Math.max(...r.spec.footprint);r.lod=Math.min(nextLOD(r.lod,lodRatio(r.quality,ratio)),cap(r.quality));
     if(Math.min(nextLOD(r.lod,lodRatio(r.quality,ratio)),cap(r.quality))!==r.lod)settling=true;
     const pixels=Math.max(...r.spec.footprint)*scene.getEngine().getRenderHeight()/(2*Math.tan(camera.fov/2)*Math.max(1,B.Vector3.Distance(camera.globalPosition,r.root.position)));
     r.culledReason=pixels<(r.culledReason==='distance'?1.5:1)?'distance':planes.some(p=>p.dotCoordinate(r.center)<-r.radius*1.15)?'frustum':null;r.culled=!!r.culledReason;
     if(!r.culled){r.root.computeWorldMatrix(true);r.world.copyFrom(r.root.getWorldMatrix());buckets.get(r.spec.id+':'+r.lod).records.push(r);}
    }
    for(const bucket of buckets.values()){
     const key=bucket.records.map(r=>r.uid+':'+r.revision).join(',');if(key===bucket.lastKey)continue;bucket.lastKey=key;
     for(const batch of bucket.batches){
     const n=bucket.records.length;
     if(!n){batch.mesh.thinInstanceCount=0;batch.mesh.setEnabled(false);continue;}
     if(batch.capacity<n){batch.capacity=Math.max(16,2**Math.ceil(Math.log2(n)));batch.buffer=new Float32Array(batch.capacity*16);batch.mesh.thinInstanceSetBuffer('matrix',batch.buffer,16,false);}
     for(let i=0;i<n;i++)batch.sourceWorld.multiply(bucket.records[i].world).multiply(batch.inverse).copyToArray(batch.buffer,i*16);
     batch.mesh.thinInstanceCount=n;batch.mesh.thinInstanceBufferUpdated('matrix');batch.mesh.thinInstanceRefreshBoundingInfo(true);batch.mesh.setEnabled(true);bufferUploads++;
    }
    }
    dirty=settling;
   }
   const observer=scene.onBeforeRenderObservable.add(()=>{elapsed+=scene.getEngine().getDeltaTime();if(!dirty&&elapsed<150)return;elapsed=0;sync();});
   const api={manifest,create,sync,batchMeshes:()=>batches.map(b=>b.mesh),setQuality(q){if(!qualities.includes(q))throw Error('Unsupported detail');for(const r of records){r.quality=q;r.lod=Math.min(r.lod,cap(q));}invalidate();},stats(){const lodCounts=[0,0,0];let triangles=0,culled=0,visible=0;for(const r of records){if(r.culled){culled++;continue;}visible++;lodCounts[r.lod]++;triangles+=r.spec.lods[r.lod].triangles;}return{instances:records.size,templates:initialized.size,availableTemplates:manifest.buildings.length,lodCounts,visibleRecords:visible,culledRecords:culled,configuredTriangles:triangles,batchMeshes:batches.length,activeBatches:batches.filter(b=>b.mesh.isEnabled()).length,sharedMaterials:container.materials.length+distant.size,sharedTextureFiles:manifest.textures.length,estimatedTextureRgbaMipBytes:manifest.textures.reduce((n,t)=>n+t.estimatedRgbaMipBytes,0),instanceBufferCapacityBytes:batches.reduce((n,b)=>n+b.capacity*16*4,0),bufferUploads,cullingPasses,poseRevision};},dispose(){if(disposed)return;disposed=true;scene.onBeforeRenderObservable.remove(observer);for(const r of [...records])r.dispose();for(const b of batches)b.mesh.dispose(false,false);for(const m of distant.values())m.dispose(false,false);container.dispose();buckets.clear();batches.length=0;}};
   scene.onDisposeObservable.add(()=>api.dispose());return api;
  }catch(error){for(const b of batches)b.mesh.dispose(false,false);for(const m of distant.values())m.dispose(false,false);container.dispose();throw error;}
 }
 window.mapGameQuaterniusGraphics={load,nextLOD,initialLOD};
})();
