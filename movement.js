// ============================================================
// MAP GAME — movement.js
// Alpha 0.2.2A1 — keyboard + touchscreen camera movement
// ============================================================
(() => {
  "use strict";
  let runtime=null, observer=null, pad=null;
  const held=new Set();
  const touch={x:0,z:0};

  function active(){
    const m=runtime?.getMode?.();
    return m==="TERRITORY"||m==="BUILDING_PLACEMENT"||m==="CAPITAL_PLACEMENT";
  }

  function makePad(){
    const capable=navigator.maxTouchPoints>0||window.matchMedia?.("(pointer: coarse)")?.matches;
    if(!capable||pad)return;
    pad=document.createElement("div");
    pad.className="mg-touch-move";
    pad.innerHTML=`
      <button data-dir="up">▲</button>
      <button data-dir="left">◀</button>
      <button data-dir="stop">●</button>
      <button data-dir="right">▶</button>
      <button data-dir="down">▼</button>`;
    document.body.appendChild(pad);
    const dirs={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0],stop:[0,0]};
    pad.querySelectorAll("[data-dir]").forEach(btn=>{
      btn.addEventListener("pointerdown",e=>{
        e.preventDefault(); btn.setPointerCapture?.(e.pointerId);
        [touch.x,touch.z]=dirs[btn.dataset.dir];
      });
      const stop=()=>{touch.x=0;touch.z=0;};
      btn.addEventListener("pointerup",stop);
      btn.addEventListener("pointercancel",stop);
      btn.addEventListener("pointerleave",stop);
    });
  }

  function update(){
    if(!runtime?.camera||!active())return;
    const cam=runtime.camera;
    const dt=Math.min(.05,runtime.scene.getEngine().getDeltaTime()/1000);
    let x=touch.x,z=touch.z;
    if(held.has("KeyW")||held.has("ArrowUp"))z++;
    if(held.has("KeyS")||held.has("ArrowDown"))z--;
    if(held.has("KeyA")||held.has("ArrowLeft"))x--;
    if(held.has("KeyD")||held.has("ArrowRight"))x++;
    const len=Math.hypot(x,z);
    if(len){
      x/=len;z/=len;
      const yaw=cam.alpha+Math.PI/2;
      const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
      const fast=held.has("ShiftLeft")||held.has("ShiftRight");
      const speed=Math.max(38,cam.radius*.24)*(fast?2.1:1);
      cam.target.x+=(fx*z+rx*x)*speed*dt;
      cam.target.z+=(fz*z+rz*x)*speed*dt;
      const half=(runtime.mapSize||8192)/2-30;
      cam.target.x=Math.max(-half,Math.min(half,cam.target.x));
      cam.target.z=Math.max(-half,Math.min(half,cam.target.z));
    }
    if(held.has("KeyQ"))cam.alpha-=1.15*dt;
    if(held.has("KeyE"))cam.alpha+=1.15*dt;
  }

  function install(rt){
    runtime=rt;
    makePad();
    if(observer)runtime.scene.onBeforeRenderObservable.remove(observer);
    observer=runtime.scene.onBeforeRenderObservable.add(update);
  }

  window.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
    held.add(e.code);
  });
  window.addEventListener("keyup",e=>held.delete(e.code));
  window.addEventListener("blur",()=>held.clear());
  window.addEventListener("mapgame:runtime-ready",e=>install(e.detail));

  window.mapGameMovement={VERSION:"0.2.2A1",install};
})();