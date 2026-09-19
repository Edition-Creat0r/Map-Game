// ============================================================
// MAP GAME — territory_stream.js
// Alpha 0.2.2B1 — TRUE TERRITORY SECTOR STREAMING
//
// Logical territory:
//   32,768 × 32,768
//
// Sector size:
//   512 × 512
//
// Render distance:
//   LOW    radius 2 = up to 5×5 = 25 sectors
//   MEDIUM radius 3 = up to 7×7 = 49 sectors
//   HIGH   radius 4 = up to 9×9 = 81 sectors
//
// IMPORTANT:
// The full territory is NEVER created as one Babylon mesh.
// Only sectors around the camera target exist as 3D meshes.
// ============================================================

(() => {
  "use strict";

  const CFG = window.mapGameWorldConfig || {};
  const TERRITORY_SIZE = Number(CFG.TERRITORY_SIZE || 32768);
  const SECTOR_SIZE = Number(CFG.SECTOR_SIZE || 512);

  const RADIUS = {
    low: 2,
    medium: 3,
    high: 4,
    ...(CFG.RENDER_DISTANCE_PRESETS || {})
  };

  let runtime = null;
  let active = null;
  let root = null;
  let observer = null;
  let updateTimer = 0;
  let generationQueue = [];
  let generating = false;

  const sectors = new Map();

  function sectorKey(sx, sz) {
    return `${sx},${sz}`;
  }

  function clampSector(v) {
    const side = Math.floor(TERRITORY_SIZE / SECTOR_SIZE);
    const min = -Math.floor(side / 2);
    const max = min + side - 1;
    return Math.max(min, Math.min(max, v));
  }

  function worldToSector(x, z) {
    return {
      sx: clampSector(Math.floor((x + TERRITORY_SIZE / 2) / SECTOR_SIZE) - Math.floor((TERRITORY_SIZE / SECTOR_SIZE) / 2)),
      sz: clampSector(Math.floor((z + TERRITORY_SIZE / 2) / SECTOR_SIZE) - Math.floor((TERRITORY_SIZE / SECTOR_SIZE) / 2))
    };
  }

  function sectorCenter(sx, sz) {
    return {
      x: sx * SECTOR_SIZE + SECTOR_SIZE / 2,
      z: sz * SECTOR_SIZE + SECTOR_SIZE / 2
    };
  }

  function getPreset() {
    return String(
      localStorage.getItem("mapgame_render_distance") ||
      CFG.DEFAULT_RENDER_DISTANCE ||
      "low"
    ).toLowerCase();
  }

  function getRadius() {
    return Number(RADIUS[getPreset()] ?? 2);
  }

  function heightAt(x, z) {
    if (!active) return 0;

    return window.mapGameTerritory?.heightAt?.(
      x,
      z,
      active.biome,
      active.x,
      active.y,
      TERRITORY_SIZE
    ) ?? 0;
  }

  function makeFallbackMaterial(name, hex) {
    const m = new BABYLON.StandardMaterial(name, runtime.scene);
    m.diffuseColor = BABYLON.Color3.FromHexString(hex);
    m.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    return m;
  }

  function terrainMaterial() {
    if (!runtime) return null;

    if (active?.biome === "desert") {
      return runtime.sandMaterial ||
        makeFallbackMaterial("streamSand", "#b7a06f");
    }

    if (active?.biome === "mountain") {
      return runtime.grassLightMaterial ||
        runtime.grassMaterial ||
        makeFallbackMaterial("streamMountain", "#6f826b");
    }

    return runtime.grassMaterial ||
      makeFallbackMaterial("streamGrass", "#59785d");
  }

  function buildSectorGround(sx, sz) {
    const key = sectorKey(sx, sz);
    if (sectors.has(key) || !runtime?.scene || !root) return null;

    const regular =
      String(runtime.graphicsPreset || "BASIC").toUpperCase() === "REGULAR";

    const subdivisions = regular ? 18 : 12;
    const center = sectorCenter(sx, sz);

    const ground = BABYLON.MeshBuilder.CreateGround(
      `territorySectorGround_${sx}_${sz}`,
      {
        width: SECTOR_SIZE,
        height: SECTOR_SIZE,
        subdivisions,
        updatable: true
      },
      runtime.scene
    );

    ground.parent = root;
    ground.position.set(center.x, 0, center.z);
    ground.material = terrainMaterial();
    ground.receiveShadows = true;
    ground.metadata = {
      territoryGround: true,
      terrainSector: true,
      sectorX: sx,
      sectorZ: sz
    };

    const positions =
      ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    for (let i = 0; i < positions.length; i += 3) {
      const wx = center.x + positions[i];
      const wz = center.z + positions[i + 2];
      positions[i + 1] = heightAt(wx, wz);
    }

    ground.updateVerticesData(
      BABYLON.VertexBuffer.PositionKind,
      positions
    );

    const normals = [];
    BABYLON.VertexData.ComputeNormals(
      positions,
      ground.getIndices(),
      normals
    );

    ground.updateVerticesData(
      BABYLON.VertexBuffer.NormalKind,
      normals
    );

    ground.refreshBoundingInfo();

    const sector = {
      key,
      sx,
      sz,
      ground,
      root: new BABYLON.TransformNode(
        `territorySectorRoot_${sx}_${sz}`,
        runtime.scene
      ),
      detailsBuilt: false
    };

    sector.root.parent = root;
    sectors.set(key, sector);

    setTimeout(() => buildSectorDetails(sector), 0);

    return sector;
  }

  function pseudo(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function createSimpleTree(parent, x, z, seed) {
    const scene = runtime.scene;

    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      "streamTreeTrunk",
      {
        height: 8 + pseudo(seed + 1) * 5,
        diameterTop: 0.65,
        diameterBottom: 1.15,
        tessellation: 6
      },
      scene
    );

    const y = heightAt(x, z);
    trunk.position.set(x, y + 4.5, z);
    trunk.material = runtime.treeTrunkMaterial;
    trunk.parent = parent;
    trunk.isPickable = false;
    trunk.metadata = { vegetation: true, terrainDetail: true };

    const crown = BABYLON.MeshBuilder.CreateCylinder(
      "streamTreeCrown",
      {
        height: 7 + pseudo(seed + 2) * 5,
        diameterTop: 0.4,
        diameterBottom: 5.2 + pseudo(seed + 3) * 3.2,
        tessellation: 7
      },
      scene
    );

    crown.position.set(
      x,
      y + 10 + pseudo(seed + 4) * 2,
      z
    );

    crown.material =
      pseudo(seed + 5) > 0.5
        ? runtime.treeLeafMaterial
        : runtime.treeLeafAltMaterial || runtime.treeLeafMaterial;

    crown.parent = parent;
    crown.isPickable = false;
    crown.metadata = { vegetation: true, terrainDetail: true };
  }

  function createSimpleRock(parent, x, z, seed) {
    const rock =
      BABYLON.MeshBuilder.CreatePolyhedron(
        "streamRock",
        {
          type: Math.floor(pseudo(seed) * 3),
          size: 2.5 + pseudo(seed + 1) * 3.2
        },
        runtime.scene
      );

    const y = heightAt(x, z);

    rock.position.set(
      x,
      y + 1.2,
      z
    );

    rock.scaling.y = 0.55 + pseudo(seed + 2) * 0.35;
    rock.rotation.y = pseudo(seed + 3) * Math.PI;
    rock.material = runtime.rockMaterial;
    rock.parent = parent;
    rock.isPickable = false;
    rock.metadata = { terrainDetail: true };
  }

  function buildSectorDetails(sector) {
    if (!sector || sector.detailsBuilt || !active) return;
    sector.detailsBuilt = true;

    const regular =
      String(runtime.graphicsPreset || "BASIC").toUpperCase() === "REGULAR";

    const treeBudget =
      active.biome === "forest"
        ? (regular ? 18 : 10)
        : active.biome === "desert"
          ? 1
          : (regular ? 9 : 5);

    const rockBudget =
      active.biome === "mountain"
        ? (regular ? 10 : 6)
        : (regular ? 4 : 2);

    const center = sectorCenter(sector.sx, sector.sz);
    const baseSeed =
      active.x * 73856093 +
      active.y * 19349663 +
      sector.sx * 83492791 +
      sector.sz * 2654435761;

    for (let i = 0; i < treeBudget; i++) {
      const px =
        center.x +
        (pseudo(baseSeed + i * 17) - 0.5) *
        (SECTOR_SIZE - 28);

      const pz =
        center.z +
        (pseudo(baseSeed + i * 17 + 2) - 0.5) *
        (SECTOR_SIZE - 28);

      if (
        window.mapGameTerritory?.waterBandAt?.(
          px,
          pz,
          active.biome,
          TERRITORY_SIZE
        )?.isWater
      ) continue;

      createSimpleTree(
        sector.root,
        px,
        pz,
        baseSeed + i * 17
      );
    }

    for (let i = 0; i < rockBudget; i++) {
      const px =
        center.x +
        (pseudo(baseSeed + 900 + i * 23) - 0.5) *
        (SECTOR_SIZE - 22);

      const pz =
        center.z +
        (pseudo(baseSeed + 902 + i * 23) - 0.5) *
        (SECTOR_SIZE - 22);

      createSimpleRock(
        sector.root,
        px,
        pz,
        baseSeed + 900 + i * 23
      );
    }
  }

  function desiredSectorKeys() {
    if (!runtime?.camera || !active) return new Map();

    const target = runtime.camera.target;
    const center = worldToSector(target.x, target.z);
    const radius = getRadius();
    const result = new Map();

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const sx = clampSector(center.sx + dx);
        const sz = clampSector(center.sz + dz);
        const key = sectorKey(sx, sz);
        const distance = Math.max(Math.abs(dx), Math.abs(dz));

        result.set(key, {
          sx,
          sz,
          distance
        });
      }
    }

    return result;
  }

  function rebuildQueue() {
    const desired = desiredSectorKeys();

    generationQueue =
      [...desired.values()]
        .filter(item => !sectors.has(sectorKey(item.sx, item.sz)))
        .sort((a, b) => a.distance - b.distance);

    const radius = getRadius();
    const center = worldToSector(
      runtime.camera.target.x,
      runtime.camera.target.z
    );

    for (const [key, sector] of sectors) {
      const distance = Math.max(
        Math.abs(sector.sx - center.sx),
        Math.abs(sector.sz - center.sz)
      );

      if (distance > radius + 1) {
        disposeSector(key);
      }
    }

    updateStatus();
    processQueue();
  }

  function processQueue() {
    if (generating || !generationQueue.length || !active) return;
    generating = true;

    const next = generationQueue.shift();

    const run = () => {
      if (active && next) {
        buildSectorGround(next.sx, next.sz);
      }

      generating = false;
      updateStatus();

      if (generationQueue.length) {
        setTimeout(processQueue, 0);
      }
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(run, { timeout: 80 });
    } else {
      setTimeout(run, 0);
    }
  }

  function disposeSector(key) {
    const sector = sectors.get(key);
    if (!sector) return;

    try { sector.root?.dispose(false, false); } catch (_) {}
    try { sector.ground?.dispose(false, false); } catch (_) {}

    sectors.delete(key);
  }

  function updateStatus() {
    let el = document.getElementById("mgStreamStatus");

    if (!el) {
      el = document.createElement("div");
      el.id = "mgStreamStatus";
      el.className = "mg-stream-status";
      document.body.appendChild(el);
    }

    if (!active) {
      el.hidden = true;
      return;
    }

    el.hidden = false;
    el.textContent =
      `SECTORS ${sectors.size} • QUEUE ${generationQueue.length} • ${getPreset().toUpperCase()}`;
  }

  function tick() {
    if (!active || !runtime?.camera) return;

    const now = performance.now();
    if (now - updateTimer < 500) return;
    updateTimer = now;

    rebuildQueue();
  }

  function start(territory, biome, parentRoot) {
    stop();

    active = {
      ...territory,
      biome
    };

    root =
      parentRoot ||
      new BABYLON.TransformNode(
        "territoryStreamRoot",
        runtime.scene
      );

    rebuildQueue();

    observer =
      runtime.scene.onBeforeRenderObservable.add(tick);

    // The center sector is generated immediately so the world can open fast.
    const center = worldToSector(
      runtime.camera?.target?.x || 0,
      runtime.camera?.target?.z || 0
    );

    buildSectorGround(center.sx, center.sz);

    return Promise.resolve({
      territory: active,
      centerSector: center
    });
  }

  function stop() {
    if (observer && runtime?.scene) {
      runtime.scene.onBeforeRenderObservable.remove(observer);
      observer = null;
    }

    generationQueue = [];
    generating = false;

    for (const key of [...sectors.keys()]) {
      disposeSector(key);
    }

    sectors.clear();
    active = null;
    root = null;
    updateStatus();
  }

  function allGroundMeshes() {
    return [...sectors.values()]
      .map(s => s.ground)
      .filter(Boolean);
  }

  function pickGround(sceneX, sceneY) {
    if (!runtime?.scene) return null;

    const pick =
      runtime.scene.pick(
        sceneX,
        sceneY,
        mesh =>
          Boolean(mesh?.metadata?.terrainSector)
      );

    return pick?.hit && pick.pickedPoint
      ? pick.pickedPoint.clone()
      : null;
  }

  function flattenTerrainForStructure(
    x,
    z,
    width,
    depth,
    targetY,
    padding = 10
  ) {
    const halfW = width / 2;
    const halfD = depth / 2;
    const outerW = halfW + padding;
    const outerD = halfD + padding;

    for (const sector of sectors.values()) {
      const ground = sector.ground;
      if (!ground) continue;

      const center = sectorCenter(sector.sx, sector.sz);

      // Cheap sector overlap reject.
      if (
        Math.abs(center.x - x) > SECTOR_SIZE / 2 + outerW ||
        Math.abs(center.z - z) > SECTOR_SIZE / 2 + outerD
      ) continue;

      const positions =
        ground.getVerticesData(
          BABYLON.VertexBuffer.PositionKind
        );

      if (!positions) continue;

      let changed = false;

      for (let i = 0; i < positions.length; i += 3) {
        const wx = center.x + positions[i];
        const wz = center.z + positions[i + 2];

        const dx = Math.abs(wx - x);
        const dz = Math.abs(wz - z);

        if (dx > outerW || dz > outerD) continue;

        if (dx <= halfW && dz <= halfD) {
          positions[i + 1] = targetY;
        } else {
          const tx =
            Math.max(
              0,
              Math.min(
                1,
                (outerW - dx) / Math.max(1, padding)
              )
            );

          const tz =
            Math.max(
              0,
              Math.min(
                1,
                (outerD - dz) / Math.max(1, padding)
              )
            );

          const blend = Math.min(tx, tz);
          const smooth = blend * blend * (3 - 2 * blend);

          positions[i + 1] =
            positions[i + 1] +
            (targetY - positions[i + 1]) *
            smooth;
        }

        changed = true;
      }

      if (!changed) continue;

      ground.updateVerticesData(
        BABYLON.VertexBuffer.PositionKind,
        positions
      );

      const normals = [];
      BABYLON.VertexData.ComputeNormals(
        positions,
        ground.getIndices(),
        normals
      );

      ground.updateVerticesData(
        BABYLON.VertexBuffer.NormalKind,
        normals
      );

      ground.refreshBoundingInfo();
    }
  }

  function getSectorCount() {
    return sectors.size;
  }

  function setRuntime(rt) {
    runtime = rt;
  }

  window.mapGameTerritoryStream = {
    VERSION: "0.2.2B1",
    setRuntime,
    start,
    stop,
    rebuildQueue,
    getSectorCount,
    allGroundMeshes,
    pickGround,
    flattenTerrainForStructure,
    worldToSector,
    sectorCenter
  };

  window.addEventListener(
    "mapgame:runtime-ready",
    event => {
      setRuntime(event.detail);
    }
  );

  window.addEventListener(
    "storage",
    event => {
      if (event.key === "mapgame_render_distance") {
        rebuildQueue();
      }
    }
  );

  console.log(
    "Map Game territory stream 0.2.2B1 ready."
  );
})();
