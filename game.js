// ============================================================
// MAP GAME — ALPHA 0.2.0 RESTRUCTURE
// FIRST PLAYABLE WORLD FLOW FOUNDATION
// Replace your current game.js with this file.
//
// This version intentionally removes the old pre-built city/spawn layout.
// Flow:
//  1) Neutral Central Hub
//  2) 2D strategic world map
//  3) Claim one territory chunk
//  4) Enter that territory
//  5) Pick a capital site
//  6) Establish capital (only construction action enabled for now)
//
// Future systems are visible but locked:
// residential/commercial/industrial zones, factories, power,
// defense, walls, military, attacks, clearing tools, upgrades.
// ============================================================

(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  if (!canvas || !window.BABYLON) {
    console.error("Map Game 0.2.0: canvas or Babylon.js missing.");
    return;
  }

  // ==========================================================
  // ENGINE / SCENE
  // ==========================================================

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.62, 0.79, 0.94, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.00092;
  scene.fogColor = new BABYLON.Color3(0.62, 0.79, 0.94);
  scene.ambientColor = new BABYLON.Color3(0.17, 0.20, 0.25);

  const camera = new BABYLON.ArcRotateCamera(
    "mainCamera",
    -Math.PI / 2,
    1.02,
    265,
    new BABYLON.Vector3(0, 20, 0),
    scene
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 35;
  camera.upperRadiusLimit = 650;
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = 1.36;
  camera.wheelPrecision = 28;
  camera.panningSensibility = 80;
  camera.inertia = 0.83;
  camera.panningInertia = 0.85;

  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0.15, 1, 0.1),
    scene
  );
  hemi.intensity = 0.66;
  hemi.groundColor = new BABYLON.Color3(0.16, 0.19, 0.22);

  const sun = new BABYLON.DirectionalLight(
    "sun",
    new BABYLON.Vector3(-0.48, -1, -0.34),
    scene
  );
  sun.position = new BABYLON.Vector3(260, 420, 180);
  sun.intensity = 1.22;

  const moon = new BABYLON.DirectionalLight(
    "moon",
    new BABYLON.Vector3(0.42, -1, 0.26),
    scene
  );
  moon.position = new BABYLON.Vector3(-250, 330, -160);
  moon.intensity = 0.0;
  moon.diffuse = new BABYLON.Color3(0.48, 0.62, 0.94);

  const shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;

  const glowLayer = new BABYLON.GlowLayer("glow", scene, { blurKernelSize: 24 });
  glowLayer.intensity = 0.32;

  // ==========================================================
  // CONSTANTS / GAME STATE
  // ==========================================================

  const VERSION = "0.2.1";
  const CHUNK_WORLD_SIZE = 980;
  const WORLD_COLS = 44;
  const WORLD_ROWS = 30;
  const CENTRAL_X = Math.floor(WORLD_COLS / 2);
  const CENTRAL_Y = Math.floor(WORLD_ROWS / 2);
  const HUB_RADIUS = 430;

  const state = {
    mode: "HOME", // HOME | HUB | MAP | TERRITORY | CAPITAL_PLACEMENT
    worldType: "singleplayer", // singleplayer | central
    graphics: localStorage.getItem("mapgame_graphics") || "BASIC",
    selectedTerritory: null,
    activeTerritory: null,
    claimedTerritories: new Map(),
    capital: null,
    multiplayerState: null,
    terrainRoot: null,
    hubRoot: null,
    capitalGhost: null,
    pendingCapitalXZ: null,
    mapCamera: { x: CENTRAL_X, y: CENTRAL_Y, zoom: 1.0 },
    neutralHubReserved: true
  };

  const localSaveKey = "mapGame_alpha021_firstPlayable";

  // ==========================================================
  // UTILITIES
  // ==========================================================

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hash2(x, y, salt = 0) {
    let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h ^= Math.imul((y | 0) ^ 0xc2b2ae35, 0x27d4eb2f);
    h ^= Math.imul(salt | 0, 0x165667b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967295;
  }

  function seeded(x, y, i = 0) {
    return hash2(x * 101 + i * 17, y * 137 - i * 31, 911);
  }

  function territoryId(x, y) {
    return `T_${x}_${y}`;
  }

  function parseTerritoryId(id) {
    const m = /^T_(-?\d+)_(-?\d+)$/.exec(String(id || ""));
    if (!m) return null;
    return { x: Number(m[1]), y: Number(m[2]) };
  }

  function isCentralReserved(x, y) {
    return Math.abs(x - CENTRAL_X) <= 1 && Math.abs(y - CENTRAL_Y) <= 1;
  }

  function showToast(message, kind = "info") {
    let host = document.getElementById("mgToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "mgToastHost";
      document.body.appendChild(host);
    }
    const toast = document.createElement("div");
    toast.className = `mg-toast mg-toast-${kind}`;
    toast.textContent = message;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 240);
    }, 3000);
  }

  function setStatus(text) {
    const el = document.getElementById("mgBottomStatusText");
    if (el) el.innerHTML = text;
  }

  function disposeNode(node) {
    if (!node) return;

    // IMPORTANT:
    // World roots share the global grass/rock/glass/road materials.
    // Disposing child materials here caused the next scene (hub/territory)
    // to lose its ground and appear as a blue void.
    try {
      node.dispose(false, false);
    } catch (_) {
      try { node.dispose(); } catch (_) {}
    }
  }

  function setMode(mode) {
    state.mode = mode;
    document.body.dataset.mapgameMode = mode.toLowerCase();
    updateModeUI();
  }

  // ==========================================================
  // MATERIALS
  // ==========================================================

  function stdMat(name, color, spec = 0.04) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = color;
    m.specularColor = new BABYLON.Color3(spec, spec, spec);
    m.specularPower = 24;
    return m;
  }

  const grassMat = stdMat("grassMat", new BABYLON.Color3(0.35, 0.48, 0.24), 0.02);
  const grassLightMat = stdMat("grassLightMat", new BABYLON.Color3(0.46, 0.58, 0.30), 0.02);
  const dirtMat = stdMat("dirtMat", new BABYLON.Color3(0.31, 0.23, 0.15), 0.01);
  const rockMat = stdMat("rockMat", new BABYLON.Color3(0.35, 0.38, 0.42), 0.03);
  const snowMat = stdMat("snowMat", new BABYLON.Color3(0.89, 0.92, 0.95), 0.03);
  const sandMat = stdMat("sandMat", new BABYLON.Color3(0.72, 0.63, 0.43), 0.01);
  const terrainBaseMat = stdMat(
    "terrainBaseMat",
    new BABYLON.Color3(0.18, 0.24, 0.15),
    0.01
  );
  const roadMat = stdMat("roadMat", new BABYLON.Color3(0.055, 0.065, 0.075), 0.04);
  const roadEdgeMat = stdMat("roadEdgeMat", new BABYLON.Color3(0.22, 0.24, 0.25), 0.03);
  const concreteMat = stdMat("concreteMat", new BABYLON.Color3(0.50, 0.53, 0.55), 0.05);
  const concreteLightMat = stdMat("concreteLightMat", new BABYLON.Color3(0.68, 0.70, 0.71), 0.05);
  const darkMat = stdMat("darkMat", new BABYLON.Color3(0.07, 0.085, 0.10), 0.08);
  const metalMat = stdMat("metalMat", new BABYLON.Color3(0.25, 0.28, 0.31), 0.28);
  const treeTrunkMat = stdMat("treeTrunkMat", new BABYLON.Color3(0.24, 0.16, 0.085), 0.01);
  const treeLeafMat = stdMat("treeLeafMat", new BABYLON.Color3(0.10, 0.33, 0.12), 0.01);
  const treeLeafAltMat = stdMat("treeLeafAltMat", new BABYLON.Color3(0.16, 0.40, 0.15), 0.01);

  // ----------------------------------------------------------
  // REAL TERRAIN TEXTURES
  // Uses the grass / rock / sand files you already added.
  // If one file is missing Babylon falls back to the material color.
  // ----------------------------------------------------------

  function terrainTexture(path, scale) {
    const tex = new BABYLON.Texture(
      path,
      scene,
      false,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = scale;
    tex.vScale = scale;
    tex.anisotropicFilteringLevel = state.graphics === "REGULAR" ? 8 : 2;
    return tex;
  }

  const grassDiffuse = terrainTexture("assets/textures/grass/grass_diffuse.jpg", 18);
  const grassNormal = terrainTexture("assets/textures/grass/grass_normal.jpg", 18);
  grassNormal.level = 0.50;
  grassMat.diffuseTexture = grassDiffuse;
  grassMat.bumpTexture = grassNormal;
  grassLightMat.diffuseTexture = grassDiffuse;
  grassLightMat.bumpTexture = grassNormal;

  const rockDiffuse = terrainTexture("assets/textures/rock/rock_diffuse.jpg", 10);
  const rockNormal = terrainTexture("assets/textures/rock/rock_normal.jpg", 10);
  rockNormal.level = 0.72;
  rockMat.diffuseTexture = rockDiffuse;
  rockMat.bumpTexture = rockNormal;

  const sandDiffuse = terrainTexture("assets/textures/sand/sand_diffuse.jpg", 14);
  const sandNormal = terrainTexture("assets/textures/sand/sand_normal.jpg", 14);
  sandNormal.level = 0.42;
  sandMat.diffuseTexture = sandDiffuse;
  sandMat.bumpTexture = sandNormal;

  const roadMarkingMat = stdMat("roadMarkingMat", new BABYLON.Color3(0.92, 0.82, 0.28), 0.02);
  roadMarkingMat.emissiveColor = new BABYLON.Color3(0.08, 0.07, 0.01);

  const lampGlowMat = stdMat("lampGlow", new BABYLON.Color3(1.0, 0.78, 0.32), 0.02);
  lampGlowMat.emissiveColor = new BABYLON.Color3(1.0, 0.58, 0.12);

  const waterMat = new BABYLON.PBRMaterial("waterMat", scene);
  waterMat.albedoColor = new BABYLON.Color3(0.025, 0.21, 0.34);
  waterMat.metallic = 0.05;
  waterMat.roughness = 0.16;
  waterMat.alpha = 0.84;
  waterMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;

  const glassBasic = new BABYLON.StandardMaterial("glassBasic", scene);
  glassBasic.diffuseColor = new BABYLON.Color3(0.08, 0.24, 0.35);
  glassBasic.specularColor = new BABYLON.Color3(0.65, 0.75, 0.82);
  glassBasic.specularPower = 96;
  glassBasic.alpha = 0.82;

  const glassRegular = new BABYLON.PBRMaterial("glassRegular", scene);
  glassRegular.albedoColor = new BABYLON.Color3(0.055, 0.17, 0.25);
  glassRegular.metallic = 0.12;
  glassRegular.roughness = 0.10;
  glassRegular.alpha = 0.76;
  glassRegular.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  glassRegular.indexOfRefraction = 1.45;
  glassRegular.environmentIntensity = 1.05;
  glassRegular.clearCoat.isEnabled = true;
  glassRegular.clearCoat.intensity = 0.55;
  glassRegular.clearCoat.roughness = 0.14;

  const facadeRegular = new BABYLON.PBRMaterial("facadeRegular", scene);
  facadeRegular.albedoColor = new BABYLON.Color3(0.39, 0.43, 0.47);
  facadeRegular.metallic = 0.08;
  facadeRegular.roughness = 0.34;
  facadeRegular.clearCoat.isEnabled = true;
  facadeRegular.clearCoat.intensity = 0.16;
  facadeRegular.clearCoat.roughness = 0.28;

  // ==========================================================
  // SKY / TIME
  // ==========================================================

  let dayClock = 12.5;
  let lastFrame = performance.now();

  function updateDayNight(dt) {
    dayClock = (dayClock + dt / 720000) % 24;
    const t = dayClock / 24;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(angle);
    const daylight = clamp((sunHeight + 0.22) / 0.88, 0.07, 1);

    sun.direction.set(-Math.cos(angle) * 0.56, -Math.max(0.16, sunHeight), -0.36);
    sun.intensity = 0.18 + daylight * 1.02;
    hemi.intensity = 0.28 + daylight * 0.40;
    moon.intensity = (1 - daylight) * 0.42;

    const daySky = new BABYLON.Color3(0.59, 0.78, 0.94);
    const nightSky = new BABYLON.Color3(0.035, 0.055, 0.11);
    const duskSky = new BABYLON.Color3(0.34, 0.25, 0.31);
    let sky;
    if (daylight < 0.28) {
      sky = BABYLON.Color3.Lerp(nightSky, duskSky, daylight / 0.28);
    } else {
      sky = BABYLON.Color3.Lerp(duskSky, daySky, (daylight - 0.28) / 0.72);
    }
    scene.clearColor = new BABYLON.Color4(sky.r, sky.g, sky.b, 1);
    scene.fogColor.copyFrom(sky);

    const timeEl = document.getElementById("mgTime");
    if (timeEl) {
      let hr = Math.floor(dayClock);
      const min = Math.floor((dayClock - hr) * 60);
      const ap = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;
      timeEl.textContent = `${hr}:${String(min).padStart(2, "0")} ${ap}`;
    }
  }

  // ==========================================================
  // MOUNTAIN GENERATOR — RING-BASED, NOT CUT CONES
  // ==========================================================

  function createMountainMesh(name, x, z, radius, height, seed, parent) {
    const rings = 7;
    const segments = state.graphics === "REGULAR" ? 13 : 10;
    const positions = [];
    const indices = [];
    const uvs = [];

    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const y = Math.pow(t, 1.12) * height;
      const shrink = Math.pow(1 - t, 0.76);
      const centerDriftX = (hash2(seed, r, 33) - 0.5) * radius * 0.24 * t;
      const centerDriftZ = (hash2(seed, r, 71) - 0.5) * radius * 0.24 * t;

      for (let s = 0; s < segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const jag = 0.76 + hash2(seed + r * 9, s, 121) * 0.40;
        const ridge = 1 + Math.sin(a * 3 + seed * 0.17) * 0.10;
        const rr = radius * shrink * jag * ridge;
        positions.push(
          x + centerDriftX + Math.cos(a) * rr,
          y,
          z + centerDriftZ + Math.sin(a) * rr
        );
        uvs.push(s / segments, t);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const n = (s + 1) % segments;
        const a = r * segments + s;
        const b = r * segments + n;
        const c = (r + 1) * segments + s;
        const d = (r + 1) * segments + n;
        indices.push(a, c, b, b, c, d);
      }
    }

    const topCenterIndex = positions.length / 3;
    const topOffsetX = (hash2(seed, 888, 9) - 0.5) * radius * 0.18;
    const topOffsetZ = (hash2(seed, 999, 9) - 0.5) * radius * 0.18;
    positions.push(x + topOffsetX, height * 1.04, z + topOffsetZ);
    uvs.push(0.5, 1);
    const topRingStart = rings * segments;
    for (let s = 0; s < segments; s++) {
      indices.push(topRingStart + s, topCenterIndex, topRingStart + ((s + 1) % segments));
    }

    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const vd = new BABYLON.VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;

    const mesh = new BABYLON.Mesh(name, scene);
    vd.applyToMesh(mesh);
    mesh.material = rockMat;
    mesh.parent = parent || null;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    shadowGenerator.addShadowCaster(mesh);

    if (height > 70) {
      const cap = BABYLON.MeshBuilder.CreatePolyhedron(`${name}_snow`, {
        type: 1,
        size: radius * 0.28
      }, scene);
      cap.scaling = new BABYLON.Vector3(1.5, height / Math.max(1, radius) * 0.38, 1.2);
      cap.position = new BABYLON.Vector3(x + topOffsetX, height * 0.90, z + topOffsetZ);
      cap.material = snowMat;
      cap.parent = parent || null;
      cap.isPickable = false;
    }

    return mesh;
  }

  function createMountainRange(root, cx, cz, count, baseRadius, baseHeight, seed) {
    for (let i = 0; i < count; i++) {
      const along = i - (count - 1) / 2;
      const r = baseRadius * (0.76 + hash2(seed, i, 4) * 0.52);
      const h = baseHeight * (0.76 + hash2(seed, i, 8) * 0.58);
      const x = cx + along * baseRadius * 1.04 + (hash2(seed, i, 13) - 0.5) * r * 0.8;
      const z = cz + (hash2(seed, i, 19) - 0.5) * r * 1.4;
      createMountainMesh(`mountain_${seed}_${i}`, x, z, r, h, seed * 100 + i, root);

      // foothills make ranges blend into the landscape rather than isolated spikes
      if (i % 2 === 0) {
        createMountainMesh(
          `foothill_${seed}_${i}`,
          x + r * 0.74,
          z + r * 0.52,
          r * 0.52,
          h * 0.38,
          seed * 130 + i,
          root
        );
      }
    }
  }

  // ==========================================================
  // TREES / VEGETATION
  // ==========================================================

  function createTree(root, x, z, scale = 1, type = 0) {
    const node = new BABYLON.TransformNode("tree", scene);
    node.parent = root;
    node.position.set(x, 0, z);
    node.scaling.setAll(scale);
    node.metadata = { vegetation: true };

    const trunk = BABYLON.MeshBuilder.CreateCylinder("treeTrunk", {
      diameterTop: 0.9,
      diameterBottom: 1.25,
      height: 6.3,
      tessellation: 8
    }, scene);
    trunk.position.y = 3.15;
    trunk.material = treeTrunkMat;
    trunk.parent = node;
    trunk.isPickable = false;

    if (type === 1) {
      for (let i = 0; i < 3; i++) {
        const crown = BABYLON.MeshBuilder.CreateCylinder("pineCrown", {
          diameterTop: 0,
          diameterBottom: 6.8 - i * 1.1,
          height: 5.6,
          tessellation: 9
        }, scene);
        crown.position.y = 6.0 + i * 2.25;
        crown.material = i % 2 ? treeLeafAltMat : treeLeafMat;
        crown.parent = node;
        crown.isPickable = false;
      }
    } else {
      const crown = BABYLON.MeshBuilder.CreateIcoSphere("treeCrown", {
        radius: 4.0,
        subdivisions: state.graphics === "REGULAR" ? 2 : 1
      }, scene);
      crown.position.y = 8.2;
      crown.scaling = new BABYLON.Vector3(1.08, 0.82, 0.96);
      crown.material = type === 2 ? treeLeafAltMat : treeLeafMat;
      crown.parent = node;
      crown.isPickable = false;
    }

    return node;
  }

  // ==========================================================
  // ROADS + STREET DETAIL
  // ==========================================================

  function createRoad(root, x, z, width, depth, rotation = 0, opts = {}) {
    const roadRoot = new BABYLON.TransformNode("roadRoot", scene);
    roadRoot.parent = root;
    roadRoot.position.set(x, 0, z);
    roadRoot.rotation.y = rotation;

    const sidewalkMargin = opts.sidewalk === false ? 0 : 6.0;
    if (sidewalkMargin) {
      const sidewalk = BABYLON.MeshBuilder.CreateBox("sidewalk", {
        width: width + sidewalkMargin * 2,
        depth: depth + sidewalkMargin * 2,
        height: 0.45
      }, scene);
      sidewalk.position.y = 0.20;
      sidewalk.material = concreteLightMat;
      sidewalk.parent = roadRoot;
      sidewalk.receiveShadows = true;
      sidewalk.isPickable = false;
    }

    const curb = BABYLON.MeshBuilder.CreateBox("curb", {
      width: width + 1.8,
      depth: depth + 1.8,
      height: 0.28
    }, scene);
    curb.position.y = 0.33;
    curb.material = roadEdgeMat;
    curb.parent = roadRoot;
    curb.isPickable = false;

    const road = BABYLON.MeshBuilder.CreateBox("road", {
      width,
      depth,
      height: 0.24
    }, scene);
    road.position.y = 0.48;
    road.material = roadMat;
    road.parent = roadRoot;
    road.receiveShadows = true;
    road.isPickable = false;

    const longAxisIsDepth = depth >= width;
    const length = longAxisIsDepth ? depth : width;
    const spacing = 18;
    const count = Math.floor(length / spacing);
    for (let i = 0; i < count; i++) {
      if (i % 2 !== 0) continue;
      const dash = BABYLON.MeshBuilder.CreateBox("roadDash", {
        width: longAxisIsDepth ? 0.65 : 6.0,
        depth: longAxisIsDepth ? 6.0 : 0.65,
        height: 0.035
      }, scene);
      const offset = -length / 2 + spacing / 2 + i * spacing;
      dash.position.set(longAxisIsDepth ? 0 : offset, 0.615, longAxisIsDepth ? offset : 0);
      dash.material = roadMarkingMat;
      dash.parent = roadRoot;
      dash.isPickable = false;
    }

    return roadRoot;
  }

  function createStreetLamp(root, x, z, rotation = 0, lit = true) {
    const node = new BABYLON.TransformNode("streetLamp", scene);
    node.parent = root;
    node.position.set(x, 0, z);
    node.rotation.y = rotation;

    const pole = BABYLON.MeshBuilder.CreateCylinder("lampPole", {
      diameter: 0.55,
      height: 8.5,
      tessellation: 10
    }, scene);
    pole.position.y = 4.25;
    pole.material = darkMat;
    pole.parent = node;
    pole.isPickable = false;

    const arm = BABYLON.MeshBuilder.CreateBox("lampArm", {
      width: 3.2,
      depth: 0.42,
      height: 0.42
    }, scene);
    arm.position.set(1.25, 8.1, 0);
    arm.material = darkMat;
    arm.parent = node;
    arm.isPickable = false;

    const head = BABYLON.MeshBuilder.CreateBox("lampHead", {
      width: 1.2,
      depth: 0.8,
      height: 0.35
    }, scene);
    head.position.set(2.65, 7.92, 0);
    head.material = lit ? lampGlowMat : darkMat;
    head.parent = node;
    head.isPickable = false;

    return node;
  }

  function populateRoadLamps(root, axis, start, end, fixed, spacing = 42) {
    for (let p = start; p <= end; p += spacing) {
      if (axis === "z") {
        createStreetLamp(root, fixed - 12.5, p, 0);
        createStreetLamp(root, fixed + 12.5, p, Math.PI);
      } else {
        createStreetLamp(root, p, fixed - 12.5, Math.PI / 2);
        createStreetLamp(root, p, fixed + 12.5, -Math.PI / 2);
      }
    }
  }

  // ==========================================================
  // BUILDINGS — REAL GLASS / SETBACKS / FACADE DETAIL
  // ==========================================================

  function buildingWallMaterial() {
    return state.graphics === "REGULAR" ? facadeRegular : concreteMat;
  }

  function buildingGlassMaterial() {
    return state.graphics === "REGULAR" ? glassRegular : glassBasic;
  }

  function addWindowGrid(root, w, h, d, opts = {}) {
    const floors = Math.max(2, Math.floor(h / (opts.floorHeight || 5.0)));
    const cols = Math.max(2, Math.floor(w / (opts.windowSpacing || 5.5)));
    const glass = buildingGlassMaterial();
    const frame = opts.frameMaterial || darkMat;
    const frontZ = -d / 2 - 0.13;
    const backZ = d / 2 + 0.13;

    // One large glass plane behind the frames makes regular mode read as curtain wall.
    const paneFront = BABYLON.MeshBuilder.CreateBox("curtainGlass", {
      width: w * 0.80,
      height: h * 0.78,
      depth: 0.18
    }, scene);
    paneFront.position.set(0, h * 0.52, frontZ);
    paneFront.material = glass;
    paneFront.parent = root;
    paneFront.isPickable = false;

    const paneBack = paneFront.clone("curtainGlassRear");
    paneBack.position.z = backZ;
    paneBack.parent = root;

    // Floor bands
    for (let f = 1; f < floors; f++) {
      const y = (f / floors) * h;
      for (const z of [frontZ - 0.08, backZ + 0.08]) {
        const band = BABYLON.MeshBuilder.CreateBox("floorBand", {
          width: w * 0.84,
          height: 0.26,
          depth: 0.22
        }, scene);
        band.position.set(0, y, z);
        band.material = frame;
        band.parent = root;
        band.isPickable = false;
      }
    }

    // Vertical mullions
    for (let c = 0; c <= cols; c++) {
      const x = lerp(-w * 0.40, w * 0.40, c / cols);
      for (const z of [frontZ - 0.10, backZ + 0.10]) {
        const mullion = BABYLON.MeshBuilder.CreateBox("mullion", {
          width: 0.24,
          height: h * 0.79,
          depth: 0.24
        }, scene);
        mullion.position.set(x, h * 0.52, z);
        mullion.material = frame;
        mullion.parent = root;
        mullion.isPickable = false;
      }
    }
  }

  function createOfficeTower(root, x, z, w, h, d, variant = 0) {
    const tower = new BABYLON.TransformNode("officeTower", scene);
    tower.parent = root;
    tower.position.set(x, 0, z);

    const podiumH = Math.min(12, h * 0.20);
    const podium = BABYLON.MeshBuilder.CreateBox("officePodium", {
      width: w * 1.22,
      height: podiumH,
      depth: d * 1.18
    }, scene);
    podium.position.y = podiumH / 2;
    podium.material = buildingWallMaterial();
    podium.parent = tower;
    podium.receiveShadows = true;
    shadowGenerator.addShadowCaster(podium);

    const shaftH = h - podiumH;
    const shaft = BABYLON.MeshBuilder.CreateBox("officeShaft", {
      width: w,
      height: shaftH,
      depth: d
    }, scene);
    shaft.position.y = podiumH + shaftH / 2;
    shaft.material = buildingWallMaterial();
    shaft.parent = tower;
    shaft.receiveShadows = true;
    shadowGenerator.addShadowCaster(shaft);

    // stepped crown / side setback — breaks the plain rectangle silhouette
    if (variant % 3 !== 1) {
      const crownH = Math.max(7, h * 0.12);
      const crown = BABYLON.MeshBuilder.CreateBox("towerCrown", {
        width: w * 0.74,
        height: crownH,
        depth: d * 0.74
      }, scene);
      crown.position.y = h + crownH / 2 - 1.0;
      crown.position.x = variant % 2 ? w * 0.10 : -w * 0.10;
      crown.material = darkMat;
      crown.parent = tower;
      shadowGenerator.addShadowCaster(crown);
    }

    addWindowGrid(tower, w, shaftH, d, {
      floorHeight: state.graphics === "REGULAR" ? 4.6 : 5.4,
      windowSpacing: state.graphics === "REGULAR" ? 4.7 : 6.0
    });

    // Side glass fins in Regular
    if (state.graphics === "REGULAR") {
      for (const sx of [-1, 1]) {
        const fin = BABYLON.MeshBuilder.CreateBox("glassFin", {
          width: 0.45,
          height: shaftH * 0.82,
          depth: d * 0.90
        }, scene);
        fin.position.set(sx * (w / 2 + 0.25), podiumH + shaftH * 0.52, 0);
        fin.material = metalMat;
        fin.parent = tower;
        fin.isPickable = false;
      }
    }

    // entrance canopy
    const canopy = BABYLON.MeshBuilder.CreateBox("officeCanopy", {
      width: w * 0.42,
      height: 0.45,
      depth: 5.5
    }, scene);
    canopy.position.set(0, 4.0, -d / 2 - 2.4);
    canopy.material = darkMat;
    canopy.parent = tower;

    tower.metadata = { neutralBuilding: true, buildingType: "office" };
    return tower;
  }

  function createGlassSkyscraper(root, x, z, w, h, d, variant = 0) {
    const tower = new BABYLON.TransformNode("glassSkyscraper", scene);
    tower.parent = root;
    tower.position.set(x, 0, z);

    const glass = buildingGlassMaterial();
    const segments = variant % 2 ? 3 : 2;
    let usedHeight = 0;
    for (let i = 0; i < segments; i++) {
      const segH = i === segments - 1 ? h - usedHeight : h * (0.34 + i * 0.08);
      const scale = 1 - i * 0.12;
      const body = BABYLON.MeshBuilder.CreateBox("glassTowerSegment", {
        width: w * scale,
        height: segH,
        depth: d * (1 - i * 0.08)
      }, scene);
      body.position.set(
        (i % 2 ? 1 : -1) * i * w * 0.035,
        usedHeight + segH / 2,
        (variant % 3 - 1) * i * 0.6
      );
      body.material = glass;
      body.parent = tower;
      body.receiveShadows = true;
      shadowGenerator.addShadowCaster(body);

      // metal slab at segment transition
      if (i > 0) {
        const slab = BABYLON.MeshBuilder.CreateBox("glassTowerSlab", {
          width: w * scale + 1.2,
          height: 0.55,
          depth: d * (1 - i * 0.08) + 1.2
        }, scene);
        slab.position.set(body.position.x, usedHeight + 0.10, body.position.z);
        slab.material = darkMat;
        slab.parent = tower;
      }
      usedHeight += segH;
    }

    // exterior vertical frames
    const frameCount = state.graphics === "REGULAR" ? 7 : 4;
    for (let i = 0; i < frameCount; i++) {
      const xPos = lerp(-w * 0.46, w * 0.46, i / Math.max(1, frameCount - 1));
      const frame = BABYLON.MeshBuilder.CreateBox("skyscraperFrame", {
        width: 0.34,
        height: h * 0.92,
        depth: 0.32
      }, scene);
      frame.position.set(xPos, h * 0.47, -d / 2 - 0.28);
      frame.material = metalMat;
      frame.parent = tower;
      frame.isPickable = false;
    }

    const roof = BABYLON.MeshBuilder.CreateBox("skyscraperRoof", {
      width: w * 0.64,
      height: 1.0,
      depth: d * 0.64
    }, scene);
    roof.position.y = h + 0.5;
    roof.material = darkMat;
    roof.parent = tower;

    if (variant % 2 === 0) {
      const spire = BABYLON.MeshBuilder.CreateCylinder("spire", {
        diameterTop: 0.16,
        diameterBottom: 0.65,
        height: Math.max(10, h * 0.17),
        tessellation: 8
      }, scene);
      spire.position.y = h + Math.max(10, h * 0.17) / 2;
      spire.material = metalMat;
      spire.parent = tower;
    }

    tower.metadata = { neutralBuilding: true, buildingType: "glassSkyscraper" };
    return tower;
  }

  // ==========================================================
  // NEUTRAL CENTRAL HUB
  // ==========================================================

  function buildNeutralHub() {
    disposeNode(state.terrainRoot);
    disposeNode(state.hubRoot);
    state.terrainRoot = null;

    const root = new BABYLON.TransformNode("NeutralCentralHub", scene);
    state.hubRoot = root;

    // ground
    const ground = BABYLON.MeshBuilder.CreateGround("hubGround", {
      width: HUB_RADIUS * 2.45,
      height: HUB_RADIUS * 2.45,
      subdivisions: 96
    }, scene);
    ground.material = grassMat;
    ground.receiveShadows = true;
    ground.parent = root;
    ground.metadata = { neutralGround: true };

    // Solid fallback layer beneath the textured surface.
    // Even if a terrain texture is still loading, the neutral hub never
    // appears to float over the sky.
    const hubBase = BABYLON.MeshBuilder.CreateBox("hubTerrainBase", {
      width: HUB_RADIUS * 2.52,
      height: 14,
      depth: HUB_RADIUS * 2.52
    }, scene);
    hubBase.position.y = -7.25;
    hubBase.material = terrainBaseMat;
    hubBase.receiveShadows = true;
    hubBase.parent = root;
    hubBase.isPickable = false;

    // central civic plaza
    const plaza = BABYLON.MeshBuilder.CreateCylinder("centralPlaza", {
      diameter: 210,
      height: 0.65,
      tessellation: 64
    }, scene);
    plaza.position.y = 0.22;
    plaza.material = concreteLightMat;
    plaza.parent = root;

    // fountain / reflecting pool
    const pool = BABYLON.MeshBuilder.CreateCylinder("reflectingPool", {
      diameter: 68,
      height: 0.65,
      tessellation: 64
    }, scene);
    pool.position.y = 0.46;
    pool.material = waterMat;
    pool.parent = root;

    const fountainCore = BABYLON.MeshBuilder.CreateCylinder("fountainCore", {
      diameter: 8,
      height: 2.8,
      tessellation: 24
    }, scene);
    fountainCore.position.y = 1.7;
    fountainCore.material = concreteMat;
    fountainCore.parent = root;

    // cross-boulevard system
    createRoad(root, 0, 0, 24, 760, 0);
    createRoad(root, 0, 0, 760, 24, 0);
    createRoad(root, -175, 0, 18, 520, 0);
    createRoad(root, 175, 0, 18, 520, 0);
    createRoad(root, 0, -175, 520, 18, 0);
    createRoad(root, 0, 175, 520, 18, 0);

    populateRoadLamps(root, "z", -355, 355, 0, 44);
    populateRoadLamps(root, "x", -355, 355, 0, 44);

    // central offices — purposely symmetrical but not identical
    createOfficeTower(root, -76, -76, 42, 88, 38, 0);
    createOfficeTower(root, 76, -76, 42, 96, 38, 1);
    createOfficeTower(root, -76, 76, 44, 76, 40, 2);
    createOfficeTower(root, 76, 76, 44, 82, 40, 3);

    // taller skyline ring
    const sky = [
      [-210, -160, 38, 142, 34, 0],
      [210, -155, 42, 168, 38, 1],
      [-220, 150, 44, 158, 40, 2],
      [215, 160, 38, 136, 36, 3],
      [-140, -245, 35, 118, 34, 4],
      [145, -245, 41, 150, 36, 5],
      [-145, 245, 40, 126, 36, 6],
      [145, 245, 42, 156, 38, 7]
    ];
    sky.forEach(args => createGlassSkyscraper(root, ...args));

    // civic center — large horizontal office complex
    const civic = new BABYLON.TransformNode("CentralAdministration", scene);
    civic.parent = root;
    civic.position.set(0, 0, -310);
    const civicBase = BABYLON.MeshBuilder.CreateBox("centralOfficeBase", {
      width: 150,
      height: 18,
      depth: 58
    }, scene);
    civicBase.position.y = 9;
    civicBase.material = buildingWallMaterial();
    civicBase.parent = civic;
    shadowGenerator.addShadowCaster(civicBase);
    const civicGlass = BABYLON.MeshBuilder.CreateBox("centralOfficeGlass", {
      width: 116,
      height: 12,
      depth: 0.25
    }, scene);
    civicGlass.position.set(0, 10.5, -29.15);
    civicGlass.material = buildingGlassMaterial();
    civicGlass.parent = civic;
    for (let x = -50; x <= 50; x += 10) {
      const rib = BABYLON.MeshBuilder.CreateBox("centralOfficeRib", {
        width: 0.55,
        height: 13,
        depth: 0.45
      }, scene);
      rib.position.set(x, 10.5, -29.4);
      rib.material = darkMat;
      rib.parent = civic;
    }
    const civicSign = BABYLON.MeshBuilder.CreateBox("centralOfficeSign", {
      width: 54,
      height: 2.1,
      depth: 0.55
    }, scene);
    civicSign.position.set(0, 22, -29.6);
    civicSign.material = lampGlowMat;
    civicSign.parent = civic;

    // landscaped park belts
    for (let i = 0; i < 90; i++) {
      const angle = seeded(90, 5, i) * Math.PI * 2;
      const rr = 118 + seeded(90, 7, i) * 210;
      const x = Math.cos(angle) * rr;
      const z = Math.sin(angle) * rr;
      if (Math.abs(x) < 26 || Math.abs(z) < 26) continue;
      createTree(root, x, z, 0.72 + seeded(90, 9, i) * 0.45, i % 5 === 0 ? 1 : 0);
    }

    // distant natural mountain belt, outside the neutral development
    createMountainRange(root, -360, -350, 5, 70, 120, 17);
    createMountainRange(root, 320, -390, 4, 76, 130, 29);
    createMountainRange(root, -390, 320, 4, 68, 108, 41);
    createMountainRange(root, 350, 340, 5, 62, 98, 53);

    camera.target.set(0, 22, -15);
    camera.alpha = -Math.PI / 2.2;
    camera.beta = 1.01;
    camera.radius = 300;

    state.activeTerritory = null;
    state.selectedTerritory = null;
    setMode("HUB");
    setStatus("Neutral Central Hub • owned by no civilization • open the World Map to choose your first territory");
  }

  // ==========================================================
  // PROCEDURAL BIOMES / WORLD MAP
  // ==========================================================

  const BIOMES = {
    plains: { label: "Plains", color: "#7fa85a", accent: "#a9c97a" },
    forest: { label: "Forest", color: "#2f7140", accent: "#4b8d4e" },
    mountain: { label: "Highlands", color: "#6d7275", accent: "#969a9d" },
    desert: { label: "Drylands", color: "#c4a45d", accent: "#d5bc7b" },
    coast: { label: "Coast", color: "#7dab86", accent: "#d6c98e" },
    wetland: { label: "Wetlands", color: "#4d8469", accent: "#6da28a" },
    tundra: { label: "Tundra", color: "#9eaaa0", accent: "#c7cfc8" }
  };

  function getBiome(x, y) {
    if (isCentralReserved(x, y)) return "plains";
    const nx = x / WORLD_COLS;
    const ny = y / WORLD_ROWS;
    const continental =
      Math.sin(nx * 9.2) * 0.28 +
      Math.cos(ny * 8.4) * 0.26 +
      Math.sin((nx + ny) * 13.0) * 0.18 +
      (hash2(x, y, 55) - 0.5) * 0.44;
    const humidity =
      Math.cos(nx * 13.4 + ny * 3.2) * 0.34 +
      (hash2(x, y, 77) - 0.5) * 0.66;
    const temp = 1 - Math.abs((y / (WORLD_ROWS - 1)) * 2 - 1);

    if (continental > 0.58) return "mountain";
    if (temp < 0.28 && continental > -0.12) return "tundra";
    if (continental < -0.42) return "coast";
    if (humidity > 0.42 && continental < 0.22) return "wetland";
    if (humidity > 0.10) return "forest";
    if (humidity < -0.38 && temp > 0.45) return "desert";
    return "plains";
  }

  // ==========================================================
  // 2D WORLD MAP UI
  // ==========================================================

  let mapOverlay = null;
  let mapCanvas = null;
  let mapCtx = null;
  let mapHover = null;
  let mapDragging = false;
  let mapDragStart = null;
  let mapViewStart = null;

  function ownerForTerritory(id) {
    return state.claimedTerritories.get(id) || null;
  }

  function syncClaimsFromMultiplayer(snapshot) {
    if (!snapshot) return;
    state.multiplayerState = snapshot;
    state.claimedTerritories.clear();
    (snapshot.territoryClaims || []).forEach(row => {
      state.claimedTerritories.set(row.territory_id, row);
    });
    if (mapOverlay && !mapOverlay.hidden) drawWorldMap();
    updateOnlineUI();
  }

  function createMapOverlay() {
    mapOverlay = document.createElement("section");
    mapOverlay.id = "mgWorldMapOverlay";
    mapOverlay.hidden = true;
    mapOverlay.innerHTML = `
      <div class="mg-map-shell">
        <header class="mg-map-header">
          <div>
            <div class="mg-kicker">STRATEGIC WORLD</div>
            <h2>Choose Your First Territory</h2>
            <p>Drag to explore • scroll to zoom • hover a chunk to inspect it.</p>
          </div>
          <div class="mg-map-header-actions">
            <button class="mg-btn mg-btn-secondary" id="mgMapRecenter">RECENTER</button>
            <button class="mg-btn mg-btn-secondary" id="mgMapClose">RETURN TO HUB</button>
          </div>
        </header>
        <div class="mg-map-body">
          <div class="mg-map-stage">
            <canvas id="mgWorldMapCanvas"></canvas>
            <div class="mg-map-legend">
              <span><i class="legend-neutral"></i> Neutral Center</span>
              <span><i class="legend-open"></i> Unclaimed</span>
              <span><i class="legend-owned"></i> Claimed</span>
            </div>
          </div>
          <aside class="mg-territory-panel" id="mgTerritoryPanel">
            <div class="mg-kicker">TERRITORY INSPECTOR</div>
            <h3 id="mgTerritoryTitle">Hover over the map</h3>
            <p id="mgTerritoryBiome">Biome data will appear here.</p>
            <div class="mg-territory-stats" id="mgTerritoryStats"></div>
            <button class="mg-btn mg-btn-primary" id="mgClaimTerritory" disabled>SELECT A TERRITORY</button>
            <button class="mg-btn mg-btn-secondary" id="mgEnterTerritory" hidden>ENTER TERRITORY</button>
            <div class="mg-panel-note">Only territory claiming and capital placement are enabled in this alpha. Building, clearing, defense and attacks remain locked.</div>
          </aside>
        </div>
      </div>`;
    document.body.appendChild(mapOverlay);

    mapCanvas = mapOverlay.querySelector("#mgWorldMapCanvas");
    mapCtx = mapCanvas.getContext("2d");

    mapOverlay.querySelector("#mgMapClose").onclick = () => {
      hideWorldMap();
      setMode(state.activeTerritory ? "TERRITORY" : "HUB");
    };
    mapOverlay.querySelector("#mgMapRecenter").onclick = () => {
      state.mapCamera.x = CENTRAL_X;
      state.mapCamera.y = CENTRAL_Y;
      state.mapCamera.zoom = 1;
      drawWorldMap();
    };

    mapOverlay.querySelector("#mgClaimTerritory").onclick = () => claimSelectedTerritory();
    mapOverlay.querySelector("#mgEnterTerritory").onclick = () => {
      if (state.selectedTerritory) {
        hideWorldMap();
        enterTerritory(state.selectedTerritory);
      }
    };

    mapCanvas.addEventListener("pointerdown", e => {
      mapDragging = true;
      mapDragStart = { x: e.clientX, y: e.clientY };
      mapViewStart = { x: state.mapCamera.x, y: state.mapCamera.y };
      mapCanvas.setPointerCapture?.(e.pointerId);
    });
    mapCanvas.addEventListener("pointermove", e => {
      if (mapDragging) {
        const cell = 42 * state.mapCamera.zoom;
        state.mapCamera.x = mapViewStart.x - (e.clientX - mapDragStart.x) / cell;
        state.mapCamera.y = mapViewStart.y - (e.clientY - mapDragStart.y) / cell;
        state.mapCamera.x = clamp(state.mapCamera.x, 0, WORLD_COLS - 1);
        state.mapCamera.y = clamp(state.mapCamera.y, 0, WORLD_ROWS - 1);
        drawWorldMap();
      } else {
        updateMapHover(e);
      }
    });
    mapCanvas.addEventListener("pointerup", e => {
      const dragged = mapDragStart && Math.hypot(e.clientX - mapDragStart.x, e.clientY - mapDragStart.y) > 6;
      mapDragging = false;
      if (!dragged) selectMapCell(e);
    });
    mapCanvas.addEventListener("pointerleave", () => {
      mapDragging = false;
      mapHover = null;
      drawWorldMap();
    });
    mapCanvas.addEventListener("wheel", e => {
      e.preventDefault();
      state.mapCamera.zoom = clamp(state.mapCamera.zoom * (e.deltaY > 0 ? 0.88 : 1.14), 0.58, 2.35);
      drawWorldMap();
    }, { passive: false });

    window.addEventListener("resize", resizeWorldMapCanvas);
  }

  function resizeWorldMapCanvas() {
    if (!mapCanvas) return;
    const r = mapCanvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mapCanvas.width = Math.max(1, Math.floor(r.width * dpr));
    mapCanvas.height = Math.max(1, Math.floor(r.height * dpr));
    mapCanvas.style.width = `${r.width}px`;
    mapCanvas.style.height = `${r.height}px`;
    mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorldMap();
  }

  function cellFromPointer(e) {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cell = 42 * state.mapCamera.zoom;
    const centerPxX = rect.width / 2;
    const centerPxY = rect.height / 2;
    const x = Math.floor(state.mapCamera.x + (mx - centerPxX) / cell + 0.5);
    const y = Math.floor(state.mapCamera.y + (my - centerPxY) / cell + 0.5);
    if (x < 0 || y < 0 || x >= WORLD_COLS || y >= WORLD_ROWS) return null;
    return { x, y, id: territoryId(x, y) };
  }

  function updateMapHover(e) {
    mapHover = cellFromPointer(e);
    drawWorldMap();
    updateTerritoryInspector(mapHover || state.selectedTerritory);
  }

  function selectMapCell(e) {
    const cell = cellFromPointer(e);
    if (!cell) return;
    state.selectedTerritory = cell;
    updateTerritoryInspector(cell);
    drawWorldMap();
  }

  function drawBiomeMapDetail(ctx, biome, x, y, px, py, cell) {
    const regular = state.graphics === "REGULAR";
    const count = regular ? 4 : 2;

    ctx.save();
    ctx.globalAlpha = regular ? 0.34 : 0.26;
    ctx.lineWidth = Math.max(1, cell * 0.025);

    if (biome === "forest") {
      ctx.fillStyle = "rgba(15,63,35,.72)";
      for (let i = 0; i < count + 1; i++) {
        const cx = px + 7 + seeded(x, y, 80 + i * 2) * Math.max(4, cell - 14);
        const cy = py + 7 + seeded(x, y, 81 + i * 2) * Math.max(4, cell - 14);
        const rr = Math.max(1.6, cell * (0.045 + seeded(x, y, 96 + i) * 0.035));
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (biome === "mountain") {
      ctx.strokeStyle = "rgba(235,241,244,.62)";
      for (let i = 0; i < count; i++) {
        const cx = px + cell * (0.28 + seeded(x, y, 120 + i) * 0.44);
        const cy = py + cell * (0.30 + seeded(x, y, 130 + i) * 0.42);
        const s = Math.max(3, cell * 0.11);
        ctx.beginPath();
        ctx.moveTo(cx - s, cy + s * 0.7);
        ctx.lineTo(cx, cy - s);
        ctx.lineTo(cx + s, cy + s * 0.7);
        ctx.stroke();
      }
    } else if (biome === "desert") {
      ctx.strokeStyle = "rgba(91,67,27,.48)";
      for (let i = 0; i < count; i++) {
        const yy = py + cell * (0.32 + i * 0.20);
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.17, yy);
        ctx.quadraticCurveTo(px + cell * 0.50, yy - cell * 0.10, px + cell * 0.83, yy);
        ctx.stroke();
      }
    } else if (biome === "coast") {
      ctx.strokeStyle = "rgba(220,239,239,.60)";
      for (let i = 0; i < count; i++) {
        const yy = py + cell * (0.35 + i * 0.20);
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.18, yy);
        ctx.quadraticCurveTo(px + cell * 0.34, yy - 3, px + cell * 0.50, yy);
        ctx.quadraticCurveTo(px + cell * 0.66, yy + 3, px + cell * 0.82, yy);
        ctx.stroke();
      }
    } else if (biome === "wetland") {
      ctx.strokeStyle = "rgba(166,218,206,.62)";
      for (let i = 0; i < count; i++) {
        const xx = px + cell * (0.28 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(xx, py + cell * 0.18);
        ctx.bezierCurveTo(
          xx - cell * 0.09, py + cell * 0.38,
          xx + cell * 0.09, py + cell * 0.58,
          xx, py + cell * 0.82
        );
        ctx.stroke();
      }
    } else if (biome === "tundra") {
      ctx.fillStyle = "rgba(242,248,250,.62)";
      for (let i = 0; i < count + 1; i++) {
        const xx = px + cell * (0.18 + seeded(x, y, 160 + i) * 0.64);
        const yy = py + cell * (0.18 + seeded(x, y, 170 + i) * 0.64);
        const s = Math.max(1.3, cell * 0.045);
        ctx.fillRect(xx - s / 2, yy - s / 2, s, s);
      }
    } else {
      // plains: faint field bands
      ctx.strokeStyle = "rgba(229,238,174,.42)";
      for (let i = 0; i < count; i++) {
        const yy = py + cell * (0.34 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.15, yy);
        ctx.lineTo(px + cell * 0.85, yy + (i % 2 ? 2 : -2));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawWorldMap() {
    if (!mapCtx || !mapCanvas) return;
    const rect = mapCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    mapCtx.clearRect(0, 0, w, h);

    const bg = mapCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#092038");
    bg.addColorStop(1, "#06121e");
    mapCtx.fillStyle = bg;
    mapCtx.fillRect(0, 0, w, h);

    const cell = 42 * state.mapCamera.zoom;
    const minX = Math.max(0, Math.floor(state.mapCamera.x - w / cell / 2) - 2);
    const maxX = Math.min(WORLD_COLS - 1, Math.ceil(state.mapCamera.x + w / cell / 2) + 2);
    const minY = Math.max(0, Math.floor(state.mapCamera.y - h / cell / 2) - 2);
    const maxY = Math.min(WORLD_ROWS - 1, Math.ceil(state.mapCamera.y + h / cell / 2) + 2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = w / 2 + (x - state.mapCamera.x) * cell - cell / 2;
        const py = h / 2 + (y - state.mapCamera.y) * cell - cell / 2;
        const id = territoryId(x, y);
        const biome = getBiome(x, y);
        const info = BIOMES[biome];
        const owner = ownerForTerritory(id);
        const reserved = isCentralReserved(x, y);

        mapCtx.fillStyle = reserved ? "#25364a" : info.color;
        mapCtx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

        // Biome-specific strategic-map symbols. The claim grid remains
        // readable, but the world now resembles terrain rather than a
        // spreadsheet of flat colors.
        drawBiomeMapDetail(mapCtx, biome, x, y, px, py, cell);

        if (owner) {
          mapCtx.fillStyle = "rgba(25,58,85,0.46)";
          mapCtx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
          mapCtx.strokeStyle = owner.owner_id === state.multiplayerState?.user?.id ? "#51e3a7" : "#78bfff";
          mapCtx.lineWidth = 2.2;
          mapCtx.strokeRect(px + 2.5, py + 2.5, cell - 5, cell - 5);
        }

        if (reserved) {
          mapCtx.fillStyle = "rgba(4,13,22,0.32)";
          mapCtx.fillRect(px, py, cell, cell);
          mapCtx.strokeStyle = "rgba(105,220,255,0.38)";
          mapCtx.lineWidth = 1;
          mapCtx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
        }

        const isHover = mapHover && mapHover.x === x && mapHover.y === y;
        const isSelected = state.selectedTerritory && state.selectedTerritory.x === x && state.selectedTerritory.y === y;
        if (isHover || isSelected) {
          mapCtx.strokeStyle = isSelected ? "#ffffff" : "#9ae9ff";
          mapCtx.lineWidth = isSelected ? 3.5 : 2.2;
          mapCtx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
        }
      }
    }

    // neutral center marker
    const cpx = w / 2 + (CENTRAL_X - state.mapCamera.x) * cell;
    const cpy = h / 2 + (CENTRAL_Y - state.mapCamera.y) * cell;
    mapCtx.beginPath();
    mapCtx.arc(cpx, cpy, Math.max(7, cell * 0.22), 0, Math.PI * 2);
    mapCtx.fillStyle = "#8be8ff";
    mapCtx.fill();
    mapCtx.strokeStyle = "rgba(255,255,255,.9)";
    mapCtx.lineWidth = 2;
    mapCtx.stroke();
  }

  function updateTerritoryInspector(cell) {
    const title = document.getElementById("mgTerritoryTitle");
    const biomeEl = document.getElementById("mgTerritoryBiome");
    const stats = document.getElementById("mgTerritoryStats");
    const claim = document.getElementById("mgClaimTerritory");
    const enter = document.getElementById("mgEnterTerritory");
    if (!title || !cell) {
      if (title) title.textContent = "Hover over the map";
      return;
    }

    const id = cell.id || territoryId(cell.x, cell.y);
    const biome = getBiome(cell.x, cell.y);
    const owner = ownerForTerritory(id);
    const reserved = isCentralReserved(cell.x, cell.y);
    title.textContent = reserved ? "Neutral Central District" : `Territory ${cell.x}-${cell.y}`;
    biomeEl.textContent = `${BIOMES[biome].label} • ${CHUNK_WORLD_SIZE} × ${CHUNK_WORLD_SIZE} world units`;
    stats.innerHTML = `
      <div><span>Terrain</span><b>${BIOMES[biome].label}</b></div>
      <div><span>Status</span><b>${reserved ? "Protected neutral zone" : owner ? "Claimed" : "Available"}</b></div>
      <div><span>Owner</span><b>${reserved ? "No civilization" : owner ? escapeHtml(owner.owner_username || "Player") : "Unclaimed"}</b></div>`;

    claim.hidden = false;
    enter.hidden = true;
    if (reserved) {
      claim.disabled = true;
      claim.textContent = "NEUTRAL — CANNOT CLAIM";
    } else if (owner) {
      const mine = state.worldType === "singleplayer" || owner.owner_id === state.multiplayerState?.user?.id;
      claim.disabled = true;
      claim.textContent = mine ? "YOUR TERRITORY" : "ALREADY CLAIMED";
      enter.hidden = !mine;
      if (mine) enter.hidden = false;
    } else {
      const myStart = getMyStartingTerritory();
      if (myStart) {
        claim.disabled = true;
        claim.textContent = "EXPANSION LOCKED";
        claim.title = "You already have your free starting territory. Expansion comes later.";
      } else {
        claim.disabled = false;
        claim.textContent = "CLAIM THIS TERRITORY";
        claim.title = "Claim your one free starting territory.";
      }
    }
  }

  function showWorldMap() {
    if (!mapOverlay) createMapOverlay();
    mapOverlay.hidden = false;
    setMode("MAP");
    setTimeout(() => {
      resizeWorldMapCanvas();
      updateTerritoryInspector(state.selectedTerritory);
    }, 0);
  }

  function hideWorldMap() {
    if (mapOverlay) mapOverlay.hidden = true;
  }

  function getMyStartingTerritory() {
    if (state.worldType === "central") {
      const direct = window.mapGameMultiplayer?.getMyTerritories?.() || [];
      if (direct.length) return direct[0];

      const uid = state.multiplayerState?.user?.id;
      if (!uid) return null;
      return Array.from(state.claimedTerritories.values())
        .find(row => row && row.owner_id === uid) || null;
    }

    return Array.from(state.claimedTerritories.values())
      .find(row => row && row.localOwner) || null;
  }

  async function claimSelectedTerritory() {
    const cell = state.selectedTerritory;
    if (!cell || isCentralReserved(cell.x, cell.y)) return;

    const id = cell.id || territoryId(cell.x, cell.y);
    if (ownerForTerritory(id)) return;

    // Alpha 0.2.1 rule:
    // every player receives ONE free starting territory.
    // Additional expansion is intentionally locked until the expansion
    // economy/government system exists.
    const existing = getMyStartingTerritory();
    if (existing) {
      const existingId = existing.territory_id || existing.id || "your first territory";
      showToast(
        `You already claimed ${existingId}. Additional territory expansion is coming later.`,
        "info"
      );
      return;
    }

    try {
      if (state.worldType === "central") {
        if (!window.mapGameMultiplayer?.claimTerritory) {
          throw new Error("Multiplayer is not ready.");
        }

        const row = await window.mapGameMultiplayer.claimTerritory(id);
        state.claimedTerritories.set(id, row);
      } else {
        state.claimedTerritories.set(id, {
          territory_id: id,
          owner_id: "local",
          owner_username: "You",
          localOwner: true
        });
        saveLocalState();
      }

      updateTerritoryInspector(cell);
      drawWorldMap();
      showToast(
        "Starting territory claimed. Enter it to choose your capital site.",
        "success"
      );
    } catch (error) {
      showToast(error?.message || "Could not claim territory.", "error");
    }
  }

  // ==========================================================
  // TERRITORY WORLD GENERATOR
  // ==========================================================

  let territoryGround = null;

  function clearWorldRoots() {
    disposeNode(state.hubRoot);
    disposeNode(state.terrainRoot);
    state.hubRoot = null;
    state.terrainRoot = null;
    territoryGround = null;
    if (state.capitalGhost) {
      disposeNode(state.capitalGhost);
      state.capitalGhost = null;
    }
  }

  function territoryHeightFn(x, z, biome, sx, sy) {
    const large =
      Math.sin((x + sx * 31) * 0.0062) * 7.5 +
      Math.cos((z - sy * 27) * 0.0054) * 6.2 +
      Math.sin((x + z) * 0.0033) * 4.4;
    const medium =
      Math.sin(x * 0.017 + sy) * 2.3 +
      Math.cos(z * 0.014 - sx) * 2.1;

    if (biome === "mountain") {
      return large * 1.25 + medium + Math.max(0, Math.sin((x - 150) * 0.008) * 22);
    }
    if (biome === "coast") {
      return large * 0.35 + medium * 0.25 - Math.max(0, (z - 300) * 0.06);
    }
    if (biome === "wetland") return large * 0.22 + medium * 0.20;
    if (biome === "desert") return large * 0.52 + medium * 0.55;
    if (biome === "tundra") return large * 0.65 + medium * 0.48;
    if (biome === "forest") return large * 0.58 + medium * 0.50;
    return large * 0.42 + medium * 0.42;
  }

  function createTerritoryGround(root, cell, biome) {
    const sub = state.graphics === "REGULAR" ? 100 : 72;
    const ground = BABYLON.MeshBuilder.CreateGround("territoryGround", {
      width: CHUNK_WORLD_SIZE,
      height: CHUNK_WORLD_SIZE,
      subdivisions: sub,
      updatable: true
    }, scene);
    ground.parent = root;
    ground.material = biome === "desert" ? sandMat : biome === "mountain" ? grassLightMat : grassMat;
    ground.receiveShadows = true;
    ground.metadata = { territoryGround: true };

    // Deep terrain base under every territory. This gives the region
    // visual thickness and guarantees a non-sky fallback below valleys.
    const territoryBase = BABYLON.MeshBuilder.CreateBox("territoryTerrainBase", {
      width: CHUNK_WORLD_SIZE + 22,
      height: 22,
      depth: CHUNK_WORLD_SIZE + 22
    }, scene);
    territoryBase.position.y = -15;
    territoryBase.material = terrainBaseMat;
    territoryBase.receiveShadows = true;
    territoryBase.parent = root;
    territoryBase.isPickable = false;

    const p = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i];
      const z = p[i + 2];
      let y = territoryHeightFn(x, z, biome, cell.x, cell.y);

      // Keep a broad safer central basin but do not make the entire map flat.
      const dist = Math.hypot(x, z);
      if (dist < 165) {
        const flatten = 1 - clamp((165 - dist) / 130, 0, 0.82);
        y *= flatten;
      }
      p[i + 1] = y;
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, p);
    const normals = [];
    BABYLON.VertexData.ComputeNormals(p, ground.getIndices(), normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    ground.refreshBoundingInfo();
    return ground;
  }

  function placeTerritoryVegetation(root, cell, biome) {
    const treeCount = biome === "forest" ? 190 : biome === "plains" ? 95 : biome === "wetland" ? 120 : biome === "tundra" ? 42 : biome === "desert" ? 10 : 56;
    for (let i = 0; i < treeCount; i++) {
      const x = seeded(cell.x, cell.y, i * 3 + 1) * 860 - 430;
      const z = seeded(cell.x, cell.y, i * 3 + 2) * 860 - 430;
      // keep the very center more open so a new player can identify a safe capital area
      if (Math.hypot(x, z) < 105) continue;
      if (biome === "desert" && i % 4 !== 0) continue;
      const tree = createTree(root, x, z, 0.75 + seeded(cell.x, cell.y, i + 600) * 0.65, biome === "tundra" || i % 5 === 0 ? 1 : 0);
      const h = territoryHeightFn(x, z, biome, cell.x, cell.y);
      tree.position.y = h;
    }
  }

  function placeTerritoryMountains(root, cell, biome) {
    if (biome === "mountain") {
      createMountainRange(root, -330, -260, 5, 68, 122, cell.x * 19 + cell.y * 7 + 5);
      createMountainRange(root, 300, 260, 4, 72, 112, cell.x * 23 + cell.y * 11 + 17);
      createMountainRange(root, 330, -300, 3, 58, 88, cell.x * 29 + cell.y * 13 + 31);
    } else {
      createMountainRange(root, -400, -360, 3, 54, 75, cell.x * 17 + cell.y * 19 + 9);
      if (biome !== "wetland" && biome !== "coast") {
        createMountainRange(root, 390, 340, 2, 50, 68, cell.x * 31 + cell.y * 5 + 12);
      }
    }
  }

  function addCoast(root, cell, biome) {
    if (biome !== "coast" && biome !== "wetland") return;
    const water = BABYLON.MeshBuilder.CreateGround("territoryWater", {
      width: CHUNK_WORLD_SIZE,
      height: biome === "coast" ? 280 : 190,
      subdivisions: 1
    }, scene);
    water.position.set(0, -4.5, 395);
    water.material = waterMat;
    water.parent = root;
    water.isPickable = false;
  }

  function enterTerritory(cell) {
    clearWorldRoots();
    const biome = getBiome(cell.x, cell.y);
    const root = new BABYLON.TransformNode(`Territory_${cell.x}_${cell.y}`, scene);
    state.terrainRoot = root;
    state.activeTerritory = { ...cell, id: cell.id || territoryId(cell.x, cell.y), biome };

    territoryGround = createTerritoryGround(root, cell, biome);
    placeTerritoryVegetation(root, cell, biome);
    placeTerritoryMountains(root, cell, biome);
    addCoast(root, cell, biome);

    // subtle chunk boundary markers, visible but not walls
    const boundaryMat = new BABYLON.StandardMaterial("boundaryMat", scene);
    boundaryMat.diffuseColor = new BABYLON.Color3(0.2, 0.72, 0.96);
    boundaryMat.emissiveColor = new BABYLON.Color3(0.04, 0.18, 0.28);
    boundaryMat.alpha = 0.28;
    const half = CHUNK_WORLD_SIZE / 2 - 3;
    [[0, -half, CHUNK_WORLD_SIZE, 2], [0, half, CHUNK_WORLD_SIZE, 2], [-half, 0, 2, CHUNK_WORLD_SIZE], [half, 0, 2, CHUNK_WORLD_SIZE]].forEach(([x,z,w,d]) => {
      const edge = BABYLON.MeshBuilder.CreateBox("territoryBoundary", { width:w, depth:d, height:0.5 }, scene);
      edge.position.set(x, 1.0, z);
      edge.material = boundaryMat;
      edge.parent = root;
      edge.isPickable = false;
    });

    // Enter the territory closer to the surface so a 980x980 region
    // feels large instead of looking like a miniature board.
    camera.target.set(0, 10, -24);
    camera.radius = 225;
    camera.alpha = -Math.PI / 2.25;
    camera.beta = 1.04;
    setMode("TERRITORY");

    const existingCapital = getCapitalForActiveTerritory();
    if (existingCapital) {
      state.capital = existingCapital;
      renderCapital(existingCapital, true);
      setStatus(`<b>${escapeHtml(existingCapital.name || "Capital")}</b> • ${BIOMES[biome].label} territory • development systems are locked in this alpha`);
    } else {
      setStatus(`${BIOMES[biome].label} territory • choose a stable capital site; the center is usually safest`);
      setTimeout(() => beginCapitalPlacement(), 550);
    }
  }

  function getCapitalForActiveTerritory() {
    if (!state.activeTerritory) return null;
    if (state.worldType === "central") {
      const capitals = state.multiplayerState?.capitals || [];
      return capitals.find(c => c.territory_id === state.activeTerritory.id) || null;
    }
    const saved = loadLocalState();
    return saved.capital && saved.capital.territoryId === state.activeTerritory.id ? saved.capital : null;
  }

  // ==========================================================
  // CAPITAL PLACEMENT — ONLY ACTIVE BUILD ACTION
  // ==========================================================

  function getGroundPointFromPointer(evt) {
    if (!territoryGround) return null;
    const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === territoryGround);
    if (!pick?.hit || !pick.pickedPoint) return null;
    return pick.pickedPoint.clone();
  }

  function isCapitalSiteSafe(x, z) {
    if (!state.activeTerritory) return false;
    const h = territoryHeightFn(x, z, state.activeTerritory.biome, state.activeTerritory.x, state.activeTerritory.y);
    const hx = territoryHeightFn(x + 18, z, state.activeTerritory.biome, state.activeTerritory.x, state.activeTerritory.y);
    const hz = territoryHeightFn(x, z + 18, state.activeTerritory.biome, state.activeTerritory.x, state.activeTerritory.y);
    const slope = Math.max(Math.abs(hx - h), Math.abs(hz - h));
    if (Math.abs(x) > 400 || Math.abs(z) > 400) return false;
    if (state.activeTerritory.biome === "coast" && z > 280) return false;
    return slope < 10.5;
  }

  function beginCapitalPlacement() {
    if (!state.activeTerritory || getCapitalForActiveTerritory()) return;
    setMode("CAPITAL_PLACEMENT");
    state.pendingCapitalXZ = null;
    showCapitalDialog();
    setStatus("Capital placement • click a suitable location in your territory • greener preview = safer site");
  }

  function makeCapitalGhost() {
    const root = new BABYLON.TransformNode("capitalGhost", scene);
    const mat = new BABYLON.StandardMaterial("capitalGhostMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.20, 0.95, 0.62);
    mat.emissiveColor = new BABYLON.Color3(0.06, 0.25, 0.15);
    mat.alpha = 0.42;
    const base = BABYLON.MeshBuilder.CreateBox("capitalGhostBase", { width: 78, depth: 62, height: 2 }, scene);
    base.position.y = 1;
    base.material = mat;
    base.parent = root;
    const hall = BABYLON.MeshBuilder.CreateBox("capitalGhostHall", { width: 42, depth: 30, height: 20 }, scene);
    hall.position.y = 11;
    hall.material = mat;
    hall.parent = root;
    root.setEnabled(false);
    root.metadata = { ghost: true, material: mat };
    return root;
  }

  scene.onPointerObservable.add(info => {
    if (state.mode !== "CAPITAL_PLACEMENT") return;
    if (info.type === BABYLON.PointerEventTypes.POINTERMOVE || info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      const p = getGroundPointFromPointer(info.event);
      if (!p) return;
      const safe = isCapitalSiteSafe(p.x, p.z);
      if (!state.capitalGhost) state.capitalGhost = makeCapitalGhost();
      state.capitalGhost.setEnabled(true);
      state.capitalGhost.position.set(p.x, p.y + 0.5, p.z);
      const gm = state.capitalGhost.metadata.material;
      gm.diffuseColor = safe ? new BABYLON.Color3(0.20,0.95,0.62) : new BABYLON.Color3(0.96,0.24,0.22);
      gm.emissiveColor = safe ? new BABYLON.Color3(0.06,0.25,0.15) : new BABYLON.Color3(0.25,0.04,0.03);
      if (info.type === BABYLON.PointerEventTypes.POINTERDOWN && safe) {
        state.pendingCapitalXZ = { x:p.x, y:p.y, z:p.z };
        updateCapitalDialog();
      }
    }
  });

  let capitalDialog = null;

  function showCapitalDialog() {
    if (!capitalDialog) {
      capitalDialog = document.createElement("div");
      capitalDialog.id = "mgCapitalDialog";
      capitalDialog.className = "mg-floating-panel mg-capital-dialog";
      capitalDialog.innerHTML = `
        <div class="mg-kicker">FOUNDING YOUR CIVILIZATION</div>
        <h3>Place the Capital</h3>
        <p>Your capital becomes the center of your first city. Flat inland terrain is safest; steep mountains and water are unavailable.</p>
        <label class="mg-field-label" for="mgCapitalName">CAPITAL NAME</label>
        <input id="mgCapitalName" class="mg-input" maxlength="32" value="Nova Capital" />
        <div id="mgCapitalCoords" class="mg-capital-coords">Click the terrain to choose a site.</div>
        <div class="mg-dialog-actions">
          <button class="mg-btn mg-btn-secondary" id="mgCapitalCancel">LATER</button>
          <button class="mg-btn mg-btn-primary" id="mgCapitalConfirm" disabled>ESTABLISH CAPITAL</button>
        </div>`;
      document.body.appendChild(capitalDialog);
      capitalDialog.querySelector("#mgCapitalCancel").onclick = () => {
        capitalDialog.hidden = true;
        state.pendingCapitalXZ = null;
        if (state.capitalGhost) state.capitalGhost.setEnabled(false);
        setMode("TERRITORY");
        setStatus("Territory view • Capital placement paused • click Capital in the left dock when ready");
      };
      capitalDialog.querySelector("#mgCapitalConfirm").onclick = establishCapitalFromDialog;
    }
    capitalDialog.hidden = false;
    updateCapitalDialog();
  }

  function updateCapitalDialog() {
    if (!capitalDialog) return;
    const coords = capitalDialog.querySelector("#mgCapitalCoords");
    const confirm = capitalDialog.querySelector("#mgCapitalConfirm");
    if (!state.pendingCapitalXZ) {
      coords.textContent = "Click the terrain to choose a site.";
      confirm.disabled = true;
    } else {
      coords.textContent = `Site selected • X ${Math.round(state.pendingCapitalXZ.x)} • Z ${Math.round(state.pendingCapitalXZ.z)}`;
      confirm.disabled = false;
    }
  }

  async function establishCapitalFromDialog() {
    if (!state.activeTerritory || !state.pendingCapitalXZ) return;
    const name = String(capitalDialog.querySelector("#mgCapitalName").value || "").trim();
    if (name.length < 2) {
      showToast("Capital name must be at least 2 characters.", "error");
      return;
    }
    const p = state.pendingCapitalXZ;
    try {
      let capital;
      if (state.worldType === "central") {
        capital = await window.mapGameMultiplayer.establishCapital({
          territoryId: state.activeTerritory.id,
          name,
          x: p.x,
          z: p.z
        });
      } else {
        capital = {
          territory_id: state.activeTerritory.id,
          territoryId: state.activeTerritory.id,
          name,
          x: p.x,
          z: p.z,
          owner_id: "local"
        };
        const save = loadLocalState();
        save.capital = capital;
        localStorage.setItem(localSaveKey, JSON.stringify(save));
      }
      state.capital = capital;
      if (state.capitalGhost) {
        disposeNode(state.capitalGhost);
        state.capitalGhost = null;
      }
      capitalDialog.hidden = true;
      renderCapital(capital, false);
      setMode("TERRITORY");
      setStatus(`<b>${escapeHtml(name)}</b> established • city development will unlock in the next construction update`);
      showToast(`${name} established.`, "success");
    } catch (error) {
      showToast(error?.message || "Could not establish capital.", "error");
    }
  }

  function removeVegetationNear(x, z, radius) {
    if (!state.terrainRoot) return;
    const children = state.terrainRoot.getChildren?.() || [];
    children.forEach(node => {
      if (!node?.metadata?.vegetation) return;
      const world = node.getAbsolutePosition ? node.getAbsolutePosition() : node.position;
      if (Math.hypot(world.x - x, world.z - z) <= radius) disposeNode(node);
    });
  }

  function renderCapital(capital, existing) {
    if (!state.terrainRoot || !state.activeTerritory) return;
    const x = Number(capital.x) || 0;
    const z = Number(capital.z) || 0;
    const y = territoryHeightFn(x, z, state.activeTerritory.biome, state.activeTerritory.x, state.activeTerritory.y);

    // Capital placement automatically clears a civic footprint for now.
    // Manual clearing remains disabled until the next system update.
    removeVegetationNear(x, z, 95);

    const root = new BABYLON.TransformNode("playerCapital", scene);
    root.parent = state.terrainRoot;
    root.position.set(x, y, z);
    root.metadata = { playerCapital: true };

    const plaza = BABYLON.MeshBuilder.CreateCylinder("capitalPlaza", {
      diameter: 104,
      height: 0.55,
      tessellation: 48
    }, scene);
    plaza.position.y = 0.30;
    plaza.material = concreteLightMat;
    plaza.parent = root;

    const hall = BABYLON.MeshBuilder.CreateBox("capitalHall", {
      width: 54,
      height: 22,
      depth: 34
    }, scene);
    hall.position.y = 11.3;
    hall.material = buildingWallMaterial();
    hall.parent = root;
    shadowGenerator.addShadowCaster(hall);

    const glass = BABYLON.MeshBuilder.CreateBox("capitalHallGlass", {
      width: 36,
      height: 13,
      depth: 0.24
    }, scene);
    glass.position.set(0, 11.8, -17.15);
    glass.material = buildingGlassMaterial();
    glass.parent = root;

    for (let xR = -15; xR <= 15; xR += 6) {
      const rib = BABYLON.MeshBuilder.CreateBox("capitalRib", {
        width: 0.36,
        height: 14,
        depth: 0.3
      }, scene);
      rib.position.set(xR, 11.8, -17.35);
      rib.material = darkMat;
      rib.parent = root;
    }

    const crown = BABYLON.MeshBuilder.CreateBox("capitalCrown", {
      width: 38,
      height: 3.0,
      depth: 24
    }, scene);
    crown.position.y = 24.0;
    crown.material = darkMat;
    crown.parent = root;

    // short ceremonial access road only; not a player road-building tool
    createRoad(root, 0, 85, 20, 118, 0);
    populateRoadLamps(root, "z", 36, 132, 0, 34);

    // future zoning rings / previews are intentionally NOT created.
    if (!existing) {
      camera.target.set(x, y + 10, z);
      camera.radius = 180;
    }
  }

  // ==========================================================
  // LOCAL SAVE
  // ==========================================================

  function loadLocalState() {
    try {
      return JSON.parse(localStorage.getItem(localSaveKey) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function saveLocalState() {
    const old = loadLocalState();
    old.claims = Array.from(state.claimedTerritories.values()).filter(v => v.localOwner);
    localStorage.setItem(localSaveKey, JSON.stringify(old));
  }

  function restoreLocalClaims() {
    const save = loadLocalState();
    (save.claims || []).forEach(row => state.claimedTerritories.set(row.territory_id, row));
  }

  // ==========================================================
  // MAIN HUD
  // ==========================================================

  let hudRoot = null;

  function buildHUD() {
    hudRoot = document.createElement("div");
    hudRoot.id = "mgHUD";
    hudRoot.innerHTML = `
      <header class="mg-topbar">
        <div class="mg-brand-lockup">
          <div class="mg-brand-mark">M</div>
          <div><strong>MAP GAME</strong><span>ALPHA ${VERSION} • WORLD & INTERFACE FOUNDATION</span></div>
        </div>
        <div class="mg-top-status">
          <div class="mg-status-chip"><span>WORLD</span><b id="mgWorldLabel">SINGLEPLAYER</b></div>
          <div class="mg-status-chip"><span>ONLINE</span><b id="mgOnlineCount">—</b></div>
          <div class="mg-status-chip"><span>TIME</span><b id="mgTime">12:30 PM</b></div>
          <button class="mg-graphics-toggle" id="mgGraphicsToggle">GRAPHICS • ${state.graphics}</button>
        </div>
      </header>

      <nav class="mg-dock" id="mgDock">
        <button data-action="hub" title="Neutral Central Hub">⌂<span>HUB</span></button>
        <button data-action="map" title="World Map">◈<span>WORLD</span></button>
        <button data-action="capital" title="Capital">◆<span>CAPITAL</span></button>
        <button data-action="development" class="locked" title="Development — coming soon">▦<span>BUILD</span></button>
        <button data-action="defense" class="locked" title="Defense — coming soon">⬡<span>DEFENSE</span></button>
      </nav>

      <div class="mg-location-pill" id="mgLocationPill">NEUTRAL CENTRAL HUB • PROTECTED</div>

      <div class="mg-bottom-status"><span id="mgBottomStatusText">Welcome to Map Game.</span></div>
    `;
    document.body.appendChild(hudRoot);

    hudRoot.querySelector("[data-action='hub']").onclick = () => {
      hideWorldMap();
      buildNeutralHub();
    };
    hudRoot.querySelector("[data-action='map']").onclick = showWorldMap;
    hudRoot.querySelector("[data-action='capital']").onclick = () => {
      if (!state.activeTerritory) {
        showToast("Claim and enter a territory first.", "info");
        return;
      }
      if (getCapitalForActiveTerritory()) {
        showToast("Your capital is already established in this alpha.", "info");
        return;
      }
      beginCapitalPlacement();
    };
    hudRoot.querySelector("[data-action='development']").onclick = () => showToast("Development, zones, factories and power are the next major system.", "info");
    hudRoot.querySelector("[data-action='defense']").onclick = () => showToast("Defense, walls and military are intentionally locked for now.", "info");
    hudRoot.querySelector("#mgGraphicsToggle").onclick = toggleGraphics;
  }

  function updateModeUI() {
    const pill = document.getElementById("mgLocationPill");
    if (!pill) return;

    if (state.mode === "HUB") {
      pill.textContent = "NEUTRAL CENTRAL HUB • PROTECTED • NO OWNER";
    } else if (state.mode === "MAP") {
      pill.textContent = getMyStartingTerritory()
        ? "STRATEGIC WORLD • EXPANSION LOCKED"
        : "STRATEGIC WORLD • CHOOSE YOUR FREE STARTING TERRITORY";
    } else if (state.activeTerritory) {
      pill.textContent =
        `TERRITORY ${state.activeTerritory.x}-${state.activeTerritory.y} • ` +
        `${BIOMES[state.activeTerritory.biome].label.toUpperCase()}`;
    }

    const dock = document.getElementById("mgDock");
    if (!dock) return;
    dock.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));

    if (state.mode === "HUB") {
      dock.querySelector("[data-action='hub']")?.classList.add("active");
    } else if (state.mode === "MAP") {
      dock.querySelector("[data-action='map']")?.classList.add("active");
    } else if (state.activeTerritory) {
      dock.querySelector("[data-action='capital']")?.classList.add("active");
    }
  }

  function updateOnlineUI() {
    const el = document.getElementById("mgOnlineCount");
    if (el) el.textContent = state.worldType === "central" ? String(state.multiplayerState?.onlineCount ?? 1) : "LOCAL";
    const world = document.getElementById("mgWorldLabel");
    if (world) world.textContent = state.worldType === "central" ? "CENTRAL WORLD" : "SINGLEPLAYER";
  }

  function toggleGraphics() {
    state.graphics = state.graphics === "BASIC" ? "REGULAR" : "BASIC";
    localStorage.setItem("mapgame_graphics", state.graphics);
    const btn = document.getElementById("mgGraphicsToggle");
    if (btn) btn.textContent = `GRAPHICS • ${state.graphics}`;

    if (state.graphics === "REGULAR") {
      engine.setHardwareScalingLevel(window.devicePixelRatio >= 2 ? 1.15 : 1.0);
      shadowGenerator.mapSize = 2048;
      scene.imageProcessingConfiguration.contrast = 1.12;
      scene.imageProcessingConfiguration.exposure = 1.06;
      glowLayer.intensity = 0.37;
    } else {
      engine.setHardwareScalingLevel(window.devicePixelRatio >= 2 ? 1.38 : 1.16);
      scene.imageProcessingConfiguration.contrast = 1.06;
      scene.imageProcessingConfiguration.exposure = 1.02;
      glowLayer.intensity = 0.28;
    }

    window.mapGameRuntime.graphicsPreset = state.graphics;
    window.dispatchEvent(new CustomEvent("mapgame:graphics", { detail: { preset: state.graphics } }));

    // Rebuild active view so architecture actually changes, not just the label.
    if (state.mode === "HUB") buildNeutralHub();
    else if (state.activeTerritory) enterTerritory(state.activeTerritory);
    showToast(`${state.graphics} graphics active.`, "success");
  }

  // ==========================================================
  // HOME / AUTH
  // ==========================================================

  let home = null;
  let authModal = null;

  function createHome() {
    home = document.createElement("div");
    home.id = "mgHome";
    home.innerHTML = `
      <div class="mg-home-backdrop"></div>
      <div class="mg-home-grid"></div>
      <main class="mg-home-shell">
        <section class="mg-home-hero">
          <div class="mg-home-kicker">MAP GAME • ALPHA ${VERSION}</div>
          <h1>Build a civilization<br><span>from one territory.</span></h1>
          <p>Start in a protected neutral metropolis, explore a huge strategic world, claim land, and establish your first capital.</p>
          <div class="mg-home-feature-row">
            <span>PROCEDURAL BIOMES</span><span>SHARED TERRITORIES</span><span>CAPITAL FOUNDING</span>
          </div>
        </section>
        <section class="mg-home-cards">
          <article class="mg-world-card mg-world-card-primary">
            <div class="mg-card-badge">OFFICIAL WORLD</div>
            <h2>Central World</h2>
            <p>Shared territory ownership and capitals. No attacks or construction beyond the capital yet.</p>
            <div id="mgAccountState" class="mg-account-state">Checking account…</div>
            <button class="mg-btn mg-btn-primary mg-btn-large" id="mgJoinCentral">JOIN CENTRAL WORLD</button>
          </article>
          <article class="mg-world-card">
            <div class="mg-card-badge muted">LOCAL</div>
            <h2>Singleplayer</h2>
            <p>Explore the same world flow locally while the larger civilization systems are being built.</p>
            <button class="mg-btn mg-btn-secondary mg-btn-large" id="mgStartSingle">START SINGLEPLAYER</button>
          </article>
        </section>
      </main>`;
    document.body.appendChild(home);

    home.querySelector("#mgStartSingle").onclick = () => startGame("singleplayer");
    home.querySelector("#mgJoinCentral").onclick = joinCentralFromHome;
    refreshHomeAccount();
  }

  async function refreshHomeAccount() {
    const status = document.getElementById("mgAccountState");
    const button = document.getElementById("mgJoinCentral");
    if (!status || !button) return;
    if (!window.mapGameAuth?.getCurrentUser) {
      status.textContent = "Account service not ready.";
      button.textContent = "TRY AGAIN";
      return;
    }
    try {
      const user = await window.mapGameAuth.getCurrentUser();
      if (!user) {
        status.innerHTML = `<b>Not signed in</b><span>An account is required for Central World.</span>`;
        button.textContent = "SIGN IN / CREATE ACCOUNT";
      } else if (!window.mapGameAuth.isVerified?.(user)) {
        status.innerHTML = `<b>${escapeHtml(user.email || "Account")}</b><span>Email verification required.</span>`;
        button.textContent = "VERIFY EMAIL";
      } else {
        status.innerHTML = `<b>${escapeHtml(user.email || "Verified player")}</b><span>Verified and ready.</span>`;
        button.textContent = "JOIN CENTRAL WORLD";
      }
    } catch (e) {
      status.textContent = e?.message || "Could not check account.";
    }
  }

  async function joinCentralFromHome() {
    try {
      const user = await window.mapGameAuth?.getCurrentUser?.();
      if (!user) {
        showAuthModal();
        return;
      }
      if (!window.mapGameAuth.isVerified?.(user)) {
        showToast("Verify your email, then return and try again.", "info");
        return;
      }
      const btn = document.getElementById("mgJoinCentral");
      if (btn) { btn.disabled = true; btn.textContent = "CONNECTING…"; }
      await window.mapGameMultiplayer.joinCentralWorld();
      state.worldType = "central";
      const snapshot = window.mapGameMultiplayer.getState();
      syncClaimsFromMultiplayer(snapshot);
      startGame("central");
    } catch (e) {
      showToast(e?.message || "Could not join Central World.", "error");
      const btn = document.getElementById("mgJoinCentral");
      if (btn) { btn.disabled = false; btn.textContent = "JOIN CENTRAL WORLD"; }
    }
  }

  function showAuthModal() {
    if (!authModal) {
      authModal = document.createElement("div");
      authModal.id = "mgAuthModal";
      authModal.className = "mg-modal-backdrop";
      authModal.innerHTML = `
        <div class="mg-auth-card">
          <button class="mg-modal-close" id="mgAuthClose">×</button>
          <div class="mg-kicker">CENTRAL WORLD ACCOUNT</div>
          <h2>Sign in or create an account</h2>
          <div class="mg-auth-tabs"><button class="active" data-tab="signin">SIGN IN</button><button data-tab="signup">CREATE</button></div>
          <label class="mg-field-label">EMAIL</label>
          <input class="mg-input" id="mgAuthEmail" type="email" autocomplete="email" />
          <label class="mg-field-label">PASSWORD</label>
          <input class="mg-input" id="mgAuthPassword" type="password" autocomplete="current-password" />
          <button class="mg-btn mg-btn-primary mg-btn-large" id="mgAuthSubmit">SIGN IN</button>
          <div class="mg-auth-message" id="mgAuthMessage"></div>
        </div>`;
      document.body.appendChild(authModal);
      let tab = "signin";
      authModal.querySelectorAll("[data-tab]").forEach(btn => btn.onclick = () => {
        tab = btn.dataset.tab;
        authModal.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === btn));
        authModal.querySelector("#mgAuthSubmit").textContent = tab === "signin" ? "SIGN IN" : "CREATE ACCOUNT";
      });
      authModal.querySelector("#mgAuthClose").onclick = () => authModal.hidden = true;
      authModal.querySelector("#mgAuthSubmit").onclick = async () => {
        const email = authModal.querySelector("#mgAuthEmail").value.trim();
        const password = authModal.querySelector("#mgAuthPassword").value;
        const msg = authModal.querySelector("#mgAuthMessage");
        try {
          if (tab === "signup") {
            await window.mapGameAuth.signUp(email, password);
            msg.textContent = "Account created. Check your email for the verification link; delivery can take a few minutes.";
          } else {
            await window.mapGameAuth.signIn(email, password);
            msg.textContent = "Signed in.";
            setTimeout(() => { authModal.hidden = true; refreshHomeAccount(); }, 450);
          }
        } catch (e) {
          msg.textContent = e?.message || "Account action failed.";
        }
      };
    }
    authModal.hidden = false;
  }

  function startGame(worldType) {
    state.worldType = worldType;
    if (worldType === "singleplayer") {
      state.claimedTerritories.clear();
      restoreLocalClaims();
    }
    if (home) home.remove();
    home = null;
    if (!hudRoot) buildHUD();
    updateOnlineUI();
    buildNeutralHub();
  }

  // ==========================================================
  // ESCAPE / NAVIGATION
  // ==========================================================

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (mapOverlay && !mapOverlay.hidden) {
        hideWorldMap();
        setMode(state.activeTerritory ? "TERRITORY" : "HUB");
      } else if (state.mode === "CAPITAL_PLACEMENT") {
        if (capitalDialog) capitalDialog.hidden = true;
        if (state.capitalGhost) state.capitalGhost.setEnabled(false);
        setMode("TERRITORY");
      }
    }
  });

  // ==========================================================
  // MULTIPLAYER STATE
  // ==========================================================

  if (window.mapGameMultiplayer?.onStateChange) {
    window.mapGameMultiplayer.onStateChange(snapshot => syncClaimsFromMultiplayer(snapshot));
  }

  // ==========================================================
  // RUNTIME EXPORT FOR terrain.js / materials.js
  // ==========================================================

  window.mapGameRuntime = {
    engine,
    scene,
    camera,
    sun,
    moon,
    hemi,
    shadowGenerator,
    glowLayer,
    ground: null,
    grassMaterial: grassMat,
    grassLightMaterial: grassLightMat,
    dirtMaterial: dirtMat,
    rockMaterial: rockMat,
    snowMaterial: snowMat,
    sandMaterial: sandMat,
    roadMaterial: roadMat,
    roadEdgeMaterial: roadEdgeMat,
    concreteMaterial: concreteMat,
    darkMaterial: darkMat,
    treeLeafMaterial: treeLeafMat,
    treeLeafAltMaterial: treeLeafAltMat,
    treeTrunkMaterial: treeTrunkMat,
    waterMaterial: waterMat,
    shallowOceanMaterial: waterMat,
    deepOceanMaterial: waterMat,
    glassMaterial: glassBasic,
    graphicsPreset: state.graphics,
    mapSize: CHUNK_WORLD_SIZE,
    worldBorderRadius: CHUNK_WORLD_SIZE / 2,
    playableLandRadius: CHUNK_WORLD_SIZE / 2 - 20,
    showToast,
    setBottomStatus: setStatus
  };

  // Keep runtime ground current whenever territory/hub changes.
  const groundWatcher = scene.onNewMeshAddedObservable.add(mesh => {
    if (mesh.name === "territoryGround" || mesh.name === "hubGround") {
      window.mapGameRuntime.ground = mesh;
    }
  });

  window.dispatchEvent(new CustomEvent("mapgame:runtime-ready", { detail: window.mapGameRuntime }));

  // ==========================================================
  // HELPERS
  // ==========================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ==========================================================
  // START
  // ==========================================================

  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = state.graphics === "REGULAR" ? 1.06 : 1.02;
  scene.imageProcessingConfiguration.contrast = state.graphics === "REGULAR" ? 1.12 : 1.06;

  if (state.graphics === "REGULAR") {
    engine.setHardwareScalingLevel(window.devicePixelRatio >= 2 ? 1.15 : 1.0);
  } else {
    engine.setHardwareScalingLevel(window.devicePixelRatio >= 2 ? 1.38 : 1.16);
  }

  createHome();

  const loading = document.getElementById("loadingScreen");
  if (loading) {
    loading.classList.add("loading-finish");
    setTimeout(() => loading.remove(), 420);
  }

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;
    updateDayNight(dt);
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("beforeunload", saveLocalState);

  console.log("Map Game Alpha 0.2.0 restructure loaded.");
})();
