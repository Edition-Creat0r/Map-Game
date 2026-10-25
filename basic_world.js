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

  const CACHE_LIMIT = 120;

  // Detailed chunk raster. 96px is enough because a 512m chunk is normally
  // smaller than this on screen until the player is already zoomed well in.
  const TILE_PIXELS = 64;

  // Far zoom MUST NOT build all 4,096 detailed chunks. At territory scale we
  // draw one lightweight overview raster, then switch to chunks as you zoom.
  const OVERVIEW_PIXELS = 160; // startup-safe overview; detail streams later
  const DETAIL_ZOOM_THRESHOLD = 0.145;
  const TREE_CLUSTER_ZOOM = 0.155;
  const TREE_DETAIL_ZOOM = 0.245;
  const MOUNTAIN_DETAIL_ZOOM = 0.145;
  const MAX_DETAIL_CHUNKS_PER_FRAME = 32;
  const MAX_TREE_SYMBOLS = 80;
  const MAX_MOUNTAIN_SYMBOLS = 65;

  const state = {
    active: false,
    territory: null,
    seed: 0,
    cameraX: TERRITORY_SIZE / 2,
    cameraZ: TERRITORY_SIZE / 2,
    // Camera is intentionally constrained so a 32K territory feels huge.
    zoom: 0.32,
    minZoom: 0.24,
    maxZoom: 2.0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    hoverWorld: null,
    cache: new Map(),
    cacheClock: 0,
    overviewCanvas: null,
    overviewReady: false,
    needsDraw: true,
    inspector: null,
    lastFrame: 0,
    showLabels: true,
    queuedChunks: new Set(),
    generationQueue: [],
    lastInteraction: 0,
    treeImages: [],
    treesLoading: false
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
    const t=state.territory || {x:0,y:0};
    return window.mapGameSharedTerrain.local(Number(t.x)||0,Number(t.y)||0,localX,localZ);
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

  const TEXTURE_PATHS = {
    grass: "assets/textures/grass/grass_diffuse.jpg",
    dirt: "assets/textures/dirt/dirt.jpg",
    rock: "assets/textures/rock/rock_diffuse.jpg",
    sand: "assets/textures/sand/sand_diffuse.jpg",
    dryPlains: "assets/textures/terrain/dry_plains_01/plains.jpg",
    rockyGrass: "assets/textures/terrain/rocky_grass_01/thick_grass.jpg",
    snow: "assets/textures/terrain/snow_01/snow.jpg",
    wetGround: "assets/textures/terrain/wet_ground_01/wet_grass.jpg"
  };

  const textureImages = {};
  let texturesReady = false;

  function loadTextureImage(key, path) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        textureImages[key] = img;
        resolve(true);
      };
      img.onerror = () => {
        console.warn(`Basic texture missing: ${path}`);
        resolve(false);
      };
      img.src = path;
    });
  }

  async function loadTerrainTextures() {
    if (texturesReady) return;
    await Promise.all(
      Object.entries(TEXTURE_PATHS).map(
        ([key, path]) => loadTextureImage(key, path)
      )
    );
    texturesReady = true;
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
          clamp(0.34 + sample.forest * 0.62, 0, 1)
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
          [104, 111, 73],
          [91, 88, 79],
          clamp(0.35 + sample.steepness * 0.72, 0, 1)
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

    // Continuous material weights, not square biome labels. Color follows
    // the same masks that will drive the later texture blending pass.
    const wt=sample.weights || {};
    const materials=[
      [COLORS.grass,wt.grass||0],
      [COLORS.hill,wt.rockyGrass||0],
      [COLORS.rock,wt.rock||0],
      [COLORS.snow,wt.snow||0],
      [COLORS.dry,wt.dry||0],
      [COLORS.wet,wt.wet||0]
    ];
    let sum=0,r=0,g=0,bb=0;
    for(const [color,amount] of materials){sum+=amount;r+=color[0]*amount;g+=color[1]*amount;bb+=color[2]*amount;}
    if(sum>0.01 && !sample.water){base=mixColor(base,[r/sum,g/sum,bb/sum],.65);}
    const micro =
      (fbm(x, z, 610, 3, 15101) - 0.5) * 18;

    return [
      clamp(Math.round(base[0] + micro), 0, 255),
      clamp(Math.round(base[1] + micro), 0, 255),
      clamp(Math.round(base[2] + micro), 0, 255)
    ];
  }

  function textureKeyForSample(sample) {
    if (sample.water) return null;
    switch (sample.terrain) {
      case "dry_plains": return "dryPlains";
      case "wet_grassland": return "wetGround";
      case "forest": return "grass";
      case "hills": return sample.steepness > 0.52 ? "rockyGrass" : "grass";
      case "mountain":
      case "high_rock": return "rock";
      case "snow_peak": return "snow";
      default: return "grass";
    }
  }

  function drawTexturePatch(context, image, x, y, w, h, alpha) {
    if (!image) return;
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(image, x, y, w, h);
    context.restore();
  }

  function elevationMeters(sample) {
    // Visual/gameplay scale for Basic. This can later feed Regular's mesh.
    return Math.round(sample.elevation * 940);
  }

  function hillShade(localX, localZ, step = 56) {
    // Detail-only hillshade. Far-zoom overview computes shading from its
    // already-sampled elevation grid instead of resampling terrain 4x/pixel.
    const west = terrainSample(localX - step, localZ).elevation;
    const east = terrainSample(localX + step, localZ).elevation;
    const north = terrainSample(localX, localZ - step).elevation;
    const south = terrainSample(localX, localZ + step).elevation;

    const dx = east - west;
    const dz = south - north;

    const light =
      (-dx * 0.68) +
      (-dz * 0.52);

    return clamp(light * 2.7, -0.22, 0.22);
  }

  // ----------------------------------------------------------
  // Territory overview LOD
  // ----------------------------------------------------------

  function buildOverview() {
    if (state.overviewReady && state.overviewCanvas) {
      return state.overviewCanvas;
    }

    const off = document.createElement("canvas");
    off.width = OVERVIEW_PIXELS;
    off.height = OVERVIEW_PIXELS;

    const c = off.getContext("2d", { alpha: false });
    const image = c.createImageData(OVERVIEW_PIXELS, OVERVIEW_PIXELS);
    const data = image.data;

    // Sample terrain ONCE per overview pixel.
    const elevation = new Float32Array(OVERVIEW_PIXELS * OVERVIEW_PIXELS);
    const samples = new Array(OVERVIEW_PIXELS * OVERVIEW_PIXELS);

    for (let py = 0; py < OVERVIEW_PIXELS; py++) {
      const wz =
        (py + 0.5) /
        OVERVIEW_PIXELS *
        TERRITORY_SIZE;

      for (let px = 0; px < OVERVIEW_PIXELS; px++) {
        const wx =
          (px + 0.5) /
          OVERVIEW_PIXELS *
          TERRITORY_SIZE;

        const index = py * OVERVIEW_PIXELS + px;
        const s = terrainSample(wx, wz);

        samples[index] = s;
        elevation[index] = s.elevation;
      }
    }

    // Shade from neighboring cached elevation values. This is dramatically
    // cheaper than calling terrainSample four extra times per pixel.
    for (let py = 0; py < OVERVIEW_PIXELS; py++) {
      for (let px = 0; px < OVERVIEW_PIXELS; px++) {
        const index = py * OVERVIEW_PIXELS + px;
        const s = samples[index];

        const wx =
          (px + 0.5) /
          OVERVIEW_PIXELS *
          TERRITORY_SIZE;

        const wz =
          (py + 0.5) /
          OVERVIEW_PIXELS *
          TERRITORY_SIZE;

        const west =
          elevation[
            py * OVERVIEW_PIXELS +
            Math.max(0, px - 1)
          ];

        const east =
          elevation[
            py * OVERVIEW_PIXELS +
            Math.min(OVERVIEW_PIXELS - 1, px + 1)
          ];

        const north =
          elevation[
            Math.max(0, py - 1) * OVERVIEW_PIXELS +
            px
          ];

        const south =
          elevation[
            Math.min(OVERVIEW_PIXELS - 1, py + 1) * OVERVIEW_PIXELS +
            px
          ];

        const shade =
          s.water
            ? 0
            : clamp(
                ((west - east) * 0.90 + (north - south) * 0.72) * 3.0,
                -0.31,
                0.27
              );

        const color = terrainColor(s, wx, wz);
        const i = index * 4;

        data[i] = clamp(color[0] + shade * 255, 0, 255);
        data[i + 1] = clamp(color[1] + shade * 255, 0, 255);
        data[i + 2] = clamp(color[2] + shade * 255, 0, 255);
        data[i + 3] = 255;
      }
    }

    c.putImageData(image, 0, 0);

    // Forest color is already encoded continuously in the terrain raster.
    // Do not overlay a grid of circles at far zoom; it reveals the sampling
    // lattice and looks like dots instead of a forest.

    state.overviewCanvas = off;
    state.overviewReady = true;

    return off;
  }

  function drawOverview() {
    const overview = buildOverview();

    const a = worldToScreen(0, 0);
    const b = worldToScreen(TERRITORY_SIZE, TERRITORY_SIZE);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      overview,
      a.x,
      a.y,
      b.x - a.x,
      b.y - a.y
    );
  }

  // ----------------------------------------------------------
  // Chunk rasterization
  // ----------------------------------------------------------

  function chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  let terrainRevision = 0;
  let chunkBuildPending = false;

  async function renderChunk(cx, cz) {
    const revision = terrainRevision;
    let budgetStart = performance.now();
    const off = document.createElement("canvas");
    off.width = TILE_PIXELS;
    off.height = TILE_PIXELS;

    const c = off.getContext("2d", { alpha: false });
    const image = c.createImageData(TILE_PIXELS, TILE_PIXELS);
    const data = image.data;

    const worldX0 = cx * CHUNK_SIZE;
    const worldZ0 = cz * CHUNK_SIZE;

    for (let py = 0; py < TILE_PIXELS; py++) {
      if (revision !== terrainRevision || !state.active) return null;
      if (performance.now() - budgetStart >= 4) {
        await new Promise(resolve => setTimeout(resolve, 0));
        budgetStart = performance.now();
      }
      for (let px = 0; px < TILE_PIXELS; px++) {
        const localX =
          worldX0 +
          px /
          Math.max(1, TILE_PIXELS - 1) *
          CHUNK_SIZE;

        const localZ =
          worldZ0 +
          py /
          Math.max(1, TILE_PIXELS - 1) *
          CHUNK_SIZE;

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

    // 0.3.2A3.2: Do not paint square image patches onto chunks. They
    // expose a rectangular grid and don't agree across chunk edges.
    // Shared biome weights already provide smooth material colors; a
    // world-anchored seamless weighted texture compositor comes next.
    drawChunkArt(c, cx, cz);

    return off;
  }

  function drawChunkArt(c, cx, cz) {
    // Intentionally empty in 0.3A2.
    //
    // Trees/rocks used to be baked into each 512m chunk. That made crowns
    // clip at chunk borders and exposed the chunk grid while zooming.
    // Natural objects are now drawn in world space after the terrain pass,
    // so they remain continuous across chunk boundaries.
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

    queueChunk(cx, cz);
    return null;
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
  // World-space natural detail LOD
  // ----------------------------------------------------------

  function visibleWorldBounds() {
    return {
      left: state.cameraX - canvas.width / (2 * state.zoom),
      right: state.cameraX + canvas.width / (2 * state.zoom),
      top: state.cameraZ - canvas.height / (2 * state.zoom),
      bottom: state.cameraZ + canvas.height / (2 * state.zoom)
    };
  }

  function drawTreeSymbol(screenX, screenY, radius, seed) {
    const shadowX = radius * 0.34;
    const shadowY = radius * 0.42;

    ctx.beginPath();
    ctx.arc(
      screenX + shadowX,
      screenY + shadowY,
      radius * 0.96,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(13,35,19,.24)";
    ctx.fill();

    // Irregular layered crown rather than one perfect circle.
    const lobes = 5;
    for (let i = 0; i < lobes; i++) {
      const angle =
        (i / lobes) * Math.PI * 2 +
        hash32(seed, i, state.seed + 41001) * 0.55;

      const rr =
        radius *
        (0.38 + hash32(seed, i + 11, state.seed + 42001) * 0.23);

      const ox = Math.cos(angle) * radius * 0.36;
      const oy = Math.sin(angle) * radius * 0.32;

      ctx.beginPath();
      ctx.arc(
        screenX + ox,
        screenY + oy,
        rr,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        i % 2 === 0
          ? "rgba(34,91,43,.96)"
          : "rgba(44,108,49,.96)";

      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(
      screenX - radius * 0.22,
      screenY - radius * 0.24,
      radius * 0.28,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(111,154,80,.72)";
    ctx.fill();
  }

  function drawForestLOD() {
    if (state.zoom < TREE_CLUSTER_ZOOM) return;

    const bounds = visibleWorldBounds();

    // At medium zoom, each deterministic 220m cell may show one canopy
    // cluster. At close zoom, 96m cells reveal individual trees.
    const cell =
      state.zoom >= TREE_DETAIL_ZOOM
        ? 96
        : 220;

    const startX =
      Math.max(0, Math.floor(bounds.left / cell) - 1);

    const endX =
      Math.min(
        Math.ceil(TERRITORY_SIZE / cell),
        Math.floor(bounds.right / cell) + 1
      );

    const startZ =
      Math.max(0, Math.floor(bounds.top / cell) - 1);

    const endZ =
      Math.min(
        Math.ceil(TERRITORY_SIZE / cell),
        Math.floor(bounds.bottom / cell) + 1
      );

    const close =
      state.zoom >= TREE_DETAIL_ZOOM;

    let drawn = 0;

    for (let gz = startZ; gz <= endZ; gz++) {
      for (let gx = startX; gx <= endX; gx++) {
        const r1 = hash32(gx, gz, state.seed + 31001);
        const r2 = hash32(gx, gz, state.seed + 32001);

        const wx =
          gx * cell +
          r1 * cell;

        const wz =
          gz * cell +
          r2 * cell;

        if (
          wx < 0 ||
          wz < 0 ||
          wx > TERRITORY_SIZE ||
          wz > TERRITORY_SIZE
        ) {
          continue;
        }

        const s = terrainSample(wx, wz);

        if (
          s.water ||
          s.forest < 0.48
        ) {
          continue;
        }

        const spawn =
          hash32(gx, gz, state.seed + 33001);

        if (
          spawn >
          clamp(
            (s.forest - 0.38) * 1.28,
            0,
            0.92
          )
        ) {
          continue;
        }

        if (drawn >= MAX_TREE_SYMBOLS) return;

        const p = worldToScreen(wx, wz);
        drawn++;

        if (close) {
          const radius =
            clamp(
              3.1 + state.zoom * 9,
              3.2,
              8.5
            );

          drawTreeSymbol(
            p.x,
            p.y,
            radius,
            gx * 100000 + gz
          );
        } else {
          const radius =
            clamp(
              cell * state.zoom * 0.28,
              5,
              14
            );

          const grad =
            ctx.createRadialGradient(
              p.x - radius * 0.2,
              p.y - radius * 0.25,
              radius * 0.1,
              p.x,
              p.y,
              radius
            );

          grad.addColorStop(0, "rgba(78,128,65,.48)");
          grad.addColorStop(0.55, "rgba(38,92,44,.42)");
          grad.addColorStop(1, "rgba(24,68,34,.04)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(
            p.x,
            p.y,
            radius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
  }

  function drawMountainRidges() {
    if (state.zoom < MOUNTAIN_DETAIL_ZOOM) return;

    const bounds = visibleWorldBounds();
    const cell =
      state.zoom >= 0.20
        ? 180
        : 340;

    const sx =
      Math.max(0, Math.floor(bounds.left / cell) - 1);

    const ex =
      Math.min(
        Math.ceil(TERRITORY_SIZE / cell),
        Math.floor(bounds.right / cell) + 1
      );

    const sz =
      Math.max(0, Math.floor(bounds.top / cell) - 1);

    const ez =
      Math.min(
        Math.ceil(TERRITORY_SIZE / cell),
        Math.floor(bounds.bottom / cell) + 1
      );

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawn = 0;

    for (let gz = sz; gz <= ez; gz++) {
      for (let gx = sx; gx <= ex; gx++) {
        const wx =
          gx * cell +
          hash32(gx, gz, state.seed + 35001) * cell;

        const wz =
          gz * cell +
          hash32(gx, gz, state.seed + 36001) * cell;

        const s = terrainSample(wx, wz);

        if (
          s.water ||
          (
            s.terrain !== "mountain" &&
            s.terrain !== "high_rock" &&
            s.terrain !== "snow_peak"
          )
        ) {
          continue;
        }

        if (drawn >= MAX_MOUNTAIN_SYMBOLS) {
          ctx.restore();
          return;
        }

        drawn++;
        const p = worldToScreen(wx, wz);

        const size =
          clamp(
            (12 + s.steepness * 23) *
            Math.sqrt(state.zoom / 0.1),
            10,
            34
          );

        // Dark downslope mass.
        ctx.fillStyle = "rgba(48,47,43,.30)";
        ctx.beginPath();
        ctx.moveTo(
          p.x - size,
          p.y + size * 0.65
        );
        ctx.lineTo(
          p.x,
          p.y - size * 0.92
        );
        ctx.lineTo(
          p.x + size * 1.05,
          p.y + size * 0.72
        );
        ctx.closePath();
        ctx.fill();

        // Lit ridge face.
        ctx.fillStyle =
          s.terrain === "snow_peak"
            ? "rgba(224,229,221,.65)"
            : "rgba(155,151,133,.28)";

        ctx.beginPath();
        ctx.moveTo(
          p.x,
          p.y - size * 0.92
        );
        ctx.lineTo(
          p.x - size,
          p.y + size * 0.65
        );
        ctx.lineTo(
          p.x - size * 0.12,
          p.y + size * 0.22
        );
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle =
          s.terrain === "snow_peak"
            ? "rgba(241,244,238,.72)"
            : "rgba(76,74,68,.42)";

        ctx.lineWidth =
          clamp(
            1 + state.zoom * 3,
            1,
            2.5
          );

        ctx.beginPath();
        ctx.moveTo(
          p.x - size * 0.72,
          p.y + size * 0.46
        );
        ctx.lineTo(
          p.x,
          p.y - size * 0.92
        );
        ctx.lineTo(
          p.x + size * 0.74,
          p.y + size * 0.48
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }


  // 0.3.2A2: Deterministic regional waterways; a provisional visual layer.
  // Full hydrological flow/accumulation will replace this art layer later.
  function drawWaterways() {
    const left = state.cameraX - canvas.width / (2 * state.zoom);
    const right = state.cameraX + canvas.width / (2 * state.zoom);
    const top = state.cameraZ - canvas.height / (2 * state.zoom);
    const bottom = state.cameraZ + canvas.height / (2 * state.zoom);
    const worldOffsetX = (Number(state.territory?.x) || 0) * TERRITORY_SIZE;
    const worldOffsetZ = (Number(state.territory?.y) || 0) * TERRITORY_SIZE;
    const globalLeft = left + worldOffsetX;
    const globalRight = right + worldOffsetX;
    // Drainage-like connected ribbons. They are anchored in GLOBAL world space,
    // so water continues between neighboring territories without resetting.
    const spacing = 10500;
    const first = Math.floor((globalLeft - 4500) / spacing);
    const last = Math.ceil((globalRight + 4500) / spacing);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let channel = first; channel <= last; channel++) {
      const phase = channel * 1.73;
      const riverX = gz => channel * spacing + 3200 +
        Math.sin(gz / 2800 + phase) * 1050 + Math.sin(gz / 800 + phase * 2) * 175;
      const step = Math.max(100, Math.min(350, 5 / state.zoom * 100));
      const start = Math.floor((top + worldOffsetZ - 500) / step) * step;
      const end = bottom + worldOffsetZ + 500;
      ctx.beginPath();
      let begun = false;
      for (let gz = start; gz <= end; gz += step) {
        const x = riverX(gz) - worldOffsetX;
        const z = gz - worldOffsetZ;
        const p = worldToScreen(x, z);
        if (!begun) { ctx.moveTo(p.x, p.y); begun = true; }
        else ctx.lineTo(p.x, p.y);
      }
      if (begun) {
        const width = Math.max(1.7, 36 * state.zoom);
        ctx.strokeStyle = 'rgba(46,65,57,.43)';
        ctx.lineWidth = width + Math.max(2, 12 * state.zoom);
        ctx.stroke();
        ctx.strokeStyle = '#347f9b';
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(125,204,217,.38)';
        ctx.lineWidth = Math.max(0.8, width * .18);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function loadTreeSprites() {
    if (state.treesLoading) return;
    state.treesLoading = true;
    const names = [
      'tree_small_green.png', 'tree_round_olive.png',
      'tree_round_dark_teal.png', 'tree_small_teal.png',
      'tree_deciduous_mint_large.png', 'tree_round_white_blossom.png'
    ];
    for (const name of names) {
      const img = new Image();
      img.onload = () => { state.needsDraw = true; };
      img.src = 'assets/environment/trees/' + name;
      state.treeImages.push(img);
    }
  }

  // Exact world-space samples survive camera motion; bounded per territory.
  const treeSamples = new Map();
  function drawTreeSprites() {
    if (state.zoom < .28 || state.dragging || !state.treeImages.length) return;
    const cell = state.zoom < .65 ? 105 : 72;
    const left = Math.max(0, state.cameraX - canvas.width / (2 * state.zoom));
    const right = Math.min(TERRITORY_SIZE, state.cameraX + canvas.width / (2 * state.zoom));
    const top = Math.max(0, state.cameraZ - canvas.height / (2 * state.zoom));
    const bottom = Math.min(TERRITORY_SIZE, state.cameraZ + canvas.height / (2 * state.zoom));
    let drawn = 0;
    for (let iz = Math.floor(top / cell); iz <= Math.ceil(bottom / cell) && drawn < 95; iz++) {
      for (let ix = Math.floor(left / cell); ix <= Math.ceil(right / cell) && drawn < 95; ix++) {
        const wx = (ix + hash32(ix, iz, state.seed + 144)) * cell;
        const wz = (iz + hash32(ix, iz, state.seed + 194)) * cell;
        const key = `${cell}:${ix}:${iz}`;
        let s = treeSamples.get(key);
        if (!s) {
          s = terrainSample(wx, wz);
          if (treeSamples.size >= 8192) treeSamples.delete(treeSamples.keys().next().value);
          treeSamples.set(key, s);
        }
        if (s.water || s.steepness > .69 || s.forest < .43) continue;
        if (hash32(ix, iz, state.seed + 293) > Math.min(.94, Math.pow(s.forest, 1.3) * 1.1)) continue;
        const img = state.treeImages[Math.floor(hash32(ix, iz, state.seed + 294) * state.treeImages.length)];
        if (!img?.complete || !img.naturalWidth) continue;
        const p = worldToScreen(wx, wz);
        const h = Math.max(17, Math.min(70, state.zoom * (52 + hash32(ix, iz, state.seed + 411) * 45)));
        const w = h * img.naturalWidth / img.naturalHeight;
        ctx.drawImage(img, p.x - w / 2, p.y - h * .80, w, h);
        drawn++;
      }
    }
  }

  // Missing chunks are queued rather than constructed during camera drawing.
  function queueChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (state.cache.has(key) || state.queuedChunks.has(key)) return;
    state.queuedChunks.add(key);
    state.generationQueue.push({cx, cz, key});
  }

  async function produceOneChunk() {
    if (chunkBuildPending || !state.active || state.dragging || !state.generationQueue.length) return;
    const job = state.generationQueue.shift();
    state.queuedChunks.delete(job.key);
    if (state.cache.has(job.key)) return;
    const revision = terrainRevision;
    chunkBuildPending = true;
    let built;
    try {
      built = await renderChunk(job.cx, job.cz);
    } finally {
      chunkBuildPending = false;
    }
    if (!built || revision !== terrainRevision || !state.active) return;
    state.cache.set(job.key, {canvas: built, lastUsed: ++state.cacheClock});
    pruneCache();
    state.needsDraw = true;
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

    const visibleChunkCount =
      (maxCX - minCX + 1) *
      (maxCZ - minCZ + 1);

    const useOverview =
      state.zoom < DETAIL_ZOOM_THRESHOLD ||
      visibleChunkCount > MAX_DETAIL_CHUNKS_PER_FRAME;

    // Discard queued work outside the current view before spending CPU on it.
    state.generationQueue = state.generationQueue.filter(job => {
      const visible = !useOverview && job.cx >= minCX && job.cx <= maxCX && job.cz >= minCZ && job.cz <= maxCZ;
      if (!visible) state.queuedChunks.delete(job.key);
      return visible;
    });
    drawOverview();
    if (!useOverview) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      for (let cz = minCZ; cz <= maxCZ; cz++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const chunk = getChunk(cx, cz);
          if (!chunk) continue;

          const p = worldToScreen(
            cx * CHUNK_SIZE,
            cz * CHUNK_SIZE
          );

          const size =
            CHUNK_SIZE * state.zoom + 1.5;

          ctx.drawImage(
            chunk,
            p.x,
            p.y,
            size,
            size
          );
        }
      }
    }

    // Natural art is drawn in world space, never baked into chunk edges.
    drawWaterways();
    if (!state.dragging) {
      if (state.zoom < .28) drawForestLOD();
      drawTreeSprites();
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

  let lastChunkBuild = 0;
  function loop(now) {
    if (state.active && !state.dragging && state.generationQueue.length && now - lastChunkBuild > 80) {
      lastChunkBuild = now;
      produceOneChunk();
    }
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
        event.deltaY < 0 ? 1.10 : 1 / 1.10;

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
      state.zoom = 0.32;
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
    if (!window.mapGameSharedTerrain) throw new Error("Shared terrain module not loaded. Check world_terrain.js path.");
    state.seed = window.mapGameSharedTerrain.seed;

    terrainRevision++;
    treeSamples.clear();
    state.cache.clear();
    state.queuedChunks.clear();
    state.generationQueue.length = 0;
    state.cacheClock = 0;
    state.overviewCanvas = null;
    state.overviewReady = false;

    state.cameraX = TERRITORY_SIZE / 2;
    state.cameraZ = TERRITORY_SIZE / 2;
    state.zoom = 0.32;
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

    // Yield so the loading overlay visibly updates first.
    await new Promise(resolve => requestAnimationFrame(resolve));

    loadTerrainTextures().then(() => { state.needsDraw = true; });
    loadTreeSprites();

    // Build one lightweight territory overview. Detailed chunks are generated
    // only after the player zooms in enough to need them.
    buildOverview();

    state.needsDraw = true;
    draw();

    return {
      territoryId: territory.id,
      renderer: "BASIC_2D",
      size: TERRITORY_SIZE,
      chunkSize: CHUNK_SIZE
    };
  }

  function leave() {
    terrainRevision++;
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
    terrainRevision++;
    treeSamples.clear();
    state.cache.clear();
    state.overviewCanvas = null;
    state.overviewReady = false;
    state.needsDraw = true;
  }

  window.mapGameBasicWorld = {
    VERSION: "0.3.2A3",
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
      cachedChunks: state.cache.size,
      lod:
        state.zoom < DETAIL_ZOOM_THRESHOLD
          ? "overview"
          : state.zoom < TREE_DETAIL_ZOOM
            ? "regional"
            : "close"
    })
  };

  console.log(
    "Map Game Basic 0.3A3 textured performance renderer ready — 32K 2D world foundation."
  );
})();
