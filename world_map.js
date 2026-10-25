// ============================================================
// MAP GAME — world_map.js
// Update 0.3.2A — NEW WORLD MAP ARCHITECTURE
//
// Fixed-scale, pan-only strategic map for all 99,856 territories.
// IMPORTANT:
// - The player never sees "loading chunks" as map tiles.
// - Internal 8x8 territory regions exist only for streaming/caching.
// - Terrain is continuous in global strategic coordinates.
// - Territory borders appear ONLY on hover/selection.
// - Singleplayer owns the entire world and starts here, not in a spawn.
// - Multiplayer also starts here.
// ============================================================

(() => {
  "use strict";

  const CFG = window.mapGameWorldConfig || {};
  const WORLD_COLS = Number(CFG.WORLD_COLS || 316);
  const WORLD_ROWS = Number(CFG.WORLD_ROWS || 316);
  const TERRITORY_COUNT = WORLD_COLS * WORLD_ROWS;

  // Fixed visual scale. No zoom controls by design.
  const CELL_PX = 26;

  // Invisible internal streaming region.
  const REGION_CELLS = Number(CFG.STRATEGIC_REGION_CELLS || 8);
  const REGION_PX = CELL_PX * REGION_CELLS;

  // Each cached region gets a little overdraw so seams never expose.
  const REGION_OVERDRAW = 2;
  const REGION_RASTER_SCALE = 0.5;

  // Progressive streamer intentionally performs only a small amount of work
  // per step. This avoids long main-thread stalls on Chromebooks.
  const STREAM_DELAY_MS = 34;
  const MAX_REGION_CACHE = 120;

  const state = {
    open: false,
    worldType: "singleplayer",
    root: null,
    canvas: null,
    ctx: null,
    inspector: null,
    status: null,
    callbacks: {},
    dpr: 1,

    cameraX: WORLD_COLS * 0.5,
    cameraY: WORLD_ROWS * 0.5,

    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    cameraStartX: 0,
    cameraStartY: 0,

    hover: null,
    selected: null,

    // Region cache is internal only. It must never define the visual shape
    // of the world.
    regionCache: new Map(),
    regionQueue: [],
    queuedKeys: new Set(),
    streamTimer: 0,
    useCounter: 0,

    civilization: new Map(),

    raf: 0,
    needsDraw: true
  };

  // ----------------------------------------------------------
  // Utility / deterministic world fields
  // ----------------------------------------------------------

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hash32(x, y, seed = 0) {
    let h = Math.imul((x | 0) ^ seed ^ 0x9e3779b9, 0x85ebca6b);
    h ^= Math.imul((y | 0) ^ 0xc2b2ae35, 0x27d4eb2f);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967295;
  }

  function valueNoise(x, y, scale, seed) {
    const fx = x / scale;
    const fy = y / scale;

    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);

    const a = hash32(x0, y0, seed);
    const b = hash32(x1, y0, seed);
    const c = hash32(x0, y1, seed);
    const d = hash32(x1, y1, seed);

    return lerp(
      lerp(a, b, tx),
      lerp(c, d, tx),
      ty
    );
  }

  function fbm(x, y, baseScale, octaves, seed) {
    let total = 0;
    let amp = 1;
    let norm = 0;
    let scale = baseScale;

    for (let i = 0; i < octaves; i++) {
      total += valueNoise(
        x,
        y,
        scale,
        seed + i * 173
      ) * amp;

      norm += amp;
      amp *= 0.52;
      scale *= 0.52;
    }

    return total / Math.max(0.00001, norm);
  }

  function ridged(x, y, scale, seed) {
    const n = fbm(x, y, scale, 4, seed);
    const r = 1 - Math.abs(n * 2 - 1);
    return r * r;
  }

  function terrainAt(gx,gy){
    return window.mapGameSharedTerrain.strategic(gx,gy);
  }

  const terrainPalette = {grass:[106,145,79],rockyGrass:[111,124,85],rock:[100,101,92],
    snow:[208,215,207],dry:[157,146,93],wet:[62,115,83],soil:[125,105,77]};

  function colorForTerrain(t) {
    if(!t.water && t.weights){
      let r=0,g=0,b=0,total=0;
      for(const key in t.weights){
        const value=t.weights[key], c=terrainPalette[key];if(!c)continue;
        total+=value;r+=c[0]*value;g+=c[1]*value;b+=c[2]*value;
      }
      if(total>.01)return [Math.round(r/total),Math.round(g/total),Math.round(b/total)];
    }
    switch (t.kind) {
      case "water":
        return [36, 96, 126];

      case "snow":
        return [204, 210, 204];

      case "mountain":
        return [101, 101, 88];

      case "hills":
        return [105, 124, 75];

      case "wetland":
        return [61, 111, 76];

      case "dry":
        return [151, 143, 82];

      case "forest":
        return [57, 108, 59];

      default:
        return [105, 143, 78];
    }
  }

  function mixRgb(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }

  function terrainColorAt(gx, gy) {
    const t = terrainAt(gx, gy);
    let base = colorForTerrain(t);

    // Blend with nearby samples. This deliberately softens territory-scale
    // transitions so geography reads as one map rather than colored tiles.
    const neighbor =
      colorForTerrain(
        terrainAt(gx + 0.45, gy + 0.30)
      );

    base = mixRgb(base, neighbor, 0.22);

    // Strategic hillshade from global elevation.
    if (!t.water) {
      const west = terrainAt(gx - 0.35, gy).elevation;
      const east = terrainAt(gx + 0.35, gy).elevation;
      const north = terrainAt(gx, gy - 0.35).elevation;
      const south = terrainAt(gx, gy + 0.35).elevation;

      const shade = clamp(
        (west - east) * 0.48 +
        (north - south) * 0.36,
        -0.12,
        0.12
      );

      base = [
        clamp(Math.round(base[0] + shade * 255), 0, 255),
        clamp(Math.round(base[1] + shade * 255), 0, 255),
        clamp(Math.round(base[2] + shade * 255), 0, 255)
      ];
    }

    return `rgb(${base[0]},${base[1]},${base[2]})`;
  }

  // ----------------------------------------------------------
  // Livability
  // ----------------------------------------------------------

  function territoryMetrics(x, y) {
    const center = terrainAt(x + 0.5, y + 0.5);

    let water = 0;
    let flat = 0;
    let forest = 0;
    let mountain = 0;

    const samples = [
      [0.2,0.2], [0.5,0.2], [0.8,0.2],
      [0.2,0.5], [0.5,0.5], [0.8,0.5],
      [0.2,0.8], [0.5,0.8], [0.8,0.8]
    ];

    for (const [ox, oy] of samples) {
      const t = terrainAt(x + ox, y + oy);

      if (t.water) water++;
      if (!t.water && !t.mountain && t.ridge < 0.38) flat++;
      if (t.forest) forest++;
      if (t.mountain) mountain++;
    }

    const flatPct = Math.round(flat / samples.length * 100);
    const waterPct = Math.round(water / samples.length * 100);
    const forestPct = Math.round(forest / samples.length * 100);
    const mountainPct = Math.round(mountain / samples.length * 100);

    const freshwater =
      clamp(
        waterPct * 1.4 +
        center.moisture * 46,
        0,
        100
      );

    const climate =
      clamp(
        100 -
        Math.abs(center.temperature - 0.56) * 105,
        0,
        100
      );

    // Livability is useful, but mountains/forests are not simply "bad".
    // They reduce easy urban development while preserving strategic value.
    const score = Math.round(
      clamp(
        flatPct * 0.34 +
        freshwater * 0.25 +
        climate * 0.22 +
        (100 - mountainPct) * 0.10 +
        Math.min(100, forestPct * 1.35) * 0.09,
        0,
        100
      )
    );

    let rating = "Harsh";

    if (score >= 90) rating = "Exceptional";
    else if (score >= 75) rating = "Excellent";
    else if (score >= 60) rating = "Good";
    else if (score >= 45) rating = "Moderate";
    else if (score >= 30) rating = "Difficult";

    return {
      score,
      rating,
      flatPct,
      waterPct,
      forestPct,
      mountainPct,
      center
    };
  }

  // ----------------------------------------------------------
  // DOM
  // ----------------------------------------------------------

  function ensureDom() {
    if (state.root) return;

    const root = document.createElement("section");
    root.id = "mgStrategicWorld";
    root.hidden = true;

    root.innerHTML = `
      <div class="mg-sw-shell">
        <header class="mg-sw-header">
          <div class="mg-sw-heading">
            <div class="mg-kicker">WORLD MAP • 0.3.2A</div>
            <h2>World Atlas</h2>
            <p>${TERRITORY_COUNT.toLocaleString()} territories • seamless geography • fixed scale</p>
          </div>

          <div class="mg-sw-actions">
            <span class="mg-sw-stream-status" id="mgSwStreamStatus">WORLD READY</span>
            <button class="mg-btn mg-btn-secondary" id="mgSwRecenter" type="button">RECENTER</button>
            <button class="mg-btn mg-btn-secondary" id="mgSwReturn" type="button">RETURN</button>
          </div>
        </header>

        <div class="mg-sw-body">
          <div class="mg-sw-stage">
            <canvas id="mgStrategicCanvas" aria-label="Strategic world map"></canvas>
            <div class="mg-sw-help">
              DRAG • SCROLL TO PAN • HOVER FOR TERRITORY
            </div>
          </div>

          <aside class="mg-sw-inspector" id="mgSwInspector">
            <div class="mg-kicker">TERRITORY</div>
            <h3 id="mgSwTitle">Move over the world</h3>
            <p id="mgSwSub">Terrain and livability will appear here.</p>

            <div class="mg-sw-livability">
              <span>LIVABILITY</span>
              <strong id="mgSwLivability">—</strong>
            </div>

            <div class="mg-sw-stats" id="mgSwStats"></div>

            <div class="mg-sw-progress" id="mgSwProgress"></div>

            <button class="mg-btn mg-btn-primary" id="mgSwPrimary" type="button" disabled>
              SELECT A TERRITORY
            </button>

            <button class="mg-btn mg-btn-secondary" id="mgSwEnter" type="button" hidden>
              ENTER TERRITORY
            </button>

            <div class="mg-panel-note">
              Internal streaming regions are invisible. Territory borders appear only while inspecting land.
            </div>
          </aside>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    state.root = root;
    state.canvas = root.querySelector("#mgStrategicCanvas");
    state.ctx = state.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true
    });
    state.inspector = root.querySelector("#mgSwInspector");
    state.status = root.querySelector("#mgSwStreamStatus");

    root.querySelector("#mgSwRecenter")
      .addEventListener("click", () => {
        centerOnPreferredTerritory();
      });

    root.querySelector("#mgSwReturn")
      .addEventListener("click", () => {
        if (state.callbacks.canReturn?.()) {
          close();
          state.callbacks.onReturn?.();
        }
      });

    root.querySelector("#mgSwPrimary")
      .addEventListener("click", () => {
        if (!state.selected) return;

        state.callbacks.onPrimary?.({
          ...state.selected
        });
      });

    root.querySelector("#mgSwEnter")
      .addEventListener("click", () => {
        if (!state.selected) return;

        state.callbacks.onEnter?.({
          ...state.selected
        });
      });

    installCanvasInput();
    window.addEventListener("resize", resize);

    requestAnimationFrame(loop);
  }

  // ----------------------------------------------------------
  // Camera / input
  // ----------------------------------------------------------

  function resize() {
    if (!state.open || !state.canvas) return;

    const rect =
      state.canvas.parentElement.getBoundingClientRect();

    state.dpr =
      Math.min(
        window.devicePixelRatio || 1,
        1.5
      );

    const width =
      Math.max(
        1,
        Math.floor(rect.width * state.dpr)
      );

    const height =
      Math.max(
        1,
        Math.floor(rect.height * state.dpr)
      );

    if (
      state.canvas.width !== width ||
      state.canvas.height !== height
    ) {
      state.canvas.width = width;
      state.canvas.height = height;
      state.canvas.style.width = `${rect.width}px`;
      state.canvas.style.height = `${rect.height}px`;
    }

    state.ctx.setTransform(
      state.dpr,
      0,
      0,
      state.dpr,
      0,
      0
    );

    clampCamera();
    state.needsDraw = true;
  }

  function cssSize() {
    const rect =
      state.canvas.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height
    };
  }

  function clampCamera() {
    if (!state.canvas) return;

    const { width, height } = cssSize();

    const halfX =
      width / CELL_PX / 2;

    const halfY =
      height / CELL_PX / 2;

    state.cameraX =
      clamp(
        state.cameraX,
        Math.min(WORLD_COLS / 2, halfX),
        Math.max(WORLD_COLS / 2, WORLD_COLS - halfX)
      );

    state.cameraY =
      clamp(
        state.cameraY,
        Math.min(WORLD_ROWS / 2, halfY),
        Math.max(WORLD_ROWS / 2, WORLD_ROWS - halfY)
      );
  }

  function screenToWorld(clientX, clientY) {
    const rect =
      state.canvas.getBoundingClientRect();

    return {
      x:
        state.cameraX +
        (clientX - rect.left - rect.width / 2) / CELL_PX,

      y:
        state.cameraY +
        (clientY - rect.top - rect.height / 2) / CELL_PX
    };
  }

  function territoryFromPointer(event) {
    const p =
      screenToWorld(
        event.clientX,
        event.clientY
      );

    const x =
      Math.floor(p.x);

    const y =
      Math.floor(p.y);

    if (
      x < 0 ||
      y < 0 ||
      x >= WORLD_COLS ||
      y >= WORLD_ROWS
    ) {
      return null;
    }

    return {
      x,
      y,
      id: `T_${x}_${y}`
    };
  }

  function installCanvasInput() {
    const canvas = state.canvas;

    canvas.addEventListener(
      "pointerdown",
      event => {
        if (!state.open) return;

        state.dragging = true;
        state.dragStartX = event.clientX;
        state.dragStartY = event.clientY;
        state.cameraStartX = state.cameraX;
        state.cameraStartY = state.cameraY;

        canvas.setPointerCapture?.(
          event.pointerId
        );
      }
    );

    canvas.addEventListener(
      "pointermove",
      event => {
        if (!state.open) return;

        if (state.dragging) {
          const dx =
            event.clientX -
            state.dragStartX;

          const dy =
            event.clientY -
            state.dragStartY;

          state.cameraX =
            state.cameraStartX -
            dx / CELL_PX;

          state.cameraY =
            state.cameraStartY -
            dy / CELL_PX;

          clampCamera();
          queueVisibleRegions();
          state.needsDraw = true;
          return;
        }

        const hover =
          territoryFromPointer(event);

        const changed =
          !sameCell(
            hover,
            state.hover
          );

        state.hover = hover;

        if (changed) {
          updateInspector(
            hover ||
            state.selected
          );
          state.needsDraw = true;
        }
      }
    );

    canvas.addEventListener(
      "pointerup",
      event => {
        if (!state.open) return;

        const moved =
          Math.hypot(
            event.clientX -
            state.dragStartX,
            event.clientY -
            state.dragStartY
          );

        state.dragging = false;

        try {
          canvas.releasePointerCapture?.(
            event.pointerId
          );
        } catch (_) {}

        if (moved <= 6) {
          const cell =
            territoryFromPointer(event);

          if (cell) {
            state.selected = cell;
            state.hover = cell;

            state.callbacks.onSelection?.(
              { ...cell }
            );

            updateInspector(cell);
            state.needsDraw = true;
          }
        }
      }
    );

    canvas.addEventListener(
      "pointercancel",
      () => {
        state.dragging = false;
      }
    );

    canvas.addEventListener(
      "pointerleave",
      () => {
        if (!state.dragging) {
          state.hover = null;
          updateInspector(
            state.selected
          );
          state.needsDraw = true;
        }
      }
    );

    // Wheel pans the world. It NEVER zooms.
    canvas.addEventListener(
      "wheel",
      event => {
        if (!state.open) return;

        event.preventDefault();

        const horizontal =
          event.shiftKey
            ? event.deltaY
            : event.deltaX;

        const vertical =
          event.shiftKey
            ? 0
            : event.deltaY;

        state.cameraX +=
          horizontal / CELL_PX * 0.62;

        state.cameraY +=
          vertical / CELL_PX * 0.62;

        clampCamera();
        queueVisibleRegions();
        state.needsDraw = true;
      },
      { passive: false }
    );
  }

  function sameCell(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return (
      a.x === b.x &&
      a.y === b.y
    );
  }

  // ----------------------------------------------------------
  // Internal strategic-region streaming
  // ----------------------------------------------------------

  function regionKey(rx, ry) {
    return `${rx},${ry}`;
  }

  function visibleRegionBounds() {
    const { width, height } =
      cssSize();

    const halfX =
      width / CELL_PX / 2;

    const halfY =
      height / CELL_PX / 2;

    const left =
      clamp(
        state.cameraX - halfX,
        0,
        WORLD_COLS
      );

    const right =
      clamp(
        state.cameraX + halfX,
        0,
        WORLD_COLS
      );

    const top =
      clamp(
        state.cameraY - halfY,
        0,
        WORLD_ROWS
      );

    const bottom =
      clamp(
        state.cameraY + halfY,
        0,
        WORLD_ROWS
      );

    return {
      minRX:
        Math.max(
          0,
          Math.floor(left / REGION_CELLS) - 1
        ),

      maxRX:
        Math.min(
          Math.ceil(WORLD_COLS / REGION_CELLS) - 1,
          Math.floor(right / REGION_CELLS) + 1
        ),

      minRY:
        Math.max(
          0,
          Math.floor(top / REGION_CELLS) - 1
        ),

      maxRY:
        Math.min(
          Math.ceil(WORLD_ROWS / REGION_CELLS) - 1,
          Math.floor(bottom / REGION_CELLS) + 1
        )
    };
  }

  function queueVisibleRegions() {
    if (!state.open) return;

    const b =
      visibleRegionBounds();

    const centerRX =
      Math.floor(
        state.cameraX /
        REGION_CELLS
      );

    const centerRY =
      Math.floor(
        state.cameraY /
        REGION_CELLS
      );

    const wanted = [];

    for (
      let ry = b.minRY;
      ry <= b.maxRY;
      ry++
    ) {
      for (
        let rx = b.minRX;
        rx <= b.maxRX;
        rx++
      ) {
        const key =
          regionKey(rx, ry);

        if (
          state.regionCache.has(key) ||
          state.queuedKeys.has(key)
        ) {
          continue;
        }

        wanted.push({
          rx,
          ry,
          distance:
            Math.abs(rx - centerRX) +
            Math.abs(ry - centerRY)
        });
      }
    }

    wanted.sort(
      (a, b2) =>
        a.distance -
        b2.distance
    );

    for (const item of wanted) {
      const key =
        regionKey(
          item.rx,
          item.ry
        );

      state.regionQueue.push(item);
      state.queuedKeys.add(key);
    }

    updateStreamStatus();
    startStreamer();
  }

  function startStreamer() {
    if (
      state.streamTimer ||
      !state.open
    ) {
      return;
    }

    const step = () => {
      state.streamTimer = 0;

      if (!state.open) return;

      const next =
        state.regionQueue.shift();

      if (!next) {
        updateStreamStatus();
        return;
      }

      const key =
        regionKey(
          next.rx,
          next.ry
        );

      state.queuedKeys.delete(key);

      const rendered =
        renderRegion(
          next.rx,
          next.ry
        );

      state.regionCache.set(
        key,
        {
          canvas: rendered,
          used: ++state.useCounter
        }
      );

      pruneRegionCache();

      state.needsDraw = true;
      updateStreamStatus();

      state.streamTimer =
        window.setTimeout(
          step,
          STREAM_DELAY_MS
        );
    };

    state.streamTimer =
      window.setTimeout(
        step,
        10
      );
  }

  function updateStreamStatus() {
    if (!state.status) return;

    if (state.regionQueue.length) {
      state.status.textContent =
        `LOADING REGION DETAIL • ${state.regionQueue.length}`;
    } else {
      state.status.textContent =
        "WORLD READY";
    }
  }

  function pruneRegionCache() {
    if (
      state.regionCache.size <=
      MAX_REGION_CACHE
    ) {
      return;
    }

    const entries =
      [...state.regionCache.entries()]
        .sort(
          (a, b) =>
            a[1].used -
            b[1].used
        );

    while (
      entries.length &&
      state.regionCache.size >
      MAX_REGION_CACHE
    ) {
      const [key] =
        entries.shift();

      state.regionCache.delete(key);
    }
  }

  // ----------------------------------------------------------
  // Seamless region art
  // ----------------------------------------------------------

  function renderRegion(rx, ry) {
    const canvas =
      document.createElement("canvas");

    const size = Math.ceil((REGION_PX + REGION_OVERDRAW * 2) / 2);

    canvas.width = size;
    canvas.height = size;

    const ctx =
      canvas.getContext(
        "2d",
        { alpha: false }
      );

    const worldX0 =
      rx * REGION_CELLS;

    const worldY0 =
      ry * REGION_CELLS;

    // Render at pixel resolution using global terrain coordinates.
    // Because adjacent regions evaluate the same field, edges match.
    const image =
      ctx.createImageData(
        size,
        size
      );

    const data =
      image.data;

    for (
      let py = 0;
      py < size;
      py++
    ) {
      const gy =
        worldY0 +
        (py * 2 - REGION_OVERDRAW) /
        CELL_PX;

      for (
        let px = 0;
        px < size;
        px++
      ) {
        const gx =
          worldX0 +
          (px * 2 - REGION_OVERDRAW) /
          CELL_PX;

        const t =
          terrainAt(gx, gy);

        let rgb =
          colorForTerrain(t);

        const i =
          (py * size + px) * 4;

        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(
      image,
      0,
      0
    );

    // Decorative terrain features are drawn globally in the main view;
    // keeping region images free of clipped objects removes edge seams.

    return canvas;
  }

  function drawRegionDetail(
    ctx,
    rx,
    ry,
    worldX0,
    worldY0
  ) {
    // Detail is deliberately subtle and does not stop at territory borders.
    // This gives loaded regions more information without revealing the
    // streaming grid.
    ctx.save();

    for (
      let ty = 0;
      ty < REGION_CELLS;
      ty++
    ) {
      for (
        let tx = 0;
        tx < REGION_CELLS;
        tx++
      ) {
        const gx =
          worldX0 + tx + 0.5;

        const gy =
          worldY0 + ty + 0.5;

        const t =
          terrainAt(gx, gy);

        const cx =
          REGION_OVERDRAW +
          (tx + 0.5) * CELL_PX;

        const cy =
          REGION_OVERDRAW +
          (ty + 0.5) * CELL_PX;

        if (false && t.mountain) {
          const size =
            4 +
            t.ridge * 5;

          ctx.strokeStyle =
            t.snow
              ? "rgba(242,246,241,.58)"
              : "rgba(55,58,54,.38)";

          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.moveTo(
            cx - size,
            cy + size * 0.48
          );
          ctx.lineTo(
            cx,
            cy - size
          );
          ctx.lineTo(
            cx + size,
            cy + size * 0.48
          );
          ctx.stroke();
        }

        if (
          t.forest &&
          hash32(
            Math.floor(gx * 7),
            Math.floor(gy * 7),
            9101
          ) > 0.54
        ) {
          ctx.fillStyle =
            "rgba(28,74,38,.26)";

          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            3.1,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // ----------------------------------------------------------
  // Drawing
  // ----------------------------------------------------------

  function loop() {
    if (
      state.open &&
      state.needsDraw
    ) {
      draw();
      state.needsDraw = false;
    }

    state.raf =
      requestAnimationFrame(loop);
  }

  function draw() {
    if (
      !state.open ||
      !state.ctx ||
      !state.canvas
    ) {
      return;
    }

    const ctx = state.ctx;
    const { width, height } =
      cssSize();

    ctx.fillStyle =
      "#091521";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    const b =
      visibleRegionBounds();

    // First paint a cheap continuous fallback for every visible region.
    // Therefore an unloaded region is never a blank square.
    for (
      let ry = b.minRY;
      ry <= b.maxRY;
      ry++
    ) {
      for (
        let rx = b.minRX;
        rx <= b.maxRX;
        rx++
      ) {
        drawFallbackRegion(
          ctx,
          rx,
          ry,
          width,
          height
        );
      }
    }

    // Loaded detail is painted above the fallback with overdraw.
    for (
      let ry = b.minRY;
      ry <= b.maxRY;
      ry++
    ) {
      for (
        let rx = b.minRX;
        rx <= b.maxRX;
        rx++
      ) {
        const key =
          regionKey(rx, ry);

        const entry =
          state.regionCache.get(key);

        if (!entry) continue;

        entry.used =
          ++state.useCounter;

        drawCachedRegion(
          ctx,
          entry.canvas,
          rx,
          ry,
          width,
          height
        );
      }
    }

    drawStrategicRivers(ctx, width, height);
    drawCivilization(
      ctx,
      width,
      height
    );

    drawHoverAndSelection(
      ctx,
      width,
      height
    );
  }

  function worldToScreen(
    gx,
    gy,
    width,
    height
  ) {
    return {
      x:
        width / 2 +
        (gx - state.cameraX) *
        CELL_PX,

      y:
        height / 2 +
        (gy - state.cameraY) *
        CELL_PX
    };
  }

  function drawFallbackRegion(
    ctx,
    rx,
    ry,
    width,
    height
  ) {
    const startX =
      rx * REGION_CELLS;

    const startY =
      ry * REGION_CELLS;

    // Four large fills per region. They come from the same global field and
    // are deliberately blurred/overlapped so streaming regions don't read
    // as tiles while higher detail is still loading.
    const half =
      REGION_CELLS / 2;

    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const gx =
          startX +
          (sx + 0.5) * half;

        const gy =
          startY +
          (sy + 0.5) * half;

        const p =
          worldToScreen(
            startX + sx * half,
            startY + sy * half,
            width,
            height
          );

        ctx.fillStyle =
          terrainColorAt(gx, gy);

        ctx.fillRect(
          p.x - 1,
          p.y - 1,
          half * CELL_PX + 2,
          half * CELL_PX + 2
        );
      }
    }
  }

  function drawCachedRegion(
    ctx,
    canvas,
    rx,
    ry,
    width,
    height
  ) {
    const p =
      worldToScreen(
        rx * REGION_CELLS,
        ry * REGION_CELLS,
        width,
        height
      );

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      canvas,
      p.x - REGION_OVERDRAW,
      p.y - REGION_OVERDRAW,
      canvas.width * 2,
      canvas.height * 2
    );
  }


  function drawStrategicRivers(ctx, width, height) {
    // This provisional hydrology art is global and never stops at region edges.
    const halfX = width / CELL_PX / 2;
    const halfY = height / CELL_PX / 2;
    const first = Math.floor((state.cameraX - halfX - 6) / 31);
    const last = Math.ceil((state.cameraX + halfX + 6) / 31);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let j = first; j <= last; j++) {
      const center = j * 31 + 12;
      ctx.beginPath();
      let started = false;
      for (let gy = state.cameraY - halfY - 2; gy <= state.cameraY + halfY + 3; gy += .35) {
        const gx = center + Math.sin(gy / 5.8 + j * 2.1) * 3.0 + Math.sin(gy / 2.2 + j) * .5;
        const p = worldToScreen(gx,gy,width,height);
        if (!started) {ctx.moveTo(p.x,p.y);started=true;}
        else ctx.lineTo(p.x,p.y);
      }
      if (!started) continue;
      ctx.strokeStyle = 'rgba(16,48,59,.45)';ctx.lineWidth=5;ctx.stroke();
      ctx.strokeStyle = '#3b9bb9';ctx.lineWidth=2.7;ctx.stroke();
    }
    ctx.restore();
  }

  function drawCivilization(
    ctx,
    width,
    height
  ) {
    const bounds =
      visibleTerritoryBounds(
        width,
        height
      );

    for (
      let y = bounds.minY;
      y <= bounds.maxY;
      y++
    ) {
      for (
        let x = bounds.minX;
        x <= bounds.maxX;
        x++
      ) {
        const id =
          `T_${x}_${y}`;

        const owner =
          state.callbacks.getOwner?.(
            id
          );

        const summary =
          state.civilization.get(id) ||
          state.callbacks.getSummary?.(
            id
          );

        if (
          !owner &&
          !summary
        ) {
          continue;
        }

        const p =
          worldToScreen(
            x,
            y,
            width,
            height
          );

        if (
          owner &&
          state.worldType !==
          "singleplayer"
        ) {
          ctx.fillStyle =
            owner.owner_id ===
            state.callbacks.getCurrentUserId?.()
              ? "rgba(68,196,149,.12)"
              : "rgba(79,137,191,.10)";

          ctx.fillRect(
            p.x,
            p.y,
            CELL_PX,
            CELL_PX
          );
        }

        if (!summary) continue;

        const development =
          clamp(
            Number(
              summary.development || 0
            ),
            0,
            1
          );

        const population =
          Math.max(
            0,
            Number(
              summary.population || 0
            )
          );

        // City progress appears as an urban mass, not individual buildings.
        if (
          development > 0 ||
          population > 0
        ) {
          const radius =
            clamp(
              2.4 +
              Math.sqrt(population) *
              0.014 +
              development * 5,
              2.5,
              9
            );

          ctx.fillStyle =
            "rgba(166,175,168,.62)";

          ctx.beginPath();
          ctx.arc(
            p.x + CELL_PX * 0.5,
            p.y + CELL_PX * 0.5,
            radius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // Major road/highway summary.
        if (
          Number(summary.majorRoads || 0) > 0
        ) {
          ctx.strokeStyle =
            "rgba(222,213,183,.62)";

          ctx.lineWidth = 1.2;

          ctx.beginPath();
          ctx.moveTo(
            p.x + CELL_PX * 0.12,
            p.y + CELL_PX * 0.68
          );
          ctx.lineTo(
            p.x + CELL_PX * 0.88,
            p.y + CELL_PX * 0.42
          );
          ctx.stroke();
        }

        // Large shields remain visible strategically.
        if (
          Number(summary.shields || 0) > 0
        ) {
          ctx.strokeStyle =
            "rgba(88,213,242,.62)";

          ctx.lineWidth = 1.4;

          ctx.beginPath();
          ctx.arc(
            p.x + CELL_PX * 0.5,
            p.y + CELL_PX * 0.5,
            CELL_PX * 0.36,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }

        if (
          Number(summary.airports || 0) > 0
        ) {
          ctx.fillStyle =
            "rgba(231,239,241,.78)";

          ctx.fillRect(
            p.x + CELL_PX * 0.63,
            p.y + CELL_PX * 0.24,
            5,
            1.5
          );
        }

        if (
          Number(summary.ports || 0) > 0
        ) {
          ctx.fillStyle =
            "rgba(216,235,241,.76)";

          ctx.fillRect(
            p.x + CELL_PX * 0.16,
            p.y + CELL_PX * 0.70,
            4,
            3
          );
        }
      }
    }
  }

  function visibleTerritoryBounds(
    width,
    height
  ) {
    const halfX =
      width / CELL_PX / 2;

    const halfY =
      height / CELL_PX / 2;

    return {
      minX:
        Math.max(
          0,
          Math.floor(
            state.cameraX -
            halfX
          ) - 1
        ),

      maxX:
        Math.min(
          WORLD_COLS - 1,
          Math.ceil(
            state.cameraX +
            halfX
          ) + 1
        ),

      minY:
        Math.max(
          0,
          Math.floor(
            state.cameraY -
            halfY
          ) - 1
        ),

      maxY:
        Math.min(
          WORLD_ROWS - 1,
          Math.ceil(
            state.cameraY +
            halfY
          ) + 1
        )
    };
  }

  function drawHoverAndSelection(
    ctx,
    width,
    height
  ) {
    if (state.selected) {
      drawTerritoryOutline(
        ctx,
        state.selected,
        width,
        height,
        "rgba(255,255,255,.90)",
        2
      );
    }

    if (
      state.hover &&
      !sameCell(
        state.hover,
        state.selected
      )
    ) {
      drawTerritoryOutline(
        ctx,
        state.hover,
        width,
        height,
        "rgba(255,255,255,.72)",
        1.5
      );
    }
  }

  function drawTerritoryOutline(
    ctx,
    cell,
    width,
    height,
    color,
    lineWidth
  ) {
    const p =
      worldToScreen(
        cell.x,
        cell.y,
        width,
        height
      );

    ctx.save();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.strokeRect(
      Math.round(p.x) + 0.5,
      Math.round(p.y) + 0.5,
      CELL_PX,
      CELL_PX
    );

    ctx.restore();
  }

  // ----------------------------------------------------------
  // Inspector / selection
  // ----------------------------------------------------------

  function updateInspector(cell) {
    if (!state.root) return;

    const title =
      state.root.querySelector(
        "#mgSwTitle"
      );

    const sub =
      state.root.querySelector(
        "#mgSwSub"
      );

    const live =
      state.root.querySelector(
        "#mgSwLivability"
      );

    const stats =
      state.root.querySelector(
        "#mgSwStats"
      );

    const progress =
      state.root.querySelector(
        "#mgSwProgress"
      );

    const primary =
      state.root.querySelector(
        "#mgSwPrimary"
      );

    const enter =
      state.root.querySelector(
        "#mgSwEnter"
      );

    if (!cell) {
      title.textContent =
        "Move over the world";

      sub.textContent =
        "Terrain and livability will appear here.";

      live.textContent = "—";
      stats.innerHTML = "";
      progress.innerHTML = "";

      primary.disabled = true;
      primary.textContent =
        "SELECT A TERRITORY";

      enter.hidden = true;
      return;
    }

    const id =
      cell.id ||
      `T_${cell.x}_${cell.y}`;

    const metrics =
      territoryMetrics(
        cell.x,
        cell.y
      );

    const owner =
      state.callbacks.getOwner?.(
        id
      );

    const reserved =
      state.callbacks.isReserved?.(
        cell.x,
        cell.y
      ) || false;

    const summary =
      state.civilization.get(id) ||
      state.callbacks.getSummary?.(
        id
      ) ||
      null;

    title.textContent =
      `Territory ${cell.x}-${cell.y}`;

    sub.textContent =
      `${terrainLabel(metrics.center.kind)} • ${metrics.rating}`;

    live.textContent =
      `${metrics.score}%`;

    stats.innerHTML = `
      <div><span>Flat land</span><b>${metrics.flatPct}%</b></div>
      <div><span>Water</span><b>${metrics.waterPct}%</b></div>
      <div><span>Forest</span><b>${metrics.forestPct}%</b></div>
      <div><span>Mountain</span><b>${metrics.mountainPct}%</b></div>
      <div><span>Owner</span><b>${escapeHtml(
        state.worldType === "singleplayer"
          ? "You"
          : reserved
            ? "Neutral"
            : owner?.owner_username || "Unclaimed"
      )}</b></div>
    `;

    if (summary) {
      progress.innerHTML = `
        <div class="mg-sw-progress-title">WORLD PROGRESS</div>
        <div class="mg-sw-progress-grid">
          <span>Population <b>${formatNumber(summary.population || 0)}</b></span>
          <span>Cities <b>${formatNumber(summary.cities || 0)}</b></span>
          <span>Buildings <b>${formatNumber(summary.buildings || 0)}</b></span>
          <span>Shields <b>${formatNumber(summary.shields || 0)}</b></span>
        </div>
      `;
    } else {
      progress.innerHTML = "";
    }

    const mine =
      state.worldType === "singleplayer" ||
      (
        owner &&
        owner.owner_id ===
        state.callbacks.getCurrentUserId?.()
      );

    if (
      state.worldType === "singleplayer"
    ) {
      primary.disabled = true;
      primary.textContent =
        "YOUR WORLD";
      enter.hidden = false;
      return;
    }

    if (reserved) {
      primary.disabled = true;
      primary.textContent =
        "NEUTRAL TERRITORY";
      enter.hidden = true;
      return;
    }

    if (mine) {
      primary.disabled = true;
      primary.textContent =
        "YOUR TERRITORY";
      enter.hidden = false;
      return;
    }

    if (owner) {
      primary.disabled = true;
      primary.textContent =
        "CLAIMED";
      enter.hidden = true;
      return;
    }

    primary.disabled = false;
    primary.textContent =
      state.callbacks.hasOwnedTerritory?.()
        ? "GO TO MY TERRITORY"
        : "CLAIM TERRITORY";

    enter.hidden = true;
  }

  function terrainLabel(kind) {
    return {
      water: "Water / Lake",
      snow: "Snow Mountain",
      mountain: "Mountain",
      hills: "Hills",
      wetland: "Wetland",
      dry: "Dry Plains",
      forest: "Forest",
      plains: "Grassland"
    }[kind] || "Terrain";
  }

  function formatNumber(value) {
    return Number(value || 0)
      .toLocaleString();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  function centerOnPreferredTerritory() {
    const preferred =
      state.callbacks.getPreferredTerritory?.();

    if (preferred) {
      state.cameraX =
        clamp(
          Number(preferred.x) + 0.5,
          0,
          WORLD_COLS
        );

      state.cameraY =
        clamp(
          Number(preferred.y) + 0.5,
          0,
          WORLD_ROWS
        );
    } else {
      state.cameraX =
        WORLD_COLS * 0.5;

      state.cameraY =
        WORLD_ROWS * 0.5;
    }

    clampCamera();
    queueVisibleRegions();
    state.needsDraw = true;
  }

  function open(options = {}) {
    ensureDom();

    state.callbacks =
      options.callbacks || {};

    state.worldType =
      options.worldType ||
      "singleplayer";

    state.open = true;
    state.root.hidden = false;
    state.root.querySelector('#mgSwReturn').hidden = !state.callbacks.canReturn?.();

    // The map is intentionally a stable fixed scale.
    // Reopening it preserves the previous camera position unless a center
    // is explicitly supplied.
    if (options.center) {
      state.cameraX =
        clamp(
          Number(options.center.x) + 0.5,
          0,
          WORLD_COLS
        );

      state.cameraY =
        clamp(
          Number(options.center.y) + 0.5,
          0,
          WORLD_ROWS
        );
    }

    resize();
    queueVisibleRegions();
    updateInspector(
      state.hover ||
      state.selected
    );

    state.needsDraw = true;
  }

  function close() {
    state.open = false;

    if (state.root) {
      state.root.hidden = true;
    }

    if (state.streamTimer) {
      clearTimeout(
        state.streamTimer
      );

      state.streamTimer = 0;
    }
  }

  function updateClaims() {
    state.needsDraw = true;

    updateInspector(
      state.hover ||
      state.selected
    );
  }

  function setTerritorySummary(
    territoryId,
    summary
  ) {
    if (!territoryId) return;

    if (!summary) {
      state.civilization.delete(
        territoryId
      );
    } else {
      state.civilization.set(
        territoryId,
        { ...summary }
      );
    }

    state.needsDraw = true;
  }

  function setTerritorySummaries(
    rows = []
  ) {
    state.civilization.clear();

    for (const row of rows) {
      const id =
        row.territory_id ||
        row.id;

      if (!id) continue;

      state.civilization.set(
        id,
        { ...row }
      );
    }

    state.needsDraw = true;
  }

  function refreshInspector() {
    updateInspector(
      state.hover ||
      state.selected
    );

    state.needsDraw = true;
  }

  window.mapGameStrategicWorld = {
    VERSION: "0.3.2A3",
    WORLD_COLS,
    WORLD_ROWS,
    TERRITORY_COUNT,
    CELL_PX,
    REGION_CELLS,

    open,
    close,
    updateClaims,
    setTerritorySummary,
    setTerritorySummaries,
    refreshInspector,

    terrainAt,
    territoryMetrics,

    getState: () => ({
      open: state.open,
      worldType: state.worldType,
      cameraX: state.cameraX,
      cameraY: state.cameraY,
      selected: state.selected
        ? { ...state.selected }
        : null,
      hover: state.hover
        ? { ...state.hover }
        : null,
      loadedRegions:
        state.regionCache.size,
      queuedRegions:
        state.regionQueue.length
    })
  };

  console.log(
    `Map Game 0.3.2A strategic world ready — ${TERRITORY_COUNT.toLocaleString()} territories, fixed-scale pan-only map.`
  );
})();
