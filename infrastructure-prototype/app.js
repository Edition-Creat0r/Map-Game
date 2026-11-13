(()=>{
 'use strict';const C=InfrastructureCore,$=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d'),store=new C.MockStore(),controller=new C.Controller(store);
 let pointer=null,frame=0,message='No changes until you confirm.';
 const colors={valid:'#60e5a6',special:'#ffd176',blocked:'#ff7774',connected:'#69c7ff'},kindColors={road:'#56656a',rail:'#786184',power:'#9c8453'};
 const money=n=>'$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
 function notice(text){message=text;update();}
 function act(fn){try{fn();}catch(e){notice(e.message);}}
 for(const [id,type]of Object.entries(C.TYPES)){const b=document.createElement('button');b.type='button';b.dataset.kind=id;b.innerHTML=({road:'Road',rail:'Rail',power:'Power'})[id]+'<small>TEST CORRIDOR</small>';b.onclick=()=>{controller.select(id);pointer=null;notice(type.label+' selected. Choose a starting point.');};$('types').append(b);}
 function update(){const world=store.snapshot(),p=controller.proposal,review=controller.phase==='review',stale=p&&p.revision!==world.revision;
  document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===controller.kind)));
  $('phase').textContent=review?'REVIEW ROUTE':controller.start?'SELECT END':'SELECT START';
  $('instruction').textContent=review?'Review the complete route. Confirm to debit mock funds and build, or adjust the endpoint.':controller.start?'Move to preview. Click the endpoint, or add a waypoint to guide the route.':'Click the starting point. Compatible fixture networks snap automatically.';
  $('length').textContent=p&&!p.error?p.length.toFixed(1)+' m':'—';$('cost').textContent=p&&!p.error?money(p.cost):'—';$('surcharge').textContent=p&&!p.error?money(p.surcharge):'—';$('upkeep').textContent=p&&!p.error?'$'+p.upkeep.toFixed(2):'—';$('connections').textContent=p&&!p.error?p.connections.length+' / '+p.crossings.length:'—';$('route-state').textContent=stale?'STALE':p?p.state.toUpperCase():'NO ROUTE';
  $('balance').textContent=money(world.funds);$('revision').textContent='REV '+String(world.revision).padStart(2,'0');
  $('status').textContent=stale?'Fixture changed. Refresh and review the estimate again.':p?.error||((p&&p.cost>world.funds)?'Insufficient mock funds. Adjust the route or use test controls.':message);
  $('confirm').disabled=!review||!p?.valid||p.cost>world.funds||stale;$('cancel').disabled=!controller.start;$('adjust').disabled=!review;$('undo').disabled=!controller.waypoints.length;
  draw();
 }
 function line(points,color,width,dash=[]){if(points.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.z):ctx.moveTo(p.x,p.z));ctx.stroke();ctx.setLineDash([]);}
 function marker(p,color,label){ctx.fillStyle=color;ctx.strokeStyle='#233b36';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.z,7,0,Math.PI*2);ctx.fill();ctx.stroke();if(label){ctx.font='bold 11px Segoe UI';ctx.fillStyle='#17312a';ctx.fillText(label,p.x+12,p.z-11);}}
 function draw(){const world=store.snapshot(),rect=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1;canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);ctx.setTransform(canvas.width/1000,0,0,canvas.height/700,0,0);
  ctx.fillStyle='#adb7a6';ctx.fillRect(0,0,1000,700);ctx.strokeStyle='#9eab9b';ctx.lineWidth=.6;for(let x=0;x<=1000;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,700);ctx.stroke();}for(let z=0;z<=700;z+=20){ctx.beginPath();ctx.moveTo(0,z);ctx.lineTo(1000,z);ctx.stroke();}
  for(const area of world.special){ctx.fillStyle='#bca87577';ctx.fillRect(area.x,area.z,area.w,area.d);ctx.strokeStyle='#927c50';ctx.setLineDash([6,7]);ctx.strokeRect(area.x,area.z,area.w,area.d);ctx.setLineDash([]);}
  ctx.fillStyle='#60725f';ctx.font='10px Segoe UI';ctx.fillText('0',15,686);ctx.fillText('1000 m',940,686);ctx.fillText('N ↑',950,38);
  for(const e of world.edges){const width=C.TYPES[e.kind].width;line([e.a,e.b],'#46574f55',width+9);line([e.a,e.b],kindColors[e.kind],width);if(e.kind==='road')line([e.a,e.b],'#dbd5b5',1,[10,13]);if(e.kind==='rail'){line([e.a,e.b],'#c4c2ba',3,[2,9]);line([e.a,e.b],'#343e43',1);}if(e.kind==='power')line([e.a,e.b],'#efe1ac',1,[6,8]);marker(e.a,'#9bc6c2');marker(e.b,'#9bc6c2');}
  for(const o of world.obstacles){ctx.fillStyle='#33464035';ctx.fillRect(o.x+9,o.z+12,o.w,o.d);ctx.fillStyle='#596b68';ctx.fillRect(o.x,o.z+8,o.w,o.d);ctx.fillStyle='#c2c7ba';ctx.fillRect(o.x,o.z,o.w,o.d-9);ctx.strokeStyle='#839088';ctx.lineWidth=2;ctx.strokeRect(o.x+5,o.z+5,o.w-10,o.d-19);ctx.fillStyle='#445a51';ctx.font='11px Segoe UI';ctx.fillText(o.label,o.x+12,o.z+24);ctx.fillStyle='#84928a';for(let x=o.x+15;x<o.x+o.w-15;x+=26)ctx.fillRect(x,o.z+o.d-7,14,4);}
  const p=controller.proposal;if(p){const fallback=[controller.start,...controller.waypoints,p.intent.end],points=p.valid?p.points:fallback;line(points,'#203b3555',C.TYPES[p.kind].width+10);line(points,colors[p.state],C.TYPES[p.kind].width+2,p.valid?[]:[10,9]);if(p.valid)line(points,'#ecfff188',1,[8,10]);for(const c of p.connections)marker(c.point,colors.connected,'LINK');for(const c of p.crossings)marker(c.point,colors.special,'CROSSING');}
  if(controller.start)marker(p?.snaps.start.point||controller.start,'#f6f2d3','START');controller.waypoints.forEach((p,i)=>marker(p,'#e9e6c7','W'+(i+1)));if(controller.phase==='review'&&controller.end)marker(p?.snaps.end.point||controller.end,'#f6f2d3','END');else if(pointer&&controller.start)marker(p?.snaps.end.point||pointer,'#f6f2d3');
 }
 function usePoint(point,waypoint=false){act(()=>{if(!controller.start){controller.begin(point);notice('Start selected. Choose the endpoint.');}else if(waypoint){controller.waypoint(point);$('waypoint-mode').checked=false;notice('Waypoint added. Choose another point.');}else if(controller.phase!=='review'){controller.finish(point);notice('Route frozen for review. No construction or debit yet.');}else notice('Choose Adjust endpoint before changing the route.');});}
 const pointFrom=e=>{const r=canvas.getBoundingClientRect();return {x:Math.round((e.clientX-r.left)/r.width*1000),z:Math.round((e.clientY-r.top)/r.height*700)};};
 canvas.addEventListener('pointermove',e=>{pointer=pointFrom(e);if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(controller.phase==='routing')act(()=>{controller.preview(pointer);update();});});});
 canvas.addEventListener('click',e=>usePoint(pointFrom(e),e.shiftKey||$('waypoint-mode').checked));
 $('coordinate-form').onsubmit=e=>{e.preventDefault();usePoint({x:Number($('coord-x').value),z:Number($('coord-z').value)},$('waypoint-mode').checked);};
 $('confirm').onclick=()=>act(()=>{store.failAt=$('failure').value||null;try{const receipt=controller.confirm();notice('Committed '+money(receipt.cost)+' in mock funds. Choose a new start.');}finally{store.failAt=null;$('failure').value='';}});
 $('cancel').onclick=()=>{controller.cancel();notice('Cancelled. Mock balance and networks are unchanged.');};$('undo').onclick=()=>{controller.undoWaypoint();notice('Last waypoint removed. Choose the endpoint again.');};$('adjust').onclick=()=>{controller.adjust();notice('Adjust the endpoint. Click again to review.');};
 $('refresh').onclick=()=>act(()=>{controller.refresh();notice('Estimate refreshed. Review before confirming.');});
 $('set-funds').onclick=()=>act(()=>{const funds=Number($('funds').value);if(!Number.isFinite(funds)||funds<0||funds>1000000)throw Error('Use mock funds between 0 and 1,000,000');store.state.funds=funds;store.state.revision++;notice('Mock funds updated. Existing estimates require a fresh review.');});
 $('reset').onclick=()=>{store.state=C.fixture();controller.cancel();$('funds').value=15000;notice('Fixture reset. No saved state exists.');};
 window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){controller.cancel();notice('Cancelled. No world or balance changes.');}if(e.key==='Backspace'){e.preventDefault();controller.undoWaypoint();notice('Waypoint removed.');}});
 window.addEventListener('resize',draw);window.infrastructureLab={store,controller,update,usePoint};update();
})();
