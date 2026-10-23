
// ============================================================
// MAP GAME — basic_world.js
// Basic 0.3A1 — 2D TERRAIN FOUNDATION
//
// SAME GAMEPLAY WORLD, DIFFERENT RENDERER.
// Logical territory size remains 32,768 x 32,768.
// Regular/3D is paused, not deleted.
//
// Foundation in this pass:
// - chunked 2D renderer
// - deterministic world/territory seed
// - elevation + ridged mountains
// - moisture / dry-wet surface variation
// - hillshade
// - lakes / lowland water
// - clustered forest canopy
// - sparse rocks / snow at high elevations
// - pan + zoom
// - terrain inspector
// - 512m visual chunks; only visible chunks draw
// ============================================================

(() => {
  "use strict";

  const canvas = document.getElementById("basicCanvas");
  if (!canvas) {
    console.error("Map Game Basic 0.3A1: #basicCanvas is missing.");
    return;
  }

  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true
  });

  const TERRITORY_SIZE =
    Number(window.mapGameWorldConfig?.TERRITORY_SIZE || 32768);

  const CHUNK_SIZE =
    Number(window.mapGameWorldConfig?.SECTOR_SIZE || 512);

  const CHUNKS_PER_SIDE =
    Math.ceil(TERRITORY_SIZE / CHUNK_SIZE);

  const CACHE_LIMIT = 140;
  const TILE_PIXELS = 192;

  const state = {
    active: false,
    territory: null,
    seed: 0,
    cameraX: TERRITORY_SIZE / 2,
    cameraZ: TERRITORY_SIZE / 2,
    zoom: 0.048,
    minZoom: 0.022,
    maxZoom: 0.72,
    dragging: false,
    lastX: 0,
    lastY: 0,
    hoverWorld: null,
    cache: new Map(),
    cacheClock: 0,
    needsDraw: true,
    inspector: null,
    lastFrame: 0,
    showLabels: true
  };

  // ----------------------------------------------------------
  // Math / deterministic noise
  // ----------------------------------------------------------

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function hash32(x, y, seed) {
    let h = Math.imul((x | 0) ^ (seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h ^= Math.imul((y | 0) ^ 0xc2b2ae35, 0x27d4eb2f);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967295;
  }

  function valueNoise(x, z, scale, seedOffset = 0) {
    const fx = x / scale;
    const fz = z / scale;

    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const tx = smooth(fx - x0);
    const tz = smooth(fz - z0);

    const s = state.seed + seedOffset;

    const a = hash32(x0, z0, s);
    const b = hash32(x1, z0, s);
    const c = hash32(x0, z1, s);
    const d = hash32(x1, z1, s);

    return lerp(
      lerp(a, b, tx),
      lerp(c, d, tx),
      tz
    );
  }

  function fbm(x, z, baseScale, octaves, seedOffset = 0) {
    let total = 0;
    let amplitude = 1;
    let norm = 0;
    let scale = baseScale;

    for (let i = 0; i < octaves; i++) {
      total += valueNoise(x, z, scale, seedOffset + i * 193) * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
      scale *= 0.5;
    }

    return total / Math.max(0.0001, norm);
  }

  function ridged(x, z, scale, octaves, seedOffset = 0) {
    let total = 0;
    let amplitude = 1;
    let norm = 0;
    let currentScale = scale;

    for (let i = 0; i < octaves; i++) {
      let n = valueNoise(x, z, currentScale, seedOffset + i * 271);
      n = 1 - Math.abs(n * 2 - 1);
      n *= n;

      total += n * amplitude;
      norm += amplitude;
      amplitude *= 0.55;
      currentScale *= 0.52;
    }

    return total / Math.max(0.0001, norm);
  }

  // Global-ish coordinates ensure neighboring territories can later share
  // the same large-scale features instead of each territory being isolated.
  function globalPoint(localX, localZ) {
    const tx = Number(state.territory?.x || 0);
    const ty = Number(state.territory?.y || 0);

    return {
      x: tx * TERRITORY_SIZE + localX,
      z: ty * TERRITORY_SIZE + localZ
    };
  }

  function terrainSample(localX, localZ) {
    const gp = globalPoint(localX, localZ);
    const x = gp.x;
    const z = gp.z;

    // Broad continental / regional form.
    const broad = fbm(x, z, 14500, 4, 1101);

    // Mid-frequency elevation.
    const rolling = fbm(x, z, 4600, 5, 2201);

    // Mountain ridges are gated by a large regional field so they form
    // coherent chains rather than appearing evenly everywhere.
    const mountainRegion =
      smooth(clamp((fbm(x, z, 18000, 3, 3301) - 0.48) / 0.28, 0, 1));

    const ridge =
      ridged(x, z, 6200, 5, 4401) * mountainRegion;

    // Basin / valley modifier.
    const valley = fbm(x, z, 7200, 4, 5501);

    let elevation =
      0.31 * broad +
      0.35 * rolling +
      0.48 * ridge -
      0.10 * (1 - valley);

    elevation = clamp(elevation, 0, 1);

    const moisture = clamp(
      0.58 * fbm(x, z, 6900, 5, 6601) +
      0.42 * fbm(x, z, 19000, 3, 7701),
      0,
      1
    );

    const temperature = clamp(
      0.70 * fbm(x, z, 22000, 3, 8801) +
      0.30 * (1 - elevation),
      0,
      1
    );

    // Low basins become lakes/wetlands. This is deliberately conservative
    // in A1; drainage-fed rivers arrive in A2.
    const lakeField =
      fbm(x, z, 5200, 4, 9901);

    const water =
      elevation < 0.235 &&
      lakeField > 0.47;

    const steepness =
      clamp(
        ridge * 0.78 +
        Math.max(0, elevation - 0.63) * 1.1,
        0,
        1
      );

    let forest = clamp(
      (moisture - 0.39) * 1.75 +
      fbm(x, z, 2100, 4, 12101) * 0.72 -
      steepness * 0.52 -
      Math.max(0, 0.30 - elevation) * 1.5,
      0,
      1
    );

    if (water) forest = 0;

    let terrain = "grassland";

    if (water) {
      terrain = "water";
    } else if (elevation > 0.82) {
      terrain = temperature < 0.58 ? "snow_peak" : "high_rock";
    } else if (elevation > 0.69 || steepness > 0.70) {
      terrain = "mountain";
    } else if (elevation > 0.57 || steepness > 0.47) {
      terrain = "hills";
    } else if (moisture < 0.31) {
      terrain = "dry_plains";
    } else if (moisture > 0.68 && forest > 0.56) {
      terrain = "forest";
    } else if (moisture > 0.72 && elevation < 0.39) {
      terrain = "wet_grassland";
    }

    const buildability =
      water
        ? "BLOCKED"
        : steepness > 0.78
          ? "VERY DIFFICULT"
          : steepness > 0.54
            ? "DIFFICULT"
            : elevation > 0.52
              ? "GOOD"
              : "EXCELLENT";

    return {
      elevation,
      moisture,
      temperature,
      ridge,
      steepness,
      forest,
      water,
      terrain,
      buildability
    };
  }

  // ----------------------------------------------------------
  // Color / art helpers
  // ----------------------------------------------------------

  function mixColor(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }

  const COLORS = {
    deepGrass: [76, 119, 66],
    grass: [104, 143, 75],
    lightGrass: [126, 158, 83],
    dry: [156, 151, 82],
    dry2: [176, 158, 91],
    wet: [62, 122, 73],
    hill: [116, 122, 72],
    rock: [103, 99, 86],
    highRock: [116, 112, 104],
    snow: [210, 216, 209],
    waterDeep: [34, 103, 135],
    waterShallow: [48, 129, 153],
    forest: [49, 100, 53]
  };

  function terrainColor(sample, x, z) {
    let base;

    if (sample.water) {
      const waterNoise = fbm(x, z, 850, 3, 14101);
      return mixColor(
        COLORS.waterDeep,
        COLORS.waterShallow,
        clamp(waterNoise * 0.85, 0, 1)
      );
    }

    switch (sample.terrain) {
      case "dry_plains":
        base = mixColor(
          COLORS.dry,
          COLORS.dry2,
          sample.temperature
        );
        break;

      case "wet_grassland":
        base = COLORS.wet;
        break;

      case "forest":
        base = mixColor(
          COLORS.deepGrass,
          COLORS.forest,
          sample.forest * 0.72
        );
        break;

      case "hills":
        base = mixColor(
          COLORS.grass,
          COLORS.hill,
          clamp(sample.steepness, 0, 1)
        );
        break;

      case "mountain":
        base = mixColor(
          COLORS.hill,
          COLORS.rock,
          clamp(sample.steepness, 0, 1)
        );
        break;

      case "high_rock":
        base = COLORS.highRock;
        break;

      case "snow_peak":
        base = mixColor(
          COLORS.highRock,
          COLORS.snow,
          0.78
        );
        break;

      default:
        base = mixColor(
          COLORS.grass,
          COLORS.lightGrass,
          clamp((sample.moisture - 0.35) * 0.6, 0, 0.45)
        );
        break;
    }

    const micro =
      (fbm(x, z, 610, 3, 15101) - 0.5) * 18;

    return [
      clamp(Math.round(base[0] + micro), 0, 255),
      clamp(Math.round(base[1] + micro), 0, 255),
      clamp(Math.round(base[2] + micro), 0, 255)
    ];
  }

  function elevationMeters(sample) {
    // Visual/gameplay scale for Basic. This can later feed Regular's mesh.
    return Math.round(sample.elevation * 940);
  }

  function hillShade(localX, localZ, step = 36) {
    const west = terrainSample(localX - step, localZ).elevation;
    const east = terrainSample(localX + step, localZ).elevation;
    const north = terrainSample(localX, localZ - step).elevation;
    const south = terrainSample(localX, localZ + step).elevation;

    const dx = east - west;
    const dz = south - north;

    // Virtual light from upper-left / northwest.
    const light =
      (-dx * 0.68) +
      (-dz * 0.52);

    return clamp(light * 2.8, -0.24, 0.24);
  }

  // ----------------------------------------------------------
  // Chunk rasterization
  // ----------------------------------------------------------

  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function renderChunk(cx, cz) {
    const off = document.createElement("canvas");
    off.width = TILE_PIXELS;
    off.height = TILE_PIXELS;

    const c = off.getContext("2d", { alpha: false });
    const image = c.createImageData(TILE_PIXELS, TILE_PIXELS);
    const data = image.data;

    const worldX0 = cx * CHUNK_SIZE;
    const worldZ0 = cz * CHUNK_SIZE;

    for (let py = 0; py < TILE_PIXELS; py++) {
      for (let px = 0; px < TILE_PIXELS; px++) {
        const localX =
          worldX0 +
          (px + 0.5) / TILE_PIXELS * CHUNK_SIZE;

        const localZ =
          worldZ0 +
          (py + 0.5) / TILE_PIXELS * CHUNK_SIZE;

        const sample = terrainSample(localX, localZ);
        const color = terrainColor(sample, localX, localZ);
        const shade = sample.water ? 0 : hillShade(localX, localZ, 42);

        const i = (py * TILE_PIXELS + px) * 4;

        data[i] = clamp(color[0] + shade * 255, 0, 255);
        data[i + 1] = clamp(color[1] + shade * 255, 0, 255);
        data[i + 2] = clamp(color[2] + shade * 255, 0, 255);
        data[i + 3] = 255;
      }
    }

    c.putImageData(image, 0, 0);

    drawChunkArt(c, cx, cz);

    return off;
  }

  function drawChunkArt(c, cx, cz) {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;

    // Tree crowns are generated deterministically at a much lower density
    // than the underlying forest field. At far zoom they merge into canopy.
    const treeSlots = 58;

    for (let i = 0; i < treeSlots; i++) {
      const rx = hash32(cx * 719 + i * 13, cz * 911, state.seed + 17001);
      const rz = hash32(cx * 811, cz * 613 + i * 17, state.seed + 18001);

      const wx = x0 + rx * CHUNK_SIZE;
      const wz = z0 + rz * CHUNK_SIZE;
      const s = terrainSample(wx, wz);

      if (
        s.water ||
        s.forest < 0.48 ||
        hash32(i, cx + cz * 31, state.seed + 19001) > s.forest
      ) {
        continue;
      }

      const px = rx * TILE_PIXELS;
      const py = rz * TILE_PIXELS;
      const size =
        2.2 +
        hash32(i, cx, state.seed + 20001) * 3.4;

      const tint =
        hash32(i, cz, state.seed + 21001);

      c.beginPath();
      c.arc(
        px + size * 0.35,
        py + size * 0.50,
        size * 0.92,
        0,
        Math.PI * 2
      );
      c.fillStyle = "rgba(19,55,28,.20)";
      c.fill();

      c.beginPath();
      c.arc(px, py, size, 0, Math.PI * 2);
      c.fillStyle =
        tint > 0.52
          ? "rgba(35,91,42,.94)"
          : "rgba(46,105,48,.94)";
      c.fill();

      c.beginPath();
      c.arc(
        px - size * 0.28,
        py - size * 0.30,
        size * 0.46,
        0,
        Math.PI * 2
      );
      c.fillStyle = "rgba(93,142,72,.66)";
      c.fill();
    }

    // Sparse top-down rock accents in mountainous regions.
    const rockSlots = 18;

    for (let i = 0; i < rockSlots; i++) {
      const rx = hash32(cx * 101 + i * 29, cz * 71, state.seed + 22001);
      const rz = hash32(cx * 59, cz * 97 + i * 23, state.seed + 23001);

      const wx = x0 + rx * CHUNK_SIZE;
      const wz = z0 + rz * CHUNK_SIZE;
      const s = terrainSample(wx, wz);

      if (
        s.water ||
        s.steepness < 0.58
      ) {
        continue;
      }

      const px = rx * TILE_PIXELS;
      const py = rz * TILE_PIXELS;
      const size = 1.5 + s.steepness * 3.3;

      c.save();
      c.translate(px, py);
      c.rotate(
        hash32(i, cx - cz, state.seed + 24001) * Math.PI
      );

      c.fillStyle = "rgba(67,67,63,.66)";
      c.beginPath();
      c.moveTo(-size, size * 0.5);
      c.lineTo(-size * 0.35, -size);
      c.lineTo(size * 0.9, -size * 0.4);
      c.lineTo(size, size * 0.62);
      c.closePath();
      c.fill();

      c.restore();
    }
  }

  function getChunk(cx, cz) {
    if (
      cx < 0 ||
      cz < 0 ||
      cx >= CHUNKS_PER_SIDE ||
      cz >= CHUNKS_PER_SIDE
    ) {
      return null;
    }

    const key = chunkKey(cx, cz);

    if (state.cache.has(key)) {
      const item = state.cache.get(key);
      item.lastUsed = ++state.cacheClock;
      return item.canvas;
    }

    const rendered = renderChunk(cx, cz);

    state.cache.set(key, {
      canvas: rendered,
      lastUsed: ++state.cacheClock
    });

    pruneCache();

    return rendered;
  }

  function pruneCache() {
    if (state.cache.size <= CACHE_LIMIT) return;

    const items = [...state.cache.entries()]
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    while (
      items.length &&
      state.cache.size > CACHE_LIMIT
    ) {
      const [key] = items.shift();
      state.cache.delete(key);
    }
  }

  // ----------------------------------------------------------
  // Camera / coordinate conversion
  // ----------------------------------------------------------

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const rect = canvas.getBoundingClientRect();

    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      state.needsDraw = true;
    }
  }

  function worldToScreen(x, z) {
    return {
      x: canvas.width / 2 + (x - state.cameraX) * state.zoom,
      y: canvas.height / 2 + (z - state.cameraZ) * state.zoom
    };
  }

  function screenToWorld(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / Math.max(1, rect.width);
    const dprY = canvas.height / Math.max(1, rect.height);

    const sx = (screenX - rect.left) * dprX;
    const sy = (screenY - rect.top) * dprY;

    return {
      x:
        state.cameraX +
        (sx - canvas.width / 2) / state.zoom,
      z:
        state.cameraZ +
        (sy - canvas.height / 2) / state.zoom
    };
  }

  function clampCamera() {
    const halfW = canvas.width / (2 * state.zoom);
    const halfH = canvas.height / (2 * state.zoom);

    state.cameraX = clamp(
      state.cameraX,
      Math.min(TERRITORY_SIZE / 2, halfW),
      Math.max(TERRITORY_SIZE / 2, TERRITORY_SIZE - halfW)
    );

    state.cameraZ = clamp(
      state.cameraZ,
      Math.min(TERRITORY_SIZE / 2, halfH),
      Math.max(TERRITORY_SIZE / 2, TERRITORY_SIZE - halfH)
    );
  }

  // ----------------------------------------------------------
  // Drawing
  // ----------------------------------------------------------

  function draw() {
    if (!state.active) return;

    resize();
    clampCamera();

    ctx.fillStyle = "#102018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const worldLeft =
      state.cameraX - canvas.width / (2 * state.zoom);

    const worldRight =
      state.cameraX + canvas.width / (2 * state.zoom);

    const worldTop =
      state.cameraZ - canvas.height / (2 * state.zoom);

    const worldBottom =
      state.cameraZ + canvas.height / (2 * state.zoom);

    const minCX =
      clamp(Math.floor(worldLeft / CHUNK_SIZE) - 1, 0, CHUNKS_PER_SIDE - 1);

    const maxCX =
      clamp(Math.floor(worldRight / CHUNK_SIZE) + 1, 0, CHUNKS_PER_SIDE - 1);

    const minCZ =
      clamp(Math.floor(worldTop / CHUNK_SIZE) - 1, 0, CHUNKS_PER_SIDE - 1);

    const maxCZ =
      clamp(Math.floor(worldBottom / CHUNK_SIZE) + 1, 0, CHUNKS_PER_SIDE - 1);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const chunk = getChunk(cx, cz);
        if (!chunk) continue;

        const p = worldToScreen(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
        const size = CHUNK_SIZE * state.zoom + 1.5;

        ctx.drawImage(
          chunk,
          p.x,
          p.y,
          size,
          size
        );
      }
    }

    drawTerritoryBorder();
    drawScale();
    drawHoverMarker();

    state.needsDraw = false;
  }

  function drawTerritoryBorder() {
    const a = worldToScreen(0, 0);
    const b = worldToScreen(TERRITORY_SIZE, TERRITORY_SIZE);

    ctx.save();
    ctx.strokeStyle = "rgba(104,223,247,.42)";
    ctx.lineWidth = Math.max(1.2, canvas.width / 1200);
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(
      a.x,
      a.y,
      b.x - a.x,
      b.y - a.y
    );
    ctx.restore();
  }

  function drawScale() {
    const meters =
      state.zoom > 0.32
        ? 250
        : state.zoom > 0.15
          ? 500
          : state.zoom > 0.07
            ? 1000
            : 2000;

    const px = meters * state.zoom;
    const x = 28;
    const y = canvas.height - 36;

    ctx.save();
    ctx.strokeStyle = "rgba(236,247,248,.82)";
    ctx.fillStyle = "rgba(236,247,248,.82)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.moveTo(x + px, y - 5);
    ctx.lineTo(x + px, y + 5);
    ctx.stroke();

    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(
      meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
      x,
      y - 10
    );
    ctx.restore();
  }

  function drawHoverMarker() {
    if (!state.hoverWorld) return;

    const p = worldToScreen(
      state.hoverWorld.x,
      state.hoverWorld.z
    );

    ctx.save();
    ctx.strokeStyle = "rgba(108,222,247,.92)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function loop(now) {
    if (
      state.active &&
      (state.needsDraw || now - state.lastFrame > 950)
    ) {
      draw();
      state.lastFrame = now;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // ----------------------------------------------------------
  // Inspector
  // ----------------------------------------------------------

  function ensureInspector() {
    if (state.inspector) return state.inspector;

    const panel = document.createElement("aside");
    panel.id = "mgTerrainInspector";
    panel.className = "mg-basic-terrain-inspector";
    panel.innerHTML = `
      <header>
        <div>
          <div class="mg-kicker">BASIC • TERRAIN</div>
          <h3>Terrain Info</h3>
        </div>
      </header>
      <div data-terrain-body>
        Move over the world to inspect terrain.
      </div>
    `;

    document.body.appendChild(panel);
    state.inspector = panel;
    return panel;
  }

  function updateInspector(world) {
    const panel = ensureInspector();
    const body = panel.querySelector("[data-terrain-body]");

    if (!world || !body) return;

    const x = clamp(world.x, 0, TERRITORY_SIZE);
    const z = clamp(world.z, 0, TERRITORY_SIZE);

    const s = terrainSample(x, z);

    const step = 40;
    const ex = terrainSample(x + step, z).elevation;
    const wx = terrainSample(x - step, z).elevation;
    const nz = terrainSample(x, z - step).elevation;
    const sz = terrainSample(x, z + step).elevation;

    const slope =
      Math.hypot(ex - wx, sz - nz) * 11;

    body.innerHTML = `
      <div class="mg-basic-terrain-name">
        ${escapeHtml(titleForTerrain(s.terrain))}
      </div>

      <dl>
        <div><dt>Elevation</dt><dd>${elevationMeters(s)} m</dd></div>
        <div><dt>Slope</dt><dd>${Math.round(slope * 100)}%</dd></div>
        <div><dt>Moisture</dt><dd>${Math.round(s.moisture * 100)}%</dd></div>
        <div><dt>Forest</dt><dd>${Math.round(s.forest * 100)}%</dd></div>
        <div><dt>Buildability</dt><dd>${s.buildability}</dd></div>
        <div><dt>Position</dt><dd>${Math.round(x)}, ${Math.round(z)}</dd></div>
      </dl>
    `;
  }

  function titleForTerrain(id) {
    return {
      water: "Lake / Water",
      grassland: "Grassland",
      dry_plains: "Dry Plains",
      wet_grassland: "Wet Grassland",
      forest: "Forest",
      hills: "Hills",
      mountain: "Mountain",
      high_rock: "High Mountain",
      snow_peak: "Snow Peak"
    }[id] || "Terrain";
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
  // Input
  // ----------------------------------------------------------

  canvas.addEventListener("pointerdown", event => {
    if (!state.active) return;

    state.dragging = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!state.active) return;

    const world = screenToWorld(event.clientX, event.clientY);

    state.hoverWorld = {
      x: clamp(world.x, 0, TERRITORY_SIZE),
      z: clamp(world.z, 0, TERRITORY_SIZE)
    };

    updateInspector(state.hoverWorld);

    if (state.dragging) {
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);

      state.cameraX -= dx * scaleX / state.zoom;
      state.cameraZ -= dy * scaleY / state.zoom;

      state.lastX = event.clientX;
      state.lastY = event.clientY;

      clampCamera();
    }

    state.needsDraw = true;
  });

  function stopDrag(event) {
    state.dragging = false;

    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch (_) {}
  }

  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("pointerleave", event => {
    if (event.buttons === 0) {
      state.dragging = false;
    }
  });

  canvas.addEventListener(
    "wheel",
    event => {
      if (!state.active) return;

      event.preventDefault();

      const before = screenToWorld(event.clientX, event.clientY);

      const factor =
        event.deltaY < 0 ? 1.14 : 1 / 1.14;

      state.zoom = clamp(
        state.zoom * factor,
        state.minZoom,
        state.maxZoom
      );

      const after = screenToWorld(event.clientX, event.clientY);

      // Zoom toward the mouse pointer.
      state.cameraX += before.x - after.x;
      state.cameraZ += before.z - after.z;

      clampCamera();
      state.needsDraw = true;
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    state.needsDraw = true;
  });

  window.addEventListener("keydown", event => {
    if (!state.active) return;

    const speed =
      (event.shiftKey ? 1100 : 480) /
      Math.max(0.035, state.zoom);

    let moved = false;

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      state.cameraX -= speed * 0.05;
      moved = true;
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      state.cameraX += speed * 0.05;
      moved = true;
    }

    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      state.cameraZ -= speed * 0.05;
      moved = true;
    }

    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      state.cameraZ += speed * 0.05;
      moved = true;
    }

    if (event.key === "Home") {
      state.cameraX = TERRITORY_SIZE / 2;
      state.cameraZ = TERRITORY_SIZE / 2;
      state.zoom = 0.048;
      moved = true;
    }

    if (moved) {
      event.preventDefault();
      clampCamera();
      state.needsDraw = true;
    }
  });

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  function seedForTerritory(territory) {
    const worldSeed =
      Number(localStorage.getItem("mapgame_world_seed") || 734221);

    return (
      Math.imul(Number(territory.x || 0) + 8192, 92837111) ^
      Math.imul(Number(territory.y || 0) + 8192, 689287499) ^
      worldSeed
    ) | 0;
  }

  async function enterTerritory(territory) {
    state.territory = territory;
    state.seed = seedForTerritory(territory);

    state.cache.clear();
    state.cacheClock = 0;

    state.cameraX = TERRITORY_SIZE / 2;
    state.cameraZ = TERRITORY_SIZE / 2;
    state.zoom = 0.048;
    state.hoverWorld = null;

    canvas.hidden = false;
    canvas.classList.add("active");

    const threeD = document.getElementById("gameCanvas");
    if (threeD) {
      threeD.style.visibility = "hidden";
      threeD.style.pointerEvents = "none";
    }

    state.active = true;
    state.needsDraw = true;

    ensureInspector().hidden = false;

    // Yield once so the loading screen can paint before chunk generation.
    await new Promise(resolve => requestAnimationFrame(resolve));

    draw();

    return {
      territoryId: territory.id,
      renderer: "BASIC_2D",
      size: TERRITORY_SIZE,
      chunkSize: CHUNK_SIZE
    };
  }

  function leave() {
    state.active = false;
    canvas.hidden = true;
    canvas.classList.remove("active");

    if (state.inspector) {
      state.inspector.hidden = true;
    }

    const threeD = document.getElementById("gameCanvas");
    if (threeD) {
      threeD.style.visibility = "";
      threeD.style.pointerEvents = "";
    }
  }

  function invalidate() {
    state.cache.clear();
    state.needsDraw = true;
  }

  window.mapGameBasicWorld = {
    VERSION: "0.3A1",
    TERRITORY_SIZE,
    CHUNK_SIZE,
    CHUNKS_PER_SIDE,
    enterTerritory,
    leave,
    invalidate,
    sample: terrainSample,
    elevationMeters,
    getState: () => ({
      active: state.active,
      territory: state.territory,
      cameraX: state.cameraX,
      cameraZ: state.cameraZ,
      zoom: state.zoom,
      cachedChunks: state.cache.size
    })
  };

  console.log(
    "Map Game Basic 0.3A1 terrain renderer ready — 32K 2D world foundation."
  );
})();