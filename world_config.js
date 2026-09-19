// ============================================================
// MAP GAME — world_config.js
// Alpha 0.2.2A1 — THE BIG WORLD UPDATE
// ============================================================
(() => {
  "use strict";
  const WORLD_COLS = 316;
  const WORLD_ROWS = 316;
  const TERRITORY_SIZE = 8192;
  const SECTOR_SIZE = 512;

  window.mapGameWorldConfig = Object.freeze({
    VERSION: "0.2.2A1.2",
    WORLD_COLS,
    WORLD_ROWS,
    TERRITORY_SIZE,
    SECTOR_SIZE,
    SECTORS_PER_SIDE: TERRITORY_SIZE / SECTOR_SIZE,
    TERRITORY_COUNT: WORLD_COLS * WORLD_ROWS,
    SINGLEPLAYER_OWNS_WORLD: true,
    roadClasses: Object.freeze({
      dirt: { id:"dirt", label:"Dirt Road", lanes:2, width:10, speed:35, costPer100m:80 },
      road2: { id:"road2", label:"2-Lane Road", lanes:2, width:14, speed:50, costPer100m:240 },
      avenue4: { id:"avenue4", label:"4-Lane Avenue", lanes:4, width:24, speed:60, costPer100m:520 },
      highway: { id:"highway", label:"Highway", lanes:4, width:28, speed:90, costPer100m:920, cityConnector:true },
      freeway: { id:"freeway", label:"Freeway", lanes:6, width:36, speed:110, costPer100m:1480, cityConnector:true }
    })
  });
  console.log("Map Game world config 0.2.2A1 ready.");
})();