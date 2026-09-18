// ============================================================
// MAP GAME — VISUAL OVERHAUL
// Alpha 0.1.1e — Whole-world polish pass
// Load AFTER terrain.js, buildings.js (if present), and world_visuals.js.
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameVisualOverhaulLoaded) return;
  window.__mapGameVisualOverhaulLoaded = true;

  function boot(runtime) {
    if (!runtime || !runtime.scene || !window.BABYLON) {
      console.error("Visual Overhaul: runtime missing");
      return;
    }

    const scene = runtime.scene;
    const camera = runtime.camera;
    const hemi = runtime.hemi;
    const moon = runtime.moon;
    const sun = runtime.sun;
    const shadowGenerator = runtime.shadowGenerator;

    let preset = runtime.graphicsPreset === "REGULAR" ? "REGULAR" : "BASIC";

    // ========================================================
    // SMALL HELPERS
    // ========================================================

    function hash(n) {
      const x = Math.sin(n * 91.133 + 17.73) * 43758.5453;
      return x - Math.floor(x);
    }

    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    function color(r, g, b) {
      return new BABYLON.Color3(r, g, b);
    }

    function safeShadow(mesh) {
      if (!mesh) return;
      mesh.receiveShadows = true;
      try { shadowGenerator && shadowGenerator.addShadowCaster(mesh); } catch (_) {}
    }

    // ========================================================
    // MATERIALS — BASIC = clean, REGULAR = richer PBR sheen
    // ========================================================

    const trimMat = new BABYLON.StandardMaterial("voTrim", scene);
    trimMat.diffuseColor = color(.10, .13, .16);
    trimMat.specularColor = color(.10, .12, .14);
    trimMat.specularPower = 20;

    const concreteLight = new BABYLON.StandardMaterial("voConcreteLight", scene);
    concreteLight.diffuseColor = color(.55, .58, .59);
    concreteLight.specularColor = color(.05, .05, .05);

    const sidewalkMat = new BABYLON.StandardMaterial("voSidewalk", scene);
    sidewalkMat.diffuseColor = color(.34, .36, .37);
    sidewalkMat.specularColor = color(.025, .025, .025);

    const curbMat = new BABYLON.StandardMaterial("voCurb", scene);
    curbMat.diffuseColor = color(.57, .58, .57);
    curbMat.specularColor = color(.02, .02, .02);

    const mountainRock = new BABYLON.StandardMaterial("voMountainRock", scene);
    mountainRock.diffuseColor = color(.27, .30, .31);
    mountainRock.specularColor = color(.035, .04, .045);
    mountainRock.specularPower = 10;

    // Reuse the user's downloaded rock texture if it already exists.
    if (window.mapGameTerrain && window.mapGameTerrain.rockTexture) {
      mountainRock.diffuseTexture = window.mapGameTerrain.rockTexture;
    }

    const mountainRockLight = new BABYLON.StandardMaterial("voMountainRockLight", scene);
    mountainRockLight.diffuseColor = color(.38, .40, .40);
    mountainRockLight.specularColor = color(.03, .03, .03);
    if (window.mapGameTerrain && window.mapGameTerrain.rockTexture) {
      mountainRockLight.diffuseTexture = window.mapGameTerrain.rockTexture;
    }

    const snowMat = runtime.snowMaterial || new BABYLON.StandardMaterial("voSnow", scene);
    if (!runtime.snowMaterial) {
      snowMat.diffuseColor = color(.88, .92, .94);
      snowMat.specularColor = color(.20, .22, .22);
      snowMat.specularPower = 28;
    }

    const pbrWall = new BABYLON.PBRMaterial("voPbrWall", scene);
    pbrWall.albedoColor = color(.43, .47, .50);
    pbrWall.metallic = .03;
    pbrWall.roughness = .42;
    pbrWall.clearCoat.isEnabled = true;
    pbrWall.clearCoat.intensity = .16;
    pbrWall.clearCoat.roughness = .32;

    const pbrWallWarm = new BABYLON.PBRMaterial("voPbrWallWarm", scene);
    pbrWallWarm.albedoColor = color(.48, .45, .40);
    pbrWallWarm.metallic = .02;
    pbrWallWarm.roughness = .47;
    pbrWallWarm.clearCoat.isEnabled = true;
    pbrWallWarm.clearCoat.intensity = .12;
    pbrWallWarm.clearCoat.roughness = .38;

    const pbrGlass = new BABYLON.PBRMaterial("voPbrGlass", scene);
    pbrGlass.albedoColor = color(.055, .14, .21);
    pbrGlass.metallic = .03;
    pbrGlass.roughness = .10;
    pbrGlass.alpha = .86;
    pbrGlass.environmentIntensity = .85;

    const rooftopMat = new BABYLON.StandardMaterial("voRooftop", scene);
    rooftopMat.diffuseColor = color(.16, .18, .19);
    rooftopMat.specularColor = color(.07, .08, .09);
    rooftopMat.specularPower = 22;

    // ========================================================
    // 1) REPLACE OLD CONE-LIKE MOUNTAINS WITH MOUNTAIN RANGES
    // ========================================================

    function removeOldMountains() {
      const doomed = scene.meshes.filter(mesh =>
        mesh && (mesh.name === "mountain" || mesh.name === "mountainSnowCap")
      );
      doomed.forEach(mesh => {
        try { mesh.dispose(false, true); } catch (_) { try { mesh.dispose(); } catch (_) {} }
      });
    }

    function createIrregularPeak(name, x, z, radius, height, seed, stretchX = 1, stretchZ = 1) {
      const segments = preset === "REGULAR" ? 16 : 12;
      const rings = preset === "REGULAR" ? 7 : 6;
      const positions = [];
      const indices = [];
      const uvs = [];

      // Wider foot, irregular shoulders, narrower upper ridge.
      const scales = [1.0, .86, .67, .49, .33, .19, .09];
      const ys = [-5, .13, .31, .52, .70, .86, .95];

      let driftX = 0;
      let driftZ = 0;

      for (let r = 0; r < rings; r++) {
        driftX += (hash(seed + r * 4.7) - .5) * radius * .07;
        driftZ += (hash(seed + r * 8.2) - .5) * radius * .07;

        for (let s = 0; s < segments; s++) {
          const a = s / segments * Math.PI * 2;
          const wobble = .78 + hash(seed + r * 41 + s * 9.7) * .42;
          const terrace = 1 + Math.sin(a * (2 + (seed % 3))) * .035;
          const rr = radius * scales[r] * wobble * terrace;
          const yNoise = (hash(seed * 2 + r * 11 + s * 3.1) - .5) * height * (r < 2 ? .055 : .035);

          positions.push(
            driftX + Math.cos(a) * rr * stretchX,
            (r === 0 ? ys[r] : ys[r] * height) + yNoise,
            driftZ + Math.sin(a) * rr * stretchZ
          );
          uvs.push(s / segments * 2.2, r / (rings - 1) * 2.2);
        }
      }

      const peak = positions.length / 3;
      positions.push(
        driftX + (hash(seed + 901) - .5) * radius * .12,
        height,
        driftZ + (hash(seed + 902) - .5) * radius * .12
      );
      uvs.push(.5, 1);

      for (let r = 0; r < rings - 1; r++) {
        for (let s = 0; s < segments; s++) {
          const n = (s + 1) % segments;
          const a = r * segments + s;
          const b = r * segments + n;
          const c = (r + 1) * segments + s;
          const d = (r + 1) * segments + n;
          indices.push(a, c, b, b, c, d);
        }
      }

      const last = (rings - 1) * segments;
      for (let s = 0; s < segments; s++) {
        const n = (s + 1) % segments;
        indices.push(last + s, peak, last + n);
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
      mesh.position.set(x, 0, z);
      mesh.material = (seed % 2 < 1) ? mountainRock : mountainRockLight;
      mesh.isPickable = false;
      safeShadow(mesh);

      // Snow is an irregular upper rock form, not a floating white ball.
      if (height > 104) {
        const cap = BABYLON.MeshBuilder.CreatePolyhedron(
          name + "Snow",
          { type: 2, size: radius * .19 },
          scene
        );
        cap.position.set(
          x + driftX * .75,
          height * .91,
          z + driftZ * .75
        );
        cap.scaling.set(1.45 * stretchX, .58, 1.45 * stretchZ);
        cap.rotation.set(.05, hash(seed + 30) * Math.PI, -.04);
        cap.material = snowMat;
        cap.isPickable = false;
        safeShadow(cap);
      }

      return mesh;
    }

    function createRange(cx, cz, angle, count, scale, seed) {
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const px = -dz;
      const pz = dx;

      for (let i = 0; i < count; i++) {
        const t = i - (count - 1) / 2;
        const along = t * 75 * scale;
        const side = (hash(seed + i * 11) - .5) * 85 * scale;
        const x = cx + dx * along + px * side;
        const z = cz + dz * along + pz * side;
        const r = (48 + hash(seed + i * 17) * 52) * scale;
        const h = (78 + hash(seed + i * 29) * 92) * scale;
        const sx = .92 + hash(seed + i * 2) * .45;
        const sz = .92 + hash(seed + i * 3) * .40;
        createIrregularPeak("voMountain", x, z, r, h, seed + i * 101, sx, sz);

        // Low foothill overlapping the main peak breaks the cone silhouette.
        if (i % 2 === 0) {
          createIrregularPeak(
            "voFoothill",
            x + px * r * .56,
            z + pz * r * .56,
            r * .62,
            h * .42,
            seed + i * 101 + 700,
            1.25,
            .90
          );
        }
      }
    }

    function rebuildMountains() {
      scene.meshes
        .filter(m => m && (m.name === "voMountain" || m.name === "voFoothill" || /voMountain.*Snow|voFoothill.*Snow/.test(m.name)))
        .slice()
        .forEach(m => { try { m.dispose(false, true); } catch (_) {} });

      // Major visible ranges — broad, overlapping, asymmetrical.
      createRange(-420, -470, .20, 6, .78, 101);
      createRange(920, -730, 2.45, 7, 1.10, 220);
      createRange(-980, 640, .72, 7, 1.04, 340);
      createRange(850, 820, -1.05, 6, .92, 460);
      createRange(-240, 1120, .10, 7, .98, 580);
    }

    removeOldMountains();
    rebuildMountains();

    // ========================================================
    // 2) BUILDING FACADES — BREAK UP GIANT RECTANGLES
    // ========================================================

    const decoratedBodies = new Set();
    const decoratedGlass = new Set();
    const bodyDetails = [];
    const glassDetails = [];

    function worldSize(mesh) {
      try {
        const bi = mesh.getBoundingInfo().boundingBox;
        const min = bi.minimumWorld;
        const max = bi.maximumWorld;
        return {
          x: Math.abs(max.x - min.x),
          y: Math.abs(max.y - min.y),
          z: Math.abs(max.z - min.z)
        };
      } catch (_) {
        return { x: 10, y: 10, z: 10 };
      }
    }

    function makeDetailBox(name, w, h, d, x, y, z, material, parentBucket) {
      const m = BABYLON.MeshBuilder.CreateBox(name, { width:w, height:h, depth:d }, scene);
      m.position.set(x,y,z);
      m.material = material;
      m.isPickable = false;
      safeShadow(m);
      if (parentBucket) parentBucket.push(m);
      return m;
    }

    function decorateBody(body) {
      if (!body || body.isDisposed() || decoratedBodies.has(body.uniqueId)) return;
      decoratedBodies.add(body.uniqueId);

      const n = String(body.name || "").toLowerCase();
      if (!(n === "modernbuilding" || n === "buildingbody" || n.includes("residentialbasic"))) return;

      const s = worldSize(body);
      if (s.x < 5 || s.y < 5 || s.z < 5) return;

      body.metadata = body.metadata || {};
      body.metadata.voOriginalMaterial = body.material;

      const x = body.position.x;
      const y0 = body.position.y - s.y / 2;
      const z = body.position.z;
      const frontZ = z - s.z / 2 - .17;
      const local = [];

      // Roof slab gives a strong silhouette even in Basic.
      makeDetailBox("voRoofCap", s.x + .8, .55, s.z + .8, x, y0 + s.y + .28, z, rooftopMat, local);

      // Base plinth grounds the building.
      makeDetailBox("voPlinth", s.x + .36, .48, s.z + .36, x, y0 + .24, z, trimMat, local);

      // Entrance frame + canopy.
      const doorW = clamp(s.x * .18, 2.6, 5.5);
      makeDetailBox("voEntrance", doorW, 3.0, .45, x, y0 + 1.5, frontZ - .08, trimMat, local);
      makeDetailBox("voCanopy", doorW + 2.0, .28, 2.2, x, y0 + 3.35, frontZ - .86, rooftopMat, local);

      // Vertical façade ribs break the "one giant box" silhouette.
      const ribCount = preset === "REGULAR" ? Math.max(3, Math.floor(s.x / 5.5)) : Math.max(2, Math.floor(s.x / 8));
      for (let i = 1; i < ribCount; i++) {
        const rx = x - s.x/2 + (s.x / ribCount) * i;
        makeDetailBox("voFacadeRib", .34, s.y * .82, .34, rx, y0 + s.y*.51, frontZ, trimMat, local);
      }

      // Floor bands make height readable from far away.
      const floors = clamp(Math.round(s.y / 4), 2, 14);
      const bandStep = preset === "REGULAR" ? 1 : 2;
      for (let f = bandStep; f < floors; f += bandStep) {
        const fy = y0 + (s.y / floors) * f;
        makeDetailBox("voFloorBand", s.x + .15, .18, .34, x, fy, frontZ, trimMat, local);
      }

      // Regular gets side massing and rooftop equipment.
      const regularOnly = [];
      if (s.y > 10) {
        const wingW = Math.min(s.x * .28, 6.5);
        const wing = makeDetailBox(
          "voRegularWing",
          wingW,
          s.y * .55,
          s.z + 1.3,
          x + s.x/2 - wingW*.42,
          y0 + s.y*.31,
          z,
          pbrWallWarm,
          regularOnly
        );
        wing.setEnabled(preset === "REGULAR");

        const hvac = makeDetailBox(
          "voHVAC",
          clamp(s.x*.22, 2.4, 5.5),
          1.45,
          clamp(s.z*.28, 2.4, 5.5),
          x - s.x*.18,
          y0 + s.y + 1.0,
          z + s.z*.10,
          rooftopMat,
          regularOnly
        );
        hvac.setEnabled(preset === "REGULAR");
      }

      body.metadata.voBaseDetails = local;
      body.metadata.voRegularDetails = regularOnly;
      bodyDetails.push(body);

      applyBuildingPreset(body);
    }

    function decorateGlass(glass) {
      if (!glass || glass.isDisposed() || decoratedGlass.has(glass.uniqueId)) return;
      const n = String(glass.name || "").toLowerCase();
      if (!(n === "frontglass" || n === "window" || n === "rearwindow")) return;
      decoratedGlass.add(glass.uniqueId);

      const s = worldSize(glass);
      if (s.x < 1 || s.y < 1) return;

      glass.metadata = glass.metadata || {};
      glass.metadata.voOriginalMaterial = glass.material;

      // Only grid large old glass slabs. Tiny individual windows stay untouched.
      const pieces = [];
      if (s.x > 5 && s.y > 4) {
        const x = glass.position.x;
        const y = glass.position.y;
        const z = glass.position.z - .12;
        const cols = preset === "REGULAR" ? clamp(Math.floor(s.x / 3.4), 3, 8) : clamp(Math.floor(s.x / 5.0), 2, 5);
        const rows = preset === "REGULAR" ? clamp(Math.floor(s.y / 3.5), 2, 9) : clamp(Math.floor(s.y / 5.0), 2, 6);

        for (let c = 1; c < cols; c++) {
          const gx = x - s.x/2 + (s.x / cols) * c;
          makeDetailBox("voGlassMullionV", .16, s.y + .15, .16, gx, y, z, trimMat, pieces);
        }
        for (let r = 1; r < rows; r++) {
          const gy = y - s.y/2 + (s.y / rows) * r;
          makeDetailBox("voGlassMullionH", s.x + .12, .16, .16, x, gy, z, trimMat, pieces);
        }
      }

      glass.metadata.voGrid = pieces;
      glassDetails.push(glass);
      applyGlassPreset(glass);
    }

    function applyBuildingPreset(body) {
      if (!body || body.isDisposed()) return;
      const regular = preset === "REGULAR";

      if (regular) {
        // Use PBR on ordinary concrete/office/residential building bodies only.
        body.material = pbrWall;
      } else if (body.metadata && body.metadata.voOriginalMaterial) {
        body.material = body.metadata.voOriginalMaterial;
      }

      const regularDetails = body.metadata && body.metadata.voRegularDetails;
      if (Array.isArray(regularDetails)) {
        regularDetails.forEach(m => { if (m && !m.isDisposed()) m.setEnabled(regular); });
      }
    }

    function applyGlassPreset(glass) {
      if (!glass || glass.isDisposed()) return;
      if (preset === "REGULAR") {
        glass.material = pbrGlass;
      } else if (glass.metadata && glass.metadata.voOriginalMaterial) {
        glass.material = glass.metadata.voOriginalMaterial;
      }
    }

    function scanBuildings() {
      scene.meshes.slice().forEach(mesh => {
        decorateBody(mesh);
        decorateGlass(mesh);
      });
    }

    scanBuildings();

    scene.onNewMeshAddedObservable.add(mesh => {
      // Delay one frame so dimensions/materials from the creator are settled.
      setTimeout(() => {
        decorateBody(mesh);
        decorateGlass(mesh);
      }, 0);
    });

    // ========================================================
    // 3) ROADS — SIDEWALKS, CURBS, REGULAR CROSSWALK DETAIL
    // ========================================================

    const decoratedRoads = new Set();
    const roadRegularDetails = [];

    function rotatedOffset(x, z, ox, oz, angle) {
      return {
        x: x + ox * Math.cos(angle) + oz * Math.sin(angle),
        z: z - ox * Math.sin(angle) + oz * Math.cos(angle)
      };
    }

    function decorateRoad(road) {
      if (!road || road.isDisposed() || decoratedRoads.has(road.uniqueId)) return;
      if (String(road.name || "").toLowerCase() !== "road") return;
      decoratedRoads.add(road.uniqueId);

      const s = worldSize(road);
      const angle = road.rotation.y || 0;
      const x = road.position.x;
      const z = road.position.z;
      const y = road.position.y + .18;
      const longZ = s.z >= s.x;
      const roadWidth = longZ ? s.x : s.z;
      const roadLength = longZ ? s.z : s.x;
      if (roadLength < 10) return;

      const sideOffset = roadWidth/2 + 1.65;

      for (const side of [-1, 1]) {
        const ox = longZ ? sideOffset * side : 0;
        const oz = longZ ? 0 : sideOffset * side;
        const p = rotatedOffset(x, z, ox, oz, angle);

        const walk = BABYLON.MeshBuilder.CreateBox(
          "voSidewalk",
          {
            width: longZ ? 2.8 : roadLength,
            height: .22,
            depth: longZ ? roadLength : 2.8
          },
          scene
        );
        walk.position.set(p.x, y, p.z);
        walk.rotation.y = angle;
        walk.material = sidewalkMat;
        walk.isPickable = false;
        walk.receiveShadows = true;

        const curbLocal = sideOffset - .9;
        const cox = longZ ? curbLocal * side : 0;
        const coz = longZ ? 0 : curbLocal * side;
        const cp = rotatedOffset(x, z, cox, coz, angle);
        const curb = BABYLON.MeshBuilder.CreateBox(
          "voCurb",
          {
            width: longZ ? .32 : roadLength,
            height: .27,
            depth: longZ ? roadLength : .32
          },
          scene
        );
        curb.position.set(cp.x, y + .03, cp.z);
        curb.rotation.y = angle;
        curb.material = curbMat;
        curb.isPickable = false;
      }

      // Regular: subtle crosswalk-style bars near road midpoint for visual richness.
      const bars = [];
      if (roadLength > 55) {
        const count = 5;
        for (let i = 0; i < count; i++) {
          const along = (i - (count-1)/2) * 1.55;
          const ox = longZ ? 0 : along;
          const oz = longZ ? along : 0;
          const p = rotatedOffset(x, z, ox, oz, angle);
          const stripe = BABYLON.MeshBuilder.CreateBox(
            "voCrosswalk",
            {
              width: longZ ? roadWidth * .62 : .78,
              height: .035,
              depth: longZ ? .78 : roadWidth * .62
            },
            scene
          );
          stripe.position.set(p.x, road.position.y + .095, p.z);
          stripe.rotation.y = angle;
          stripe.material = concreteLight;
          stripe.isPickable = false;
          stripe.setEnabled(preset === "REGULAR");
          bars.push(stripe);
        }
      }
      roadRegularDetails.push(...bars);
    }

    scene.meshes.slice().forEach(decorateRoad);
    scene.onNewMeshAddedObservable.add(mesh => setTimeout(() => decorateRoad(mesh), 0));

    // ========================================================
    // 4) LIGHTING / ATMOSPHERE — NIGHTS REMAIN PLAYABLE
    // ========================================================

    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;

    function tuneAtmosphere() {
      const regular = preset === "REGULAR";

      scene.imageProcessingConfiguration.contrast = regular ? 1.14 : 1.07;
      scene.imageProcessingConfiguration.exposure = regular ? 1.06 : 1.02;

      // game.js updates day/night first; this observer runs later and only sets floors.
      if (hemi) hemi.intensity = Math.max(hemi.intensity, regular ? .23 : .20);

      const nightish = sun ? sun.intensity < .35 : false;
      if (nightish && moon) moon.intensity = Math.max(moon.intensity, regular ? .32 : .25);

      if (nightish) {
        scene.ambientColor = regular
          ? color(.115, .145, .205)
          : color(.085, .105, .155);
      } else {
        scene.ambientColor = regular
          ? color(.045, .050, .055)
          : color(.03, .035, .04);
      }

      if (shadowGenerator) {
        shadowGenerator.blurKernel = regular ? 18 : 9;
      }
    }

    scene.onBeforeRenderObservable.add(tuneAtmosphere);

    // ========================================================
    // 5) CAMERA — LESS FLAT / MORE CINEMATIC WORLD VIEW
    // ========================================================

    if (camera) {
      camera.inertia = .84;
      camera.panningInertia = .88;
      camera.wheelPrecision = 34;
      camera.lowerBetaLimit = .32;
      camera.upperBetaLimit = 1.30;
    }

    // ========================================================
    // 6) UI — CLEANER, MORE COHESIVE COMMAND INTERFACE
    // ========================================================

    const ui = document.createElement("style");
    ui.id = "map-game-visual-overhaul-ui";
    ui.textContent = `
      :root {
        --vo-bg: rgba(5,12,20,.89);
        --vo-panel: rgba(7,16,26,.88);
        --vo-line: rgba(133,211,238,.16);
        --vo-line2: rgba(133,211,238,.28);
        --vo-text: #eef8fc;
        --vo-muted: #8da7b6;
        --vo-accent: #72d7f1;
      }

      #mg-topbar {
        min-height: 58px !important;
        padding: 0 16px !important;
        background: linear-gradient(180deg, rgba(6,15,25,.96), rgba(5,13,22,.88)) !important;
        border-bottom: 1px solid var(--vo-line2) !important;
        box-shadow: 0 10px 30px rgba(0,0,0,.22) !important;
        backdrop-filter: blur(16px) saturate(125%);
      }

      #mg-topbar > div:last-child { gap: 6px !important; }
      #mg-topbar > div:last-child > div {
        min-height: 27px !important;
        padding: 5px 9px !important;
        border-radius: 8px !important;
        background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018)) !important;
        border: 1px solid rgba(255,255,255,.075) !important;
        box-shadow: inset 0 1px rgba(255,255,255,.025);
      }

      #mg-side-dock {
        width: 58px !important;
        padding: 7px !important;
        background: linear-gradient(180deg, rgba(6,15,25,.94), rgba(5,12,21,.82)) !important;
        border: 1px solid var(--vo-line) !important;
        border-radius: 15px !important;
        box-shadow: 0 18px 40px rgba(0,0,0,.25) !important;
        backdrop-filter: blur(16px) saturate(120%);
      }

      .mg-dock-button {
        border-radius: 11px !important;
        border-color: rgba(255,255,255,.075) !important;
        background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.018)) !important;
        transition: transform .14s ease, border-color .14s ease, background .14s ease !important;
      }

      .mg-dock-button:hover {
        transform: translateX(2px);
        border-color: var(--vo-line2) !important;
        background: rgba(22,44,59,.78) !important;
      }

      #mg-inspector, #mg-shop {
        background: linear-gradient(180deg, rgba(7,17,28,.96), rgba(5,12,21,.93)) !important;
        border-color: var(--vo-line2) !important;
        box-shadow: 0 24px 65px rgba(0,0,0,.36) !important;
        backdrop-filter: blur(20px) saturate(125%);
      }

      #mg-bottom-bar {
        background: linear-gradient(90deg, rgba(4,10,18,.91), rgba(8,19,30,.85)) !important;
        border-top: 1px solid var(--vo-line) !important;
        box-shadow: 0 -12px 30px rgba(0,0,0,.16) !important;
        backdrop-filter: blur(14px);
      }

      #mg-graphics-toggle, #mg-multiplayer-badge {
        border-color: var(--vo-line) !important;
        background: rgba(5,13,22,.84) !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.20) !important;
        backdrop-filter: blur(12px);
      }

      #mg-graphics-toggle:hover {
        border-color: var(--vo-line2) !important;
        background: rgba(12,29,43,.93) !important;
      }

      .mg-ui-corner {
        background: rgba(4,10,18,.54) !important;
        border-color: rgba(255,255,255,.07) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.14);
      }

      /* Desktop does not need giant phone-style arrows covering the scene. */
      @media (hover:hover) and (pointer:fine) and (min-width:900px) {
        #mg-touch-controls {
          opacity: .23 !important;
          transform: scale(.82) !important;
          transform-origin: bottom right !important;
          transition: opacity .15s ease, transform .15s ease !important;
        }
        #mg-touch-controls:hover {
          opacity: .88 !important;
          transform: scale(.88) !important;
        }
      }
    `;
    document.head.appendChild(ui);

    // ========================================================
    // 7) PRESET DIFFERENCE — BASIC GOOD, REGULAR CLEARLY RICHER
    // ========================================================

    function applyPreset(next) {
      preset = next === "REGULAR" ? "REGULAR" : "BASIC";

      bodyDetails.forEach(applyBuildingPreset);
      glassDetails.forEach(applyGlassPreset);
      roadRegularDetails.forEach(m => {
        if (m && !m.isDisposed()) m.setEnabled(preset === "REGULAR");
      });

      // Mountain tessellation is expensive to rebuild every click, but changing
      // material/light/render quality still makes the preset visibly distinct.
      mountainRock.specularPower = preset === "REGULAR" ? 22 : 10;
      mountainRockLight.specularPower = preset === "REGULAR" ? 20 : 9;
      sidewalkMat.specularPower = preset === "REGULAR" ? 18 : 7;

      if (runtime.engine) {
        runtime.engine.setHardwareScalingLevel(preset === "REGULAR" ? 1.0 : 1.25);
      }
    }

    window.addEventListener("mapgame:graphics", event => {
      applyPreset(event && event.detail ? event.detail.preset : "BASIC");
    });

    applyPreset(preset);

    console.log("✓ Map Game 0.1.1e visual overhaul active");
    if (runtime.showToast) runtime.showToast("Visual overhaul loaded", "success");
  }

  if (window.mapGameRuntime) {
    boot(window.mapGameRuntime);
  } else {
    window.addEventListener("mapgame:runtime-ready", event => boot(event.detail), { once:true });
  }
})();
