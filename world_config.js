// ============================================================
// MAP GAME — world_config.js
// Alpha 0.2.2A1 — THE BIG WORLD UPDATE
// ============================================================
(() => {
  "use strict";
  const WORLD_COLS = 316;
  const WORLD_ROWS = 316;
  const TERRITORY_SIZE = 32768;
  const SECTOR_SIZE = 512;
  const BASIC_TERRAIN_SAMPLE_SIZE = 64;
  const BASIC_TERRAIN_GRID = TERRITORY_SIZE / BASIC_TERRAIN_SAMPLE_SIZE;

  // 0.3.2A strategic world-map streaming.
  // These regions are INTERNAL ONLY and are never drawn as territory chunks.
  const STRATEGIC_REGION_CELLS = 8;
  const STRATEGIC_REGION_COLS = Math.ceil(WORLD_COLS / STRATEGIC_REGION_CELLS);
  const STRATEGIC_REGION_ROWS = Math.ceil(WORLD_ROWS / STRATEGIC_REGION_CELLS);


  window.mapGameWorldConfig = Object.freeze({
    VERSION: "0.3.4B",
    WORLD_COLS,
    WORLD_ROWS,
    TERRITORY_SIZE,
    SECTOR_SIZE,
    BASIC_TERRAIN_SAMPLE_SIZE,
    BASIC_TERRAIN_GRID,
    STRATEGIC_REGION_CELLS,
    STRATEGIC_REGION_COLS,
    STRATEGIC_REGION_ROWS,
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
  console.log(
    `Map Game world config 0.3.2A ready — ${TERRITORY_SIZE}×${TERRITORY_SIZE} logical territory, ${SECTOR_SIZE}m streamed sectors.`
  );
})();