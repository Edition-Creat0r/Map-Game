// ============================================================
// MAP GAME — roads.js
// Alpha 0.2.2A1 — road graph / city connection foundation
// ============================================================
(() => {
  "use strict";
  const ROAD_TYPES = window.mapGameWorldConfig?.roadClasses || {};
  const graphs = new Map();

  function graphFor(territoryId) {
    if (!graphs.has(territoryId)) {
      graphs.set(territoryId, {
        territoryId, nodes:new Map(), segments:new Map(),
        nextNode:1, nextSegment:1
      });
    }
    return graphs.get(territoryId);
  }

  function nearestNode(territoryId, x, z, maxDistance=18) {
    const g = graphFor(territoryId);
    let best=null, bestD=maxDistance;
    for (const node of g.nodes.values()) {
      const d = Math.hypot(node.x-x, node.z-z);
      if (d <= bestD) { best=node; bestD=d; }
    }
    return best;
  }

  function addNode(territoryId, x, z, metadata={}) {
    const g=graphFor(territoryId);
    const node={id:`N${g.nextNode++}`,x,z,metadata:{...metadata}};
    g.nodes.set(node.id,node);
    return node;
  }

  function getOrCreateNode(territoryId,x,z,snap=18,metadata={}) {
    return nearestNode(territoryId,x,z,snap) ||
      addNode(territoryId,x,z,metadata);
  }

  function addSegment(territoryId,{ax,az,bx,bz,type="road2",snapDistance=18,metadata={}}) {
    const g=graphFor(territoryId);
    const spec=ROAD_TYPES[type] || {id:type,width:14,speed:50,costPer100m:240};
    const a=getOrCreateNode(territoryId,ax,az,snapDistance,{endpoint:true});
    const b=getOrCreateNode(territoryId,bx,bz,snapDistance,{endpoint:true});
    const length=Math.hypot(b.x-a.x,b.z-a.z);
    if (length < 3) throw new Error("Road segment is too short.");
    const seg={
      id:`R${g.nextSegment++}`, a:a.id, b:b.id, type:spec.id || type,
      width:spec.width || 14, speed:spec.speed || 50, length,
      cost:Math.ceil(length/100*Number(spec.costPer100m||0)),
      metadata:{...metadata}
    };
    g.segments.set(seg.id,seg);
    return seg;
  }

  function neighbors(g,id) {
    const out=[];
    for (const s of g.segments.values()) {
      if (s.a===id) out.push({nodeId:s.b,segment:s});
      else if (s.b===id) out.push({nodeId:s.a,segment:s});
    }
    return out;
  }

  function pathExists(territoryId,startNodeId,endNodeId) {
    const g=graphFor(territoryId);
    if (!g.nodes.has(startNodeId)||!g.nodes.has(endNodeId)) return false;
    const q=[startNodeId], seen=new Set(q);
    while(q.length){
      const id=q.shift();
      if(id===endNodeId) return true;
      for(const next of neighbors(g,id)){
        if(!seen.has(next.nodeId)){seen.add(next.nodeId);q.push(next.nodeId);}
      }
    }
    return false;
  }

  function canFoundSecondaryCity(territoryId,capitalPoint,proposedPoint,{maxCapitalSnap=90,maxCitySnap=90}={}) {
    const a=nearestNode(territoryId,capitalPoint.x,capitalPoint.z,maxCapitalSnap);
    const b=nearestNode(territoryId,proposedPoint.x,proposedPoint.z,maxCitySnap);
    if(!a||!b){
      return {allowed:false,reason:"Build a road, highway or freeway from the existing city network to this site first."};
    }
    const connected=pathExists(territoryId,a.id,b.id);
    return {
      allowed:connected,
      reason:connected ? "Connected to the existing civilization." :
        "This site is not connected to your existing civilization by road.",
      capitalNodeId:a.id, cityNodeId:b.id
    };
  }

  function serialize(territoryId){
    const g=graphFor(territoryId);
    return {territoryId,nodes:[...g.nodes.values()],segments:[...g.segments.values()]};
  }

  function load(data){
    if(!data?.territoryId)return;
    const g=graphFor(data.territoryId);
    g.nodes.clear(); g.segments.clear();
    for(const n of data.nodes||[]) g.nodes.set(n.id,{...n});
    for(const s of data.segments||[]) g.segments.set(s.id,{...s});
  }

  window.mapGameRoads={
    VERSION:"0.2.2A1",ROAD_TYPES,graphFor,nearestNode,addNode,addSegment,
    pathExists,canFoundSecondaryCity,serialize,load
  };
  console.log("Map Game roads 0.2.2A1 ready.");
})();