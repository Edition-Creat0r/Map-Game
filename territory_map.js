// ============================================================
// MAP GAME — territory_map.js
// Alpha 0.2.2A1 — active territory map
// ============================================================
(() => {
  "use strict";
  let runtime=null,overlay=null,canvas=null,ctx=null;
  const mapPoint=(x,z,size,w,h)=>({x:(x+size/2)/size*w,y:(z+size/2)/size*h});

  function ensure(){
    if(overlay)return;
    overlay=document.createElement("section");
    overlay.className="mg-territory-map-overlay";
    overlay.hidden=true;
    overlay.innerHTML=`
      <div class="mg-territory-map-shell">
        <header>
          <div><div class="mg-kicker">LOCAL TERRITORY</div><h2 id="mgLocalMapTitle">Territory Map</h2>
          <p>Click the map to move your camera across the full territory.</p></div>
          <div><button class="mg-btn mg-btn-secondary" id="mgLocalMapCenter">CENTER VIEW</button>
          <button class="mg-btn mg-btn-secondary" id="mgLocalMapClose">CLOSE</button></div>
        </header>
        <div class="mg-territory-map-stage"><canvas id="mgTerritoryMapCanvas"></canvas>
          <div class="mg-territory-map-legend"><span>● Capital</span><span>━ Roads</span><span>＋ Current view</span></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    canvas=overlay.querySelector("#mgTerritoryMapCanvas");ctx=canvas.getContext("2d");
    overlay.querySelector("#mgLocalMapClose").onclick=hide;
    overlay.querySelector("#mgLocalMapCenter").onclick=()=>{
      runtime.camera.target.set(0,12,0);runtime.camera.radius=700;hide();
    };
    canvas.addEventListener("pointerdown",e=>{
      const r=canvas.getBoundingClientRect(),size=runtime.mapSize||8192;
      runtime.camera.target.x=(e.clientX-r.left)/r.width*size-size/2;
      runtime.camera.target.z=(e.clientY-r.top)/r.height*size-size/2;
      hide();
    });
    window.addEventListener("resize",resize);
  }

  function resize(){
    if(!canvas||overlay.hidden)return;
    const r=canvas.parentElement.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));
    canvas.style.width=`${r.width}px`;canvas.style.height=`${r.height}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }

  function draw(){
    if(!runtime||!ctx)return;
    const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,size=runtime.mapSize||8192;
    const sector=window.mapGameWorldConfig?.SECTOR_SIZE||512;
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#102a31");g.addColorStop(1,"#07161d");
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(143,220,232,.09)";ctx.lineWidth=1;
    for(let m=sector;m<size;m+=sector){
      const x=m/size*w,y=m/size*h;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
    const tid=runtime.getActiveTerritory?.()?.id,rg=tid&&window.mapGameRoads?.graphFor?.(tid);
    if(rg){
      ctx.strokeStyle="#b9c5c8";ctx.lineWidth=2.2;
      for(const s of rg.segments.values()){
        const a=rg.nodes.get(s.a),b=rg.nodes.get(s.b);if(!a||!b)continue;
        const pa=mapPoint(a.x,a.z,size,w,h),pb=mapPoint(b.x,b.z,size,w,h);
        ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
      }
    }
    const cap=runtime.getActiveCapital?.();
    if(cap){
      const p=mapPoint(Number(cap.x||0),Number(cap.z||0),size,w,h);
      ctx.fillStyle="#6fe8ff";ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();
    }
    const p=mapPoint(runtime.camera.target.x,runtime.camera.target.z,size,w,h);
    ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x+8,p.y);
    ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x,p.y+8);ctx.stroke();
    ctx.strokeStyle="rgba(116,220,255,.65)";ctx.strokeRect(1,1,w-2,h-2);
  }
  function show(){
    ensure();const a=runtime?.getActiveTerritory?.();if(!a)return false;
    overlay.querySelector("#mgLocalMapTitle").textContent=`Territory ${a.x}-${a.y}`;
    overlay.hidden=false;requestAnimationFrame(resize);return true;
  }
  function hide(){if(overlay)overlay.hidden=true;}
  function install(rt){runtime=rt;ensure();}
  window.addEventListener("mapgame:runtime-ready",e=>install(e.detail));
  window.mapGameTerritoryMap={VERSION:"0.2.2A1",install,show,hide,draw};
})();