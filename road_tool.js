// ============================================================
// MAP GAME — road_tool.js
// Alpha 0.2.2C1 — interactive road construction tool
// ============================================================
(() => {
  "use strict";

  const R = () => window.mapGameRoads;
  const C = () => window.mapGameWorldConfig;
  const runtime = () => window.mapGameRuntime;

  let panel = null;
  let open = false;
  let mode = "build";
  let roadType = "road2";
  let startPoint = null;
  let preview = null;
  let previewMat = null;
  let roadRoot = null;
  let activeTerritoryId = null;
  let rendered = new Map();
  let lastStreamRefresh = 0;

  const roadRank = {
    dirt: 0,
    road2: 1,
    avenue4: 2,
    highway: 3,
    freeway: 4
  };

  function activeTerritory() {
    return runtime()?.getActiveTerritory?.() || null;
  }

  function activeCapital() {
    return runtime()?.getActiveCapital?.() || null;
  }

  function worldType() {
    return runtime()?.worldType?.() || "singleplayer";
  }

  function terrainY(x, z) {
    const t = activeTerritory();
    if (!t) return 0;

    return (
      window.mapGameTerritory?.heightAt?.(
        x,
        z,
        t.biome,
        t.x,
        t.y,
        C()?.TERRITORY_SIZE || 32768
      ) ?? 0
    );
  }

  function disposeNode(node) {
    try {
      node?.dispose?.(false, false);
    } catch (_) {}
  }

  function ensureRoadRoot() {
    if (!runtime()?.scene) return null;

    if (!roadRoot) {
      roadRoot =
        new BABYLON.TransformNode(
          "playerRoadStreamRoot",
          runtime().scene
        );
    }

    return roadRoot;
  }

  function clearRendered() {
    for (const node of rendered.values()) {
      disposeNode(node);
    }

    rendered.clear();

    if (roadRoot) {
      disposeNode(roadRoot);
      roadRoot = null;
    }
  }

  function visibleRadius() {
    const preset =
      String(
        localStorage.getItem(
          "mapgame_render_distance"
        ) || "low"
      ).toLowerCase();

    const radius =
      C()?.RENDER_DISTANCE_PRESETS?.[preset] ??
      (
        preset === "high"
          ? 4
          : preset === "medium"
            ? 3
            : 2
      );

    return (
      (Number(radius) + 1.25) *
      Number(C()?.SECTOR_SIZE || 512)
    );
  }

  function segmentNearCamera(segment) {
    const rt = runtime();
    const t = activeTerritory();

    if (!rt?.camera || !t) return false;

    const g =
      R().graphFor(t.id);

    const a = g.nodes.get(segment.a);
    const b = g.nodes.get(segment.b);

    if (!a || !b) return false;

    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const half = segment.length / 2;

    const target = rt.camera.target;
    const distance =
      Math.hypot(
        cx - target.x,
        cz - target.z
      );

    return (
      distance <=
      visibleRadius() + half
    );
  }

  function buildRoadVisual(segment) {
    const rt = runtime();
    const t = activeTerritory();

    if (!rt?.scene || !t) return null;

    const g =
      R().graphFor(t.id);

    const a = g.nodes.get(segment.a);
    const b = g.nodes.get(segment.b);

    if (!a || !b) return null;

    const root =
      new BABYLON.TransformNode(
        `roadVisual_${segment.id}`,
        rt.scene
      );

    root.parent = ensureRoadRoot();
    root.metadata = {
      road: true,
      playerRoad: true,
      roadSegmentId: segment.id
    };

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length =
      Math.hypot(dx, dz);

    const angle =
      Math.atan2(dx, dz);

    const chunkLength = 54;
    const pieces =
      Math.max(
        1,
        Math.ceil(length / chunkLength)
      );

    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces;
      const t1 = (i + 1) / pieces;
      const tm = (t0 + t1) / 2;

      const x =
        a.x + dx * tm;

      const z =
        a.z + dz * tm;

      const pieceLength =
        length / pieces;

      const y = terrainY(x, z);

      const piece =
        rt.createRoad(
          root,
          x,
          z,
          Number(segment.width || 14),
          pieceLength + 0.8,
          angle,
          {
            playerBuilt: true,
            type: segment.type
          }
        );

      piece.position.y = y + 0.24;
      piece.metadata = {
        ...(piece.metadata || {}),
        road: true,
        playerRoad: true,
        roadSegmentId: segment.id,
        roadWidth: Number(segment.width || 14),
        roadDepth: pieceLength + 1,
        roadRotation: angle
      };
    }

    // Invisible pick strip for Inspect / Upgrade / Delete.
    const pick =
      BABYLON.MeshBuilder.CreateBox(
        `roadPick_${segment.id}`,
        {
          width:
            Number(segment.width || 14) + 8,
          height: 3,
          depth: length
        },
        rt.scene
      );

    pick.position.set(
      (a.x + b.x) / 2,
      terrainY(
        (a.x + b.x) / 2,
        (a.z + b.z) / 2
      ) + 1.5,
      (a.z + b.z) / 2
    );

    pick.rotation.y = angle;
    pick.visibility = 0.001;
    pick.isPickable = true;
    pick.parent = root;
    pick.metadata = {
      roadPick: true,
      roadSegmentId: segment.id
    };

    return root;
  }

  function refreshVisible(force = false) {
    const t = activeTerritory();

    if (!t || !R()) {
      clearRendered();
      return;
    }

    if (activeTerritoryId !== t.id) {
      enterTerritory(t.id);
      return;
    }

    const g =
      R().graphFor(t.id);

    for (const segment of g.segments.values()) {
      const should =
        segmentNearCamera(segment);

      if (
        should &&
        !rendered.has(segment.id)
      ) {
        const visual =
          buildRoadVisual(segment);

        if (visual) {
          rendered.set(
            segment.id,
            visual
          );
        }
      } else if (
        !should &&
        rendered.has(segment.id)
      ) {
        disposeNode(
          rendered.get(segment.id)
        );

        rendered.delete(segment.id);
      }
    }

    for (const id of [...rendered.keys()]) {
      if (!g.segments.has(id)) {
        disposeNode(
          rendered.get(id)
        );
        rendered.delete(id);
      }
    }

    updateStats();
  }

  function rebuildSegmentVisual(segmentId) {
    if (rendered.has(segmentId)) {
      disposeNode(
        rendered.get(segmentId)
      );

      rendered.delete(segmentId);
    }

    const t = activeTerritory();

    if (!t) return;

    const segment =
      R().graphFor(t.id)
        .segments.get(segmentId);

    if (
      segment &&
      segmentNearCamera(segment)
    ) {
      rendered.set(
        segment.id,
        buildRoadVisual(segment)
      );
    }
  }

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.id = "mgRoadTool";
    panel.className = "mg-road-tool";
    panel.hidden = true;

    panel.innerHTML = `
      <header class="mg-road-tool-head">
        <div>
          <div class="mg-kicker">INFRASTRUCTURE</div>
          <h2>Road Tool</h2>
        </div>
        <button type="button" class="mg-road-close" data-road-close>×</button>
      </header>

      <div class="mg-road-mode-tabs" role="tablist" aria-label="Road tool mode">
        <button type="button" data-road-mode="build" class="active">BUILD</button>
        <button type="button" data-road-mode="upgrade">UPGRADE</button>
        <button type="button" data-road-mode="delete">DELETE</button>
        <button type="button" data-road-mode="inspect">INSPECT</button>
      </div>

      <section class="mg-road-types">
        <div class="mg-road-section-label">ROAD CLASS</div>
        <div id="mgRoadTypeList" class="mg-road-type-list"></div>
      </section>

      <section class="mg-road-readout">
        <div>
          <span>MODE</span>
          <strong id="mgRoadModeReadout">BUILD</strong>
        </div>
        <div>
          <span>NETWORK</span>
          <strong id="mgRoadNetworkReadout">0 SEGMENTS</strong>
        </div>
      </section>

      <div id="mgRoadMessage" class="mg-road-message">
        Click near your capital to start the first road.
      </div>

      <footer class="mg-road-foot">
        <span>CLICK START</span>
        <span>CLICK END</span>
        <span>ESC CANCEL</span>
      </footer>
    `;

    document.body.appendChild(panel);

    panel
      .querySelector("[data-road-close]")
      .addEventListener(
        "click",
        closeTool
      );

    panel
      .querySelectorAll("[data-road-mode]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            setMode(
              button.dataset.roadMode
            );
          }
        );
      });

    buildRoadTypeButtons();
    return panel;
  }

  function buildRoadTypeButtons() {
    const list =
      panel?.querySelector(
        "#mgRoadTypeList"
      );

    if (!list) return;

    list.innerHTML = "";

    for (const id of R()?.ROAD_ORDER || []) {
      const def = R().ROAD_TYPES[id];
      if (!def) continue;

      const button =
        document.createElement("button");

      button.type = "button";
      button.dataset.roadType = id;
      button.className =
        "mg-road-type";

      button.innerHTML = `
        <span class="mg-road-type-line" style="--road-width:${Math.max(2, Math.min(7, def.lanes || 2))}px"></span>
        <span class="mg-road-type-copy">
          <strong>${def.label}</strong>
          <small>${def.lanes} lanes • ${def.speed} • $${Number(def.costPer100m || 0).toLocaleString()}/100m</small>
        </span>
      `;

      button.addEventListener(
        "click",
        () => {
          roadType = id;
          paintRoadTypeSelection();
          updateMessage(
            `${def.label} selected.`
          );
        }
      );

      list.appendChild(button);
    }

    paintRoadTypeSelection();
  }

  function paintRoadTypeSelection() {
    panel
      ?.querySelectorAll(
        "[data-road-type]"
      )
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.roadType === roadType
        );
      });
  }

  function setMode(next) {
    mode = next;
    clearStart();

    panel
      ?.querySelectorAll(
        "[data-road-mode]"
      )
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.roadMode === mode
        );
      });

    const readout =
      panel?.querySelector(
        "#mgRoadModeReadout"
      );

    if (readout) {
      readout.textContent =
        mode.toUpperCase();
    }

    if (mode === "build") {
      updateMessage(
        "Click a connected start point, then click the endpoint."
      );
    } else if (mode === "upgrade") {
      updateMessage(
        "Choose a higher road class, then click a road segment."
      );
    } else if (mode === "delete") {
      updateMessage(
        "Click a road segment to remove it."
      );
    } else {
      updateMessage(
        "Click a road segment to inspect it."
      );
    }
  }

  function updateMessage(text, kind = "") {
    const el =
      panel?.querySelector(
        "#mgRoadMessage"
      );

    if (!el) return;

    el.textContent = text;
    el.dataset.kind = kind;
  }

  function updateStats() {
    const t = activeTerritory();
    const el =
      panel?.querySelector(
        "#mgRoadNetworkReadout"
      );

    if (!el) return;

    const count =
      t
        ? R().graphFor(t.id).segments.size
        : 0;

    el.textContent =
      `${count} SEGMENT${count === 1 ? "" : "S"}`;
  }

  function canOpenHere() {
    const t = activeTerritory();

    if (!t) {
      runtime()?.showToast?.(
        "Enter a territory before building roads.",
        "info"
      );

      return false;
    }

    const capital = activeCapital();

    if (!capital) {
      runtime()?.showToast?.(
        "Establish your capital before building the road network.",
        "info"
      );

      return false;
    }

    return true;
  }

  function openTool() {
    if (!canOpenHere()) return;

    createPanel();
    enterTerritory(
      activeTerritory().id
    );

    open = true;
    panel.hidden = false;
    setMode(mode);
    refreshVisible(true);

    runtime()?.setBottomStatus?.(
      "<b>ROAD TOOL</b> • connected roads only • click start, then endpoint"
    );

    document
      .querySelector(
        "#mgDock [data-action='infrastructure']"
      )
      ?.classList.add("active");
  }

  function closeTool() {
    open = false;
    clearStart();

    if (panel) {
      panel.hidden = true;
    }

    document
      .querySelector(
        "#mgDock [data-action='infrastructure']"
      )
      ?.classList.remove("active");

    runtime()?.setBottomStatus?.(
      "Road tool closed."
    );
  }

  function makePreview() {
    if (preview || !runtime()?.scene) {
      return preview;
    }

    previewMat =
      new BABYLON.StandardMaterial(
        "roadPreviewMat",
        runtime().scene
      );

    previewMat.diffuseColor =
      new BABYLON.Color3(
        0.22,
        0.88,
        0.62
      );

    previewMat.emissiveColor =
      new BABYLON.Color3(
        0.05,
        0.18,
        0.12
      );

    previewMat.alpha = 0.42;

    preview =
      BABYLON.MeshBuilder.CreateBox(
        "roadPlacementPreview",
        {
          width: 1,
          height: 0.8,
          depth: 1
        },
        runtime().scene
      );

    preview.material = previewMat;
    preview.isPickable = false;
    preview.setEnabled(false);

    return preview;
  }

  function clearStart() {
    startPoint = null;

    if (preview) {
      preview.setEnabled(false);
    }
  }

  function groundPoint() {
    const rt = runtime();

    if (!rt?.scene) return null;

    return (
      window.mapGameTerritoryStream
        ?.pickGround?.(
          rt.scene.pointerX,
          rt.scene.pointerY
        ) || null
    );
  }

  function validateRoadPath(a, b) {
    const t = activeTerritory();

    if (!t || !a || !b) {
      return {
        allowed: false,
        reason: "No territory."
      };
    }

    const length =
      Math.hypot(
        b.x - a.x,
        b.z - a.z
      );

    if (length < 12) {
      return {
        allowed: false,
        reason:
          "Road is too short."
      };
    }

    if (length > 1400) {
      return {
        allowed: false,
        reason:
          "Build roads in shorter sections (maximum 1.4 km per placement)."
      };
    }

    const capital =
      activeCapital();

    const startCheck =
      R().validateConnectedStart(
        t.id,
        a,
        capital,
        {
          snapDistance: 34,
          capitalStartDistance: 145
        }
      );

    if (!startCheck.allowed) {
      return startCheck;
    }

    // Sample terrain so impossible cliff roads are rejected.
    const samples =
      Math.max(
        2,
        Math.ceil(length / 64)
      );

    let previousY =
      terrainY(a.x, a.z);

    for (let i = 1; i <= samples; i++) {
      const k = i / samples;

      const x =
        a.x + (b.x - a.x) * k;

      const z =
        a.z + (b.z - a.z) * k;

      const y =
        terrainY(x, z);

      const horizontal =
        length / samples;

      const grade =
        Math.abs(y - previousY) /
        Math.max(1, horizontal);

      if (grade > 0.26) {
        return {
          allowed: false,
          reason:
            "Terrain is too steep for this road."
        };
      }

      previousY = y;
    }

    return {
      allowed: true,
      reason:
        startCheck.reason
    };
  }

  function updatePreview(point) {
    if (!startPoint || !point) return;

    const mesh = makePreview();
    const def =
      R().ROAD_TYPES[roadType];

    const dx =
      point.x - startPoint.x;

    const dz =
      point.z - startPoint.z;

    const length =
      Math.hypot(dx, dz);

    const cx =
      (point.x + startPoint.x) / 2;

    const cz =
      (point.z + startPoint.z) / 2;

    const check =
      validateRoadPath(
        startPoint,
        point
      );

    mesh.scaling.set(
      Number(def?.width || 14),
      1,
      Math.max(1, length)
    );

    mesh.position.set(
      cx,
      terrainY(cx, cz) + 0.8,
      cz
    );

    mesh.rotation.y =
      Math.atan2(dx, dz);

    mesh.setEnabled(true);

    previewMat.diffuseColor =
      check.allowed
        ? new BABYLON.Color3(
            0.20,
            0.92,
            0.60
          )
        : new BABYLON.Color3(
            0.95,
            0.24,
            0.20
          );

    previewMat.emissiveColor =
      check.allowed
        ? new BABYLON.Color3(
            0.04,
            0.18,
            0.10
          )
        : new BABYLON.Color3(
            0.20,
            0.03,
            0.03
          );

    const estimate =
      R().estimateSegment(
        activeTerritory().id,
        {
          ax: startPoint.x,
          az: startPoint.z,
          bx: point.x,
          bz: point.z,
          type: roadType
        }
      );

    updateMessage(
      check.allowed
        ? `${Math.round(estimate.length)}m • $${estimate.cost.toLocaleString()} • click to build`
        : check.reason,
      check.allowed ? "good" : "bad"
    );
  }

  function save() {
    const t = activeTerritory();

    if (!t) return;

    R().saveLocal(
      worldType(),
      t.id
    );
  }

  function buildRoad(endPoint) {
    const t = activeTerritory();

    if (!t || !startPoint) return;

    const check =
      validateRoadPath(
        startPoint,
        endPoint
      );

    if (!check.allowed) {
      updateMessage(
        check.reason,
        "bad"
      );
      return;
    }

    const estimate =
      R().estimateSegment(
        t.id,
        {
          ax: startPoint.x,
          az: startPoint.z,
          bx: endPoint.x,
          bz: endPoint.z,
          type: roadType
        }
      );

    if (
      !window.mapGameEconomy
        ?.spend?.({
          money: estimate.cost
        })
    ) {
      updateMessage(
        "Not enough money for this road.",
        "bad"
      );

      return;
    }

    let created;

    try {
      created =
        R().addConnectedSegment(
          t.id,
          {
            ax: startPoint.x,
            az: startPoint.z,
            bx: endPoint.x,
            bz: endPoint.z,
            type: roadType,
            capitalPoint:
              activeCapital(),
            snapDistance: 34
          }
        );
    } catch (error) {
      // Give the money back if graph construction fails.
      window.mapGameEconomy
        ?.credit?.(
          "money",
          estimate.cost
        );

      updateMessage(
        error.message ||
        "Could not build road.",
        "bad"
      );

      return;
    }

    save();

    // New crossing points can split old segments, so do a clean visual refresh.
    clearRendered();
    ensureRoadRoot();
    refreshVisible(true);

    const last =
      created?.[created.length - 1];

    if (last) {
      const g =
        R().graphFor(t.id);

      const endNode =
        g.nodes.get(last.b);

      startPoint =
        endNode
          ? {
              x: endNode.x,
              z: endNode.z
            }
          : {
              x: endPoint.x,
              z: endPoint.z
            };

      updateMessage(
        `${R().ROAD_TYPES[roadType]?.label || "Road"} built • continue from endpoint or press Esc.`,
        "good"
      );
    } else {
      clearStart();
    }
  }

  function pickedRoadSegment() {
    const rt = runtime();

    const pick =
      rt?.scene?.pick(
        rt.scene.pointerX,
        rt.scene.pointerY,
        mesh =>
          Boolean(
            mesh?.metadata?.roadPick
          )
      );

    return (
      pick?.hit
        ? pick.pickedMesh
            ?.metadata
            ?.roadSegmentId
        : null
    );
  }

  function inspectSegment(id) {
    const t = activeTerritory();

    const segment =
      t
        ? R().graphFor(t.id)
            .segments.get(id)
        : null;

    if (!segment) return;

    const def =
      R().ROAD_TYPES[segment.type];

    updateMessage(
      `${def?.label || segment.type} • ${Math.round(segment.length)}m • ${segment.lanes} lanes • speed ${segment.speed}`,
      "good"
    );
  }

  function upgradeRoad(id) {
    const t = activeTerritory();

    if (!t) return;

    const current =
      R().graphFor(t.id)
        .segments.get(id);

    if (!current) return;

    if (
      roadRank[roadType] <=
      roadRank[current.type]
    ) {
      updateMessage(
        "Select a higher road class before upgrading.",
        "bad"
      );

      return;
    }

    const target =
      R().ROAD_TYPES[roadType];

    const newCost =
      Math.ceil(
        current.length / 100 *
        Number(
          target.costPer100m || 0
        )
      );

    const upgradeCost =
      Math.max(
        0,
        newCost -
        Number(current.cost || 0)
      );

    if (
      !window.mapGameEconomy
        ?.spend?.({
          money: upgradeCost
        })
    ) {
      updateMessage(
        `Upgrade costs $${upgradeCost.toLocaleString()}.`,
        "bad"
      );

      return;
    }

    try {
      R().upgradeSegment(
        t.id,
        id,
        roadType
      );
    } catch (error) {
      window.mapGameEconomy
        ?.credit?.(
          "money",
          upgradeCost
        );

      updateMessage(
        error.message,
        "bad"
      );

      return;
    }

    save();
    rebuildSegmentVisual(id);

    updateMessage(
      `Upgraded to ${target.label} • $${upgradeCost.toLocaleString()}.`,
      "good"
    );
  }

  function deleteRoad(id) {
    const t = activeTerritory();

    if (!t) return;

    if (
      R().removeSegment(
        t.id,
        id
      )
    ) {
      save();

      if (rendered.has(id)) {
        disposeNode(
          rendered.get(id)
        );
        rendered.delete(id);
      }

      refreshVisible(true);

      updateMessage(
        "Road segment removed.",
        "good"
      );
    }
  }

  function onPointer(info) {
    if (!open) return;

    if (
      runtime()?.getMode?.() !== "TERRITORY"
    ) {
      return;
    }

    if (
      info.type !==
        BABYLON.PointerEventTypes.POINTERMOVE &&
      info.type !==
        BABYLON.PointerEventTypes.POINTERDOWN
    ) {
      return;
    }

    if (mode === "build") {
      const point =
        groundPoint();

      if (!point) return;

      if (
        info.type ===
        BABYLON.PointerEventTypes.POINTERMOVE
      ) {
        if (startPoint) {
          updatePreview(point);
        }

        return;
      }

      if (!startPoint) {
        const t = activeTerritory();

        const check =
          R().validateConnectedStart(
            t.id,
            point,
            activeCapital(),
            {
              snapDistance: 34,
              capitalStartDistance: 145
            }
          );

        if (!check.allowed) {
          updateMessage(
            check.reason,
            "bad"
          );

          return;
        }

        const snapped =
          R().snapPoint(
            t.id,
            point.x,
            point.z,
            34,
            {
              // Do not mutate the graph until the road is actually built.
              allowSplit: false
            }
          );

        startPoint = {
          x: snapped.x,
          z: snapped.z
        };

        updateMessage(
          "Start selected • click the endpoint.",
          "good"
        );

        return;
      }

      buildRoad(point);
      return;
    }

    if (
      info.type !==
      BABYLON.PointerEventTypes.POINTERDOWN
    ) {
      return;
    }

    const id =
      pickedRoadSegment();

    if (!id) {
      updateMessage(
        "Click directly on a road segment.",
        "bad"
      );
      return;
    }

    if (mode === "inspect") {
      inspectSegment(id);
    } else if (mode === "upgrade") {
      upgradeRoad(id);
    } else if (mode === "delete") {
      deleteRoad(id);
    }
  }

  function enterTerritory(territoryId) {
    if (!territoryId || !R()) return;

    if (activeTerritoryId === territoryId) {
      refreshVisible(true);
      return;
    }

    clearRendered();
    activeTerritoryId = territoryId;

    R().loadLocal(
      worldType(),
      territoryId
    );

    ensureRoadRoot();
    refreshVisible(true);
  }

  function leaveTerritory() {
    closeTool();
    activeTerritoryId = null;
    clearRendered();
  }

  function frameTick() {
    if (!runtime()?.scene) return;

    const now = performance.now();

    if (
      now - lastStreamRefresh > 700
    ) {
      lastStreamRefresh = now;
      refreshVisible();
    }
  }

  function bindRuntime() {
    const rt = runtime();

    if (!rt?.scene) return;

    rt.scene
      .onPointerObservable
      .add(onPointer);

    rt.scene
      .onBeforeRenderObservable
      .add(frameTick);
  }

  window.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        open
      ) {
        if (startPoint) {
          clearStart();
          updateMessage(
            "Road placement cancelled."
          );
        } else {
          closeTool();
        }
      }
    }
  );

  window.mapGameRoadTool = {
    VERSION: "0.2.2C1",
    open: openTool,
    close: closeTool,
    isOpen: () => open,
    enterTerritory,
    leaveTerritory,
    refreshVisible
  };

  window.addEventListener(
    "mapgame:runtime-ready",
    bindRuntime,
    { once: true }
  );

  console.log(
    "Map Game road tool 0.2.2C1 ready."
  );
})();
