/* Checkpoint 1: pure fixture routing. No DOM, storage, economy or game imports. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.InfrastructureCore=api;})(globalThis,()=>{
 'use strict';
 const EPS=1e-7,clone=x=>JSON.parse(JSON.stringify(x));
 const TYPES=Object.freeze({
  road:Object.freeze({id:'road',label:'Local road fixture',width:14,rate:2.4,upkeepRate:.012,color:'#7ee7b4'}),
  rail:Object.freeze({id:'rail',label:'Rail corridor fixture',width:10,rate:6,upkeepRate:.025,color:'#cbb3ff'}),
  power:Object.freeze({id:'power',label:'Power corridor fixture',width:6,rate:1.8,upkeepRate:.008,color:'#ffda88'})
 });
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),same=(a,b)=>distance(a,b)<EPS;
 const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
 const key=p=>p.x.toFixed(5)+':'+p.z.toFixed(5);
 function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function project(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return {x:a.x+t*dx,z:a.z+t*dz,t};}
 function clip(a,b,box,pad=0){let lo=0,hi=1;const dx=b.x-a.x,dz=b.z-a.z;
  for(const [p,q]of [[-dx,a.x-box.x+pad],[dx,box.x+box.w+pad-a.x],[-dz,a.z-box.z+pad],[dz,box.z+box.d+pad-a.z]]){if(Math.abs(p)<EPS){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}
  return {lo,hi};
 }
 function intersection(a,b,c,d){const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,cross=rx*sz-rz*sx;
  if(Math.abs(cross)<EPS){if(Math.abs((c.x-a.x)*rz-(c.z-a.z)*rx)>EPS)return null;const len=distance(a,b);if(len<EPS)return null;const axis=Math.abs(rx)>Math.abs(rz)?'x':'z',den=b[axis]-a[axis],t0=(c[axis]-a[axis])/den,t1=(d[axis]-a[axis])/den;const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(1,Math.max(t0,t1));if(hi-lo>EPS)return {overlap:true};if(hi>=lo-EPS){const point={x:a.x+lo*rx,z:a.z+lo*rz};return {...point,t:lo,u:project(point,c,d).t};}return null;}
  const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/cross,u=((c.x-a.x)*rz-(c.z-a.z)*rx)/cross;
  return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{x:a.x+t*rx,z:a.z+t*rz,t,u}:null;
 }
 function inside(p,b,pad=0){return p.x>=b.x-pad-EPS&&p.x<=b.x+b.w+pad+EPS&&p.z>=b.z-pad-EPS&&p.z<=b.z+b.d+pad+EPS;}
 function legalLine(world,a,b,type){const pad=type.width/2+2;if(!validPoint(a)||!validPoint(b)||!inside(a,world.bounds,-pad)||!inside(b,world.bounds,-pad))return false;return !world.obstacles.some(o=>clip(a,b,o,pad));}
 function snap(world,p,kind,radius=24){if(!validPoint(p))throw Error('Invalid point');let best=null;
  for(const edge of world.edges){if(edge.kind!==kind)continue;const q=project(p,edge.a,edge.b),dist=distance(p,q);if(dist>radius)continue;
   const candidate={point:{x:q.x,z:q.z},edgeId:edge.id,kind:q.t<EPS||q.t>1-EPS?'endpoint':'segment',distance:dist};
   if(!best||dist<best.distance-EPS||(Math.abs(dist-best.distance)<EPS&&candidate.edgeId<best.edgeId))best=candidate;
  }
  return best||{point:{x:p.x,z:p.z},kind:'free',distance:0};
 }
 class Heap{constructor(){this.a=[];}less(a,b){return a.f<b.f-EPS||(Math.abs(a.f-b.f)<EPS&&(a.h<b.h-EPS||(Math.abs(a.h-b.h)<EPS&&a.order<b.order)));}push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(!this.less(v,this.a[p]))break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const top=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.less(this.a[c+1],this.a[c]))c++;if(!this.less(this.a[c],last))break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return top;}get length(){return this.a.length;}}
 function routeLeg(world,start,end,type,options={}){
  if(!legalLine(world,start,start,type)||!legalLine(world,end,end,type))return {error:'Endpoint is blocked or outside the site',expanded:0};
  if(legalLine(world,start,end,type))return {points:[start,end],expanded:0};
  const step=options.step||20,budget=options.budget||25000,dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],open=new Heap(),cost=new Map();let order=0,expanded=0;
  const first={p:start,d:-1,g:0,h:distance(start,end),parent:null,id:'start',order:order++};first.f=first.h;open.push(first);cost.set(first.id,0);let goal=null;
  while(open.length&&expanded<budget){const n=open.pop();if(n.g>(cost.get(n.id)??Infinity)+EPS)continue;expanded++;
   if(distance(n.p,end)<=step*1.6&&legalLine(world,n.p,end,type)){goal={p:end,parent:n};break;}
   const candidates=[];
   if(n.d===-1){const ix=Math.round(start.x/step),iz=Math.round(start.z/step);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)candidates.push({p:{x:(ix+x)*step,z:(iz+z)*step},d:8});}
   else for(let d=0;d<8;d++)candidates.push({p:{x:n.p.x+dirs[d][0]*step,z:n.p.z+dirs[d][1]*step},d});
   for(const c of candidates){if(same(n.p,c.p)||!legalLine(world,n.p,c.p,type))continue;const id=key(c.p)+':'+c.d,turn=n.d>=0&&n.d!==c.d?step*.16:0,g=n.g+distance(n.p,c.p)+turn;if(g>=(cost.get(id)??Infinity)-EPS)continue;cost.set(id,g);const h=distance(c.p,end);open.push({...c,id,g,h,f:g+h,parent:n,order:order++});}
  }
  if(!goal)return {error:expanded>=budget?'Routing search limit reached; add a waypoint':'No valid corridor around the obstacles',expanded};
  const points=[];for(let n=goal;n;n=n.parent)points.push(n.p);points.reverse();const smooth=[points[0]];let i=0;while(i<points.length-1){let j=points.length-1;while(j>i+1&&!legalLine(world,points[i],points[j],type))j--;smooth.push(points[j]);i=j;}
  return {points:smooth,expanded};
 }
 function intentKey(intent){return JSON.stringify({kind:intent.kind,start:intent.start,end:intent.end,waypoints:intent.waypoints||[]});}
 function plan(world,intent,options={}){
  const type=(options.profiles||TYPES)[intent.kind];if(!type)throw Error('Unknown infrastructure type');if(!validPoint(intent.start)||!validPoint(intent.end)||(intent.waypoints||[]).some(p=>!validPoint(p)))throw Error('Invalid coordinates');
  const start=snap(world,intent.start,intent.kind),end=snap(world,intent.end,intent.kind),anchors=[start.point,...(intent.waypoints||[]).map(p=>({x:p.x,z:p.z})),end.point];let points=[],expanded=0,error=null;
  for(let i=1;i<anchors.length;i++){if(same(anchors[i-1],anchors[i])){error='Route points must be distinct';break;}const leg=(options.routeLeg||routeLeg)(world,anchors[i-1],anchors[i],type,options);expanded+=leg.expanded;if(leg.error){error=leg.error;break;}points.push(...(i===1?leg.points:leg.points.slice(1)));}
  if(!error&&type.validateRoute){const reason=type.validateRoute(freeze(clone(points)),freeze(clone(world)));if(reason!==null&&reason!==undefined&&typeof reason!=='string')throw Error('Route validator must return a reason or null');error=reason||null;}
  const connections=[],crossings=[];let length=0,specialLength=0;
  if(!error)for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];length+=distance(a,b);
   for(let j=1;j<i;j++){const hit=intersection(a,b,points[j-1],points[j]);if(hit&&(hit.overlap||j<i-1)){error='Route crosses or overlaps itself';break;}}
   for(const edge of world.edges){const hit=intersection(a,b,edge.a,edge.b);if(!hit)continue;if(hit.overlap){error='Route overlaps existing infrastructure';break;}const item={point:{x:hit.x,z:hit.z},edgeId:edge.id,kind:edge.kind};(edge.kind===intent.kind?connections:crossings).push(item);}
   for(const area of world.special){const hit=clip(a,b,area);if(hit)specialLength+=(hit.hi-hit.lo)*distance(a,b);}
  }
  const unique=items=>[...new Map(items.map(x=>[x.edgeId+':'+key(x.point),x])).values()];
  const base=Math.ceil(length*type.rate),surcharge=Math.ceil(specialLength*type.rate*.75+unique(crossings).length*120),cost=base+surcharge;
  const result={revision:world.revision,intent:clone(intent),intentKey:intentKey(intent),kind:intent.kind,points,error,valid:!error,state:error?'blocked':(specialLength>EPS||crossings.length)?'special':connections.length?'connected':'valid',length,cost,base,surcharge,upkeep:Math.ceil(length*type.upkeepRate*100)/100,connections:unique(connections),crossings:unique(crossings),snaps:{start,end},expanded};
  return freeze(result);
 }
 function fixture(){return {revision:0,funds:15000,bounds:{x:0,z:0,w:1000,d:700},obstacles:[{id:'factory',label:'Existing factory',x:320,z:210,w:160,d:150},{id:'warehouse',label:'Warehouse',x:610,z:390,w:150,d:120},{id:'homes',label:'Reserved buildings',x:120,z:440,w:150,d:100}],special:[{id:'corridor',label:'Special-cost corridor',x:520,z:0,w:35,d:700}],edges:[{id:'road-1',kind:'road',a:{x:90,z:120},b:{x:270,z:120}},{id:'rail-1',kind:'rail',a:{x:820,z:100},b:{x:820,z:570}},{id:'power-1',kind:'power',a:{x:120,z:610},b:{x:420,z:610}}],nextId:1,receipts:{}};}
 function createPlanner(profiles=TYPES,router=routeLeg){const types=Object.freeze(Object.fromEntries(Object.entries(profiles).map(([id,spec])=>[id,Object.freeze({...spec})]))),planner=(world,intent,options={})=>plan(world,intent,{...options,profiles:types,routeLeg:router});planner.types=types;return planner;}
 class MockStore{
  constructor(state=fixture(),planner=plan){this.planner=planner;this.types=planner.types||TYPES;this.state=clone(state);this.failAt=null;this.listeners=[];this.operationSequence=Math.max(0,...Object.keys(this.state.receipts).map(k=>Number(k.replace(/^prototype-/,''))||0));}
  propose(intent){return this.planner(freeze(this.snapshot()),intent);}
  allocateOperationId(){return 'prototype-'+ ++this.operationSequence;}
  snapshot(){return clone(this.state);}
  subscribe(fn){this.listeners.push(fn);return()=>{this.listeners=this.listeners.filter(f=>f!==fn);};}
  commit(proposal,operationId){if(typeof operationId!=='string'||!operationId)throw Error('Operation identity required');if(['__proto__','constructor','prototype'].includes(operationId))throw Error('Invalid operation identity');const prior=Object.hasOwn(this.state.receipts,operationId)?this.state.receipts[operationId]:null;if(prior){if(prior.intentKey!==intentKey(proposal.intent))throw Error('Operation identity conflict');return clone(prior);}
   if(proposal.revision!==this.state.revision)throw Error('Preview is stale; review the updated route');
   const current=this.planner(freeze(this.snapshot()),proposal.intent);if(!current.valid)throw Error(current.error);if(JSON.stringify(current)!==JSON.stringify(proposal))throw Error('Preview changed; review again');if(this.state.funds<current.cost)throw Error('Insufficient mock funds');
   const next=clone(this.state),fail=phase=>{if(this.failAt===phase)throw Error('Injected failure '+phase);};
   next.funds-=current.cost;fail('after-debit');
   const cuts=new Map();for(const c of current.connections){if(!cuts.has(c.edgeId))cuts.set(c.edgeId,[]);cuts.get(c.edgeId).push(c.point);}
   const split=(a,b,points)=>{const sorted=[a,...points,b].sort((p,q)=>project(p,a,b).t-project(q,a,b).t);return sorted.filter((p,i)=>!i||!same(p,sorted[i-1]));};
   const old=[];for(const edge of next.edges){if(!cuts.has(edge.id)){old.push(edge);continue;}const ps=split(edge.a,edge.b,cuts.get(edge.id));for(let i=1;i<ps.length;i++)old.push({...edge,id:edge.id+':'+i,a:ps[i-1],b:ps[i]});}next.edges=old;
   for(let i=1;i<current.points.length;i++){const a=current.points[i-1],b=current.points[i],ps=split(a,b,current.connections.filter(c=>distance(project(c.point,a,b),c.point)<EPS).map(c=>c.point));for(let j=1;j<ps.length;j++)next.edges.push({id:'built-'+next.nextId++,kind:current.kind,a:ps[j-1],b:ps[j]});}
   fail('after-graph');next.revision++;const receipt={operationId,intentKey:current.intentKey,cost:current.cost,revision:next.revision};next.receipts[operationId]=receipt;fail('before-publish');this.state=next;
   // Notification failures cannot undo a successfully committed mock transaction.
   for(const fn of this.listeners)try{fn(this.snapshot());}catch(_){}return clone(receipt);
  }
 }
 class Controller{
  constructor(store){this.store=store;this.kind='road';this.phase='idle';this.start=null;this.end=null;this.waypoints=[];this.proposal=null;this.operationId=null;}
  cancel(){this.phase='idle';this.start=null;this.end=null;this.waypoints=[];this.proposal=null;this.operationId=null;}
  select(kind){if(!this.store.types[kind])throw Error('Unknown type');this.cancel();this.kind=kind;}
  begin(point){this.cancel();this.start=clone(point);this.phase='routing';}
  preview(point){if(!this.start||this.phase==='review')return this.proposal;this.proposal=this.store.propose({kind:this.kind,start:this.start,end:point,waypoints:this.waypoints});return this.proposal;}
  waypoint(point){if(!this.start)throw Error('Select a start first');this.waypoints.push(clone(point));this.phase='routing';this.proposal=null;}
  undoWaypoint(){if(!this.waypoints.length)return;const review=this.phase==='review';this.waypoints.pop();this.proposal=null;this.operationId=null;if(review)return this.refresh();this.phase=this.start?'routing':'idle';}
  finish(point){if(!this.start)throw Error('Select a start first');this.end=clone(point);this.phase='routing';this.preview(point);this.phase='review';this.operationId=this.store.allocateOperationId();return this.proposal;}
  adjust(){if(this.start){this.phase='routing';this.operationId=null;}}
  confirm(){if(this.phase!=='review'||!this.proposal)throw Error('Review a complete route before confirming');const receipt=this.store.commit(this.proposal,this.operationId);this.cancel();return receipt;}
  refresh(){if(!this.end)return;this.proposal=this.store.propose({kind:this.kind,start:this.start,end:this.end,waypoints:this.waypoints});this.operationId=this.store.allocateOperationId();return this.proposal;}
 }
 return {TYPES,clone,freeze,distance,intersection,clip,legalLine,snap,routeLeg,plan,fixture,MockStore,Controller,intentKey,createPlanner};
});
