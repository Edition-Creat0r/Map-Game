// ============================================================
// MAP GAME — navigation.js
// Alpha 0.2.2A1 — Central quick-travel panel
// ============================================================
(() => {
  "use strict";
  let runtime=null, card=null;
  function ensure(){
    if(card)return;
    card=document.createElement("aside");
    card.className="mg-quick-travel-card";
    card.innerHTML=`
      <div class="mg-kicker">CENTRAL WORLD</div>
      <strong id="mgTravelTitle">Your Territory</strong>
      <p id="mgTravelCopy">Return directly to your civilization.</p>
      <button class="mg-btn mg-btn-primary" id="mgTravelPrimary">GO TO MY TERRITORY</button>
      <button class="mg-btn mg-btn-secondary" id="mgTravelMap">WORLD MAP</button>`;
    document.body.appendChild(card);
    card.querySelector("#mgTravelMap").onclick=()=>runtime?.showWorldMap?.();
    card.querySelector("#mgTravelPrimary").onclick=()=>{
      const owned=runtime?.getMyStartingTerritory?.();
      if(!owned){runtime?.showWorldMap?.();return;}
      const parsed=runtime?.parseTerritoryId?.(owned.territory_id||owned.id);
      if(parsed)runtime.enterTerritory?.({...parsed,id:owned.territory_id||owned.id});
    };
  }
  function refresh(){
    if(!runtime)return;
    ensure();
    const single=runtime.worldType?.()==="singleplayer";
    const hub=runtime.getMode?.()==="HUB";
    card.hidden=single||!hub;
    if(card.hidden)return;
    const owned=runtime.getMyStartingTerritory?.();
    card.querySelector("#mgTravelTitle").textContent=owned?"Your Territory":"Choose Your Territory";
    card.querySelector("#mgTravelCopy").textContent=owned?
      "Leave the neutral hub and return directly to your civilization.":
      "Open the World Map and claim your first territory.";
    card.querySelector("#mgTravelPrimary").textContent=owned?"GO TO MY TERRITORY":"CHOOSE A TERRITORY";
  }
  function install(rt){runtime=rt;ensure();refresh();}
  window.addEventListener("mapgame:runtime-ready",e=>install(e.detail));
  window.addEventListener("mapgame:mode",refresh);
  window.addEventListener("mapgame:claims",refresh);
  window.mapGameNavigation={VERSION:"0.2.2A1",install,refresh};
})();