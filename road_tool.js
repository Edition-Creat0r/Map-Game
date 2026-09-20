// ============================================================
// MAP GAME — road_tool.js
// Alpha 0.2.2C1.5 — Road Tool overhaul
//
// Features in this pass:
// - curved roads
// - full ghost preview
// - sidewalks on city roads
// - intersection pads
// - yellow pedestrian crossings
// - elevation control / overpasses
// - bridge piers
// - same-height crossing = intersection
// - different-height crossing = grade separation
//
// Signs / props intentionally come later.
// ============================================================
(() => {
  "use strict";

  const R =
    () => window.mapGameRoads;

  const C =
    () => window.mapGameWorldConfig;

  const runtime =
    () => window.mapGameRuntime;

  let panel = null;
  let open = false;
  let mode = "build";
  let roadType = "road2";

  let startPoint = null;
  let curveAmount = 0;
  let elevationOffset = 0;

  let previewRoot = null;
  let roadRoot = null;
  let activeTerritoryId = null;

  let rendered = new Map();
  let renderedJunctions = new Map();

  let lastStreamRefresh = 0;

  const roadRank = {
    dirt: 0,
    road2: 1,
    avenue4: 2,
    highway: 3,
    freeway: 4
  };

  const roadRules = {
    dirt: {
      sidewalk: false,
      crossings: false
    },
    road2: {
      sidewalk: true,
      crossings: true
    },
    avenue4: {
      sidewalk: true,
      crossings: true
    },
    highway: {
      sidewalk: false,
      crossings: false
    },
    freeway: {
      sidewalk: false,
      crossings: false
    }
  };

  let mats = null;

  function activeTerritory() {
    return (
      runtime()
        ?.getActiveTerritory?.() ||
      null
    );
  }

  function activeCapital() {
    return (
      runtime()
        ?.getActiveCapital?.() ||
      null
    );
  }

  function worldType() {
    return (
      runtime()
        ?.worldType?.() ||
      "singleplayer"
    );
  }

  function graph() {
    const t =
      activeTerritory();

    return t && R()
      ? R().graphFor(t.id)
      : null;
  }

  function terrainY(x, z) {
    const t =
      activeTerritory();

    if (!t) return 0;

    return (
      window.mapGameTerritory
        ?.heightAt?.(
          x,
          z,
          t.biome,
          t.x,
          t.y,
          C()?.TERRITORY_SIZE ||
            32768
        ) ?? 0
    );
  }

  function disposeNode(node) {
    try {
      node?.dispose?.(
        false,
        false
      );
    } catch (_) {}
  }

  function ensureMaterials() {
    if (
      mats ||
      !runtime()?.scene
    ) {
      return mats;
    }

    const scene =
      runtime().scene;

    const roadSet =
      window.mapGameMaterials
        ?.getRoadSet?.(
          scene,
          runtime().graphicsPreset ||
            "BASIC"
        );

    function simple(
      name,
      color,
      emissive = null,
      alpha = 1
    ) {
      const m =
        new BABYLON.StandardMaterial(
          name,
          scene
        );

      m.diffuseColor =
        BABYLON.Color3.FromHexString(
          color
        );

      m.specularColor =
        new BABYLON.Color3(
          0.05,
          0.05,
          0.05
        );

      if (emissive) {
        m.emissiveColor =
          BABYLON.Color3.FromHexString(
            emissive
          );
      }

      m.alpha = alpha;
      return m;
    }

    mats = {
      asphalt:
        roadSet?.asphalt ||
        simple(
          "c15Asphalt",
          "#2a2f33"
        ),

      sidewalk:
        roadSet?.pavement ||
        simple(
          "c15Sidewalk",
          "#9da3a2"
        ),

      curb:
        roadSet?.curb ||
        simple(
          "c15Curb",
          "#b9bebc"
        ),

      lane:
        simple(
          "c15Lane",
          "#d8d5bd"
        ),

      crossing:
        simple(
          "c15Crossing",
          "#e7bb2f",
          "#4a3904"
        ),

      pier:
        simple(
          "c15Pier",
          "#71787a"
        ),

      ghostValid:
        simple(
          "c15GhostValid",
          "#46d9b0",
          "#123f35",
          0.48
        ),

      ghostWarn:
        simple(
          "c15GhostWarn",
          "#e0ae3b",
          "#4d3606",
          0.50
        ),

      ghostBad:
        simple(
          "c15GhostBad",
          "#ef625d",
          "#4a1110",
          0.50
        )
    };

    return mats;
  }

  function ensureRoadRoot() {
    if (
      roadRoot ||
      !runtime()?.scene
    ) {
      return roadRoot;
    }

    roadRoot =
      new BABYLON.TransformNode(
        "playerRoadStreamRoot",
        runtime().scene
      );

    return roadRoot;
  }

  function clearPreview() {
    disposeNode(
      previewRoot
    );

    previewRoot = null;
  }

  function clearRendered() {
    for (
      const node of
      rendered.values()
    ) {
      disposeNode(node);
    }

    for (
      const node of
      renderedJunctions.values()
    ) {
      disposeNode(node);
    }

    rendered.clear();
    renderedJunctions.clear();

    disposeNode(
      roadRoot
    );

    roadRoot = null;
  }

  function visibleRadius() {
    const preset =
      String(
        localStorage.getItem(
          "mapgame_render_distance"
        ) || "low"
      ).toLowerCase();

    const radius =
      C()
        ?.RENDER_DISTANCE_PRESETS
        ?.[preset] ??
      (
        preset === "high"
          ? 4
          : preset === "medium"
            ? 3
            : 2
      );

    return (
      (
        Number(radius) +
        1.5
      ) *
      Number(
        C()?.SECTOR_SIZE ||
        512
      )
    );
  }

  function segmentNearCamera(
    segment
  ) {
    const rt =
      runtime();

    if (
      !rt?.camera ||
      !segment?.path?.length
    ) {
      return false;
    }

    let cx = 0;
    let cz = 0;

    for (
      const p of
      segment.path
    ) {
      cx += p.x;
      cz += p.z;
    }

    cx /=
      segment.path.length;

    cz /=
      segment.path.length;

    const distance =
      Math.hypot(
        cx -
          rt.camera.target.x,
        cz -
          rt.camera.target.z
      );

    return (
      distance <=
      visibleRadius() +
        segment.length / 2
    );
  }

  function roadHasSidewalk(
    type
  ) {
    return Boolean(
      roadRules[type]
        ?.sidewalk
    );
  }

  function roadHasCrossings(
    type
  ) {
    return Boolean(
      roadRules[type]
        ?.crossings
    );
  }

  function pathPiece(
    parent,
    a,
    b,
    width,
    material,
    {
      height = 0.28,
      yOffset = 0,
      lateral = 0,
      extraLength = 0.8,
      name = "roadPiece"
    } = {}
  ) {
    const scene =
      runtime().scene;

    const dx =
      b.x - a.x;

    const dz =
      b.z - a.z;

    const horizontal =
      Math.hypot(
        dx,
        dz
      );

    if (
      horizontal < 0.05
    ) {
      return null;
    }

    const angle =
      Math.atan2(
        dx,
        dz
      );

    const nx =
      Math.cos(angle);

    const nz =
      -Math.sin(angle);

    const mesh =
      BABYLON.MeshBuilder.CreateBox(
        name,
        {
          width,
          height,
          depth:
            horizontal +
            extraLength
        },
        scene
      );

    mesh.position.set(
      (a.x + b.x) / 2 +
        nx * lateral,
      (a.y + b.y) / 2 +
        yOffset,
      (a.z + b.z) / 2 +
        nz * lateral
    );

    mesh.rotation.y =
      angle;

    // Tilt along vertical grade.
    mesh.rotation.x =
      -Math.atan2(
        b.y - a.y,
        horizontal
      );

    mesh.material =
      material;

    mesh.parent =
      parent;

    mesh.receiveShadows =
      true;

    mesh.isPickable =
      false;

    return mesh;
  }

  function laneDashes(
    parent,
    a,
    b,
    width,
    material,
    lanes
  ) {
    const horizontal =
      Math.hypot(
        b.x - a.x,
        b.z - a.z
      );

    if (
      horizontal < 14
    ) {
      return;
    }

    const dashCount =
      Math.max(
        1,
        Math.floor(
          horizontal / 18
        )
      );

    const dx =
      b.x - a.x;

    const dz =
      b.z - a.z;

    const angle =
      Math.atan2(
        dx,
        dz
      );

    for (
      let i = 0;
      i < dashCount;
      i++
    ) {
      if (
        i % 2 !== 0
      ) {
        continue;
      }

      const t =
        (i + 0.5) /
        dashCount;

      const y =
        a.y +
        (b.y - a.y) * t;

      const mesh =
        BABYLON.MeshBuilder.CreateBox(
          "roadLaneDash",
          {
            width: 0.45,
            height: 0.05,
            depth:
              Math.min(
                6,
                horizontal /
                  dashCount *
                  0.72
              )
          },
          runtime().scene
        );

      mesh.position.set(
        a.x + dx * t,
        y + 0.38,
        a.z + dz * t
      );

      mesh.rotation.y =
        angle;

      mesh.rotation.x =
        -Math.atan2(
          b.y - a.y,
          horizontal
        );

      mesh.material =
        material;

      mesh.parent =
        parent;

      mesh.isPickable =
        false;
    }
  }

  function buildBridgePiers(
    parent,
    segment
  ) {
    if (
      !segment?.path?.length
    ) {
      return;
    }

    const points =
      segment.path;

    let accumulated = 0;
    let nextPierAt = 42;

    for (
      let i = 1;
      i < points.length;
      i++
    ) {
      const a =
        points[i - 1];

      const b =
        points[i];

      const step =
        Math.hypot(
          b.x - a.x,
          b.z - a.z
        );

      accumulated +=
        step;

      if (
        accumulated <
        nextPierAt
      ) {
        continue;
      }

      nextPierAt += 42;

      const x =
        (a.x + b.x) / 2;

      const z =
        (a.z + b.z) / 2;

      const roadY =
        (a.y + b.y) / 2;

      const ground =
        terrainY(x, z);

      const clearance =
        roadY - ground;

      if (
        clearance < 4.5
      ) {
        continue;
      }

      const pier =
        BABYLON.MeshBuilder
          .CreateBox(
            "bridgePier",
            {
              width: 2.2,
              height:
                Math.max(
                  1,
                  clearance - 0.5
                ),
              depth: 2.2
            },
            runtime().scene
          );

      pier.position.set(
        x,
        ground +
          clearance / 2,
        z
      );

      pier.material =
        ensureMaterials()
          .pier;

      pier.parent =
        parent;

      pier.isPickable =
        false;
    }
  }

  function buildRoadVisual(
    segment,
    {
      ghost = false,
      ghostState = "valid"
    } = {}
  ) {
    const rt =
      runtime();

    if (
      !rt?.scene ||
      !segment?.path?.length
    ) {
      return null;
    }

    const root =
      new BABYLON.TransformNode(
        ghost
          ? "roadGhost"
          : `roadVisual_${segment.id}`,
        rt.scene
      );

    root.parent =
      ghost
        ? null
        : ensureRoadRoot();

    const materials =
      ensureMaterials();

    const spec =
      R().ROAD_TYPES[
        segment.type
      ] || {};

    const width =
      Number(
        segment.width ||
        spec.width ||
        14
      );

    const sidewalk =
      roadHasSidewalk(
        segment.type
      );

    const roadMaterial =
      ghost
        ? (
            ghostState ===
            "bad"
              ? materials.ghostBad
              : ghostState ===
                "warn"
                  ? materials.ghostWarn
                  : materials.ghostValid
          )
        : materials.asphalt;

    for (
      let i = 1;
      i < segment.path.length;
      i++
    ) {
      const a =
        segment.path[i - 1];

      const b =
        segment.path[i];

      pathPiece(
        root,
        a,
        b,
        width,
        roadMaterial,
        {
          height:
            ghost
              ? 0.34
              : 0.28,
          yOffset:
            ghost
              ? 0.45
              : 0.42,
          name:
            ghost
              ? "roadGhostSurface"
              : "roadSurface"
        }
      );

      if (
        sidewalk &&
        !ghost
      ) {
        const sideOffset =
          width / 2 + 3.1;

        for (
          const side of
          [-1, 1]
        ) {
          pathPiece(
            root,
            a,
            b,
            5.4,
            materials.sidewalk,
            {
              height: 0.30,
              yOffset: 0.35,
              lateral:
                side *
                sideOffset,
              name:
                "roadSidewalk"
            }
          );

          pathPiece(
            root,
            a,
            b,
            0.58,
            materials.curb,
            {
              height: 0.42,
              yOffset: 0.42,
              lateral:
                side *
                (
                  width / 2 +
                  0.35
                ),
              name:
                "roadCurb"
            }
          );
        }
      }

      if (
        !ghost &&
        segment.type !==
          "dirt"
      ) {
        laneDashes(
          root,
          a,
          b,
          width,
          materials.lane,
          segment.lanes
        );
      }

      if (
        ghost &&
        sidewalk
      ) {
        const sideOffset =
          width / 2 + 3.1;

        for (
          const side of
          [-1, 1]
        ) {
          pathPiece(
            root,
            a,
            b,
            5.0,
            roadMaterial,
            {
              height: 0.18,
              yOffset: 0.31,
              lateral:
                side *
                sideOffset,
              name:
                "ghostSidewalk"
            }
          );
        }
      }
    }

    if (!ghost) {
      buildBridgePiers(
        root,
        segment
      );

      // Invisible hit pieces for inspect/delete/upgrade.
      for (
        let i = 1;
        i < segment.path.length;
        i++
      ) {
        const a =
          segment.path[i - 1];

        const b =
          segment.path[i];

        const pick =
          pathPiece(
            root,
            a,
            b,
            width + 7,
            materials.asphalt,
            {
              height: 3,
              yOffset: 1.4,
              name:
                `roadPick_${segment.id}`
            }
          );

        if (pick) {
          pick.visibility =
            0.001;

          pick.isPickable =
            true;

          pick.metadata = {
            roadPick: true,
            roadSegmentId:
              segment.id
          };
        }
      }
    }

    return root;
  }

  function nodeConnections(
    nodeId
  ) {
    const g = graph();
    if (!g) return [];

    const out = [];

    for (
      const segment of
      g.segments.values()
    ) {
      if (
        segment.a ===
        nodeId ||
        segment.b ===
        nodeId
      ) {
        out.push(
          segment
        );
      }
    }

    return out;
  }

  function directionAwayFromNode(
    segment,
    nodeId
  ) {
    const path =
      segment.path || [];

    if (
      path.length < 2
    ) {
      return null;
    }

    if (
      segment.a ===
      nodeId
    ) {
      const a = path[0];
      const b = path[1];

      return {
        x: b.x - a.x,
        z: b.z - a.z,
        y: b.y - a.y
      };
    }

    const a =
      path[
        path.length - 1
      ];

    const b =
      path[
        path.length - 2
      ];

    return {
      x: b.x - a.x,
      z: b.z - a.z,
      y: b.y - a.y
    };
  }

  function createCrosswalk(
    parent,
    node,
    segment
  ) {
    if (
      !roadHasCrossings(
        segment.type
      )
    ) {
      return;
    }

    const direction =
      directionAwayFromNode(
        segment,
        node.id
      );

    if (!direction) return;

    const length =
      Math.hypot(
        direction.x,
        direction.z
      );

    if (
      length < 0.01
    ) {
      return;
    }

    const tx =
      direction.x / length;

    const tz =
      direction.z / length;

    const nx = -tz;
    const nz = tx;

    const width =
      Number(
        segment.width ||
        14
      );

    const setback =
      width / 2 + 3.7;

    const centerX =
      node.x +
      tx * setback;

    const centerZ =
      node.z +
      tz * setback;

    const stripeCount =
      Math.max(
        5,
        Math.min(
          9,
          Math.round(
            width / 3
          )
        )
      );

    for (
      let i = 0;
      i < stripeCount;
      i++
    ) {
      const sideT =
        stripeCount === 1
          ? 0
          : (
              i /
                (stripeCount - 1) -
              0.5
            );

      const lateral =
        sideT *
        (
          width -
          1.5
        );

      const stripe =
        BABYLON.MeshBuilder
          .CreateBox(
            "yellowPedCrossing",
            {
              width: 1.25,
              height: 0.06,
              depth: 3.2
            },
            runtime().scene
          );

      stripe.position.set(
        centerX +
          nx * lateral,
        Number(
          node.y || 0
        ) + 0.63,
        centerZ +
          nz * lateral
      );

      stripe.rotation.y =
        Math.atan2(
          nx,
          nz
        );

      stripe.material =
        ensureMaterials()
          .crossing;

      stripe.parent =
        parent;

      stripe.isPickable =
        false;
    }
  }

  function buildIntersectionVisual(
    node
  ) {
    const connections =
      nodeConnections(
        node.id
      );

    if (
      connections.length < 3
    ) {
      return null;
    }

    // Freeway-only junctions will eventually get interchange geometry.
    const urbanConnections =
      connections.filter(
        seg =>
          roadHasSidewalk(
            seg.type
          )
      );

    const maxWidth =
      Math.max(
        14,
        ...connections.map(
          seg =>
            Number(
              seg.width || 14
            )
        )
      );

    const root =
      new BABYLON.TransformNode(
        `intersection_${node.id}`,
        runtime().scene
      );

    root.parent =
      ensureRoadRoot();

    const materials =
      ensureMaterials();

    if (
      urbanConnections.length
    ) {
      const sidewalkPad =
        BABYLON.MeshBuilder
          .CreateCylinder(
            "intersectionSidewalkPad",
            {
              diameter:
                maxWidth + 15,
              height: 0.30,
              tessellation: 20
            },
            runtime().scene
          );

      sidewalkPad.position.set(
        node.x,
        Number(
          node.y || 0
        ) + 0.32,
        node.z
      );

      sidewalkPad.material =
        materials.sidewalk;

      sidewalkPad.parent =
        root;

      sidewalkPad.isPickable =
        false;
    }

    const roadPad =
      BABYLON.MeshBuilder
        .CreateCylinder(
          "intersectionRoadPad",
          {
            diameter:
              maxWidth + 4,
            height: 0.30,
            tessellation: 22
          },
          runtime().scene
        );

    roadPad.position.set(
      node.x,
      Number(
        node.y || 0
      ) + 0.48,
      node.z
    );

    roadPad.material =
      materials.asphalt;

    roadPad.parent =
      root;

    roadPad.isPickable =
      false;

    // Requested yellow pedestrian crossings.
    for (
      const segment of
      connections
    ) {
      createCrosswalk(
        root,
        node,
        segment
      );
    }

    return root;
  }

  function refreshJunctions() {
    const g = graph();
    if (!g) return;

    const needed =
      new Set();

    for (
      const node of
      g.nodes.values()
    ) {
      const count =
        nodeConnections(
          node.id
        ).length;

      if (
        count >= 3 &&
        Math.hypot(
          node.x -
            runtime().camera.target.x,
          node.z -
            runtime().camera.target.z
        ) <=
          visibleRadius()
      ) {
        needed.add(
          node.id
        );

        if (
          !renderedJunctions.has(
            node.id
          )
        ) {
          const visual =
            buildIntersectionVisual(
              node
            );

          if (visual) {
            renderedJunctions.set(
              node.id,
              visual
            );
          }
        }
      }
    }

    for (
      const [
        id,
        visual
      ] of
      renderedJunctions
    ) {
      if (
        !needed.has(id)
      ) {
        disposeNode(
          visual
        );

        renderedJunctions.delete(
          id
        );
      }
    }
  }

  function refreshVisible(
    force = false
  ) {
    const t =
      activeTerritory();

    if (
      !t ||
      !R()
    ) {
      clearRendered();
      return;
    }

    if (
      activeTerritoryId !==
      t.id
    ) {
      enterTerritory(
        t.id
      );
      return;
    }

    const g =
      R().graphFor(t.id);

    for (
      const segment of
      g.segments.values()
    ) {
      const should =
        segmentNearCamera(
          segment
        );

      if (
        should &&
        !rendered.has(
          segment.id
        )
      ) {
        const visual =
          buildRoadVisual(
            segment
          );

        if (visual) {
          rendered.set(
            segment.id,
            visual
          );
        }
      } else if (
        !should &&
        rendered.has(
          segment.id
        )
      ) {
        disposeNode(
          rendered.get(
            segment.id
          )
        );

        rendered.delete(
          segment.id
        );
      }
    }

    for (
      const id of
      [...rendered.keys()]
    ) {
      if (
        !g.segments.has(id)
      ) {
        disposeNode(
          rendered.get(id)
        );

        rendered.delete(id);
      }
    }

    refreshJunctions();
    updateStats();
  }

  function createPanel() {
    if (panel) return panel;

    panel =
      document.createElement(
        "aside"
      );

    panel.id =
      "mgRoadTool";

    panel.className =
      "mg-road-tool mg-road-tool-c15";

    panel.hidden = true;

    panel.innerHTML = `
      <header class="mg-road-tool-head">
        <div>
          <div class="mg-kicker">INFRASTRUCTURE • C1.5</div>
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

      <section class="mg-road-shape-panel">
        <div class="mg-road-section-label">ALIGNMENT</div>

        <label class="mg-road-range">
          <span>
            <b>CURVE</b>
            <output id="mgRoadCurveValue">STRAIGHT</output>
          </span>
          <input id="mgRoadCurve" type="range" min="-100" max="100" step="5" value="0">
        </label>

        <div class="mg-road-elevation">
          <div>
            <b>ELEVATION</b>
            <small id="mgRoadElevationValue">GROUND</small>
          </div>
          <div class="mg-road-stepper">
            <button type="button" data-elev="-4">−4m</button>
            <button type="button" data-elev="0">GROUND</button>
            <button type="button" data-elev="4">+4m</button>
          </div>
        </div>

        <p class="mg-road-help">
          Raise a road before crossing another road to make an overpass. Start a new road from the elevated road to create a ramp back down.
        </p>
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
        Click near your capital to start the road network.
      </div>

      <footer class="mg-road-foot">
        <span>CLICK START</span>
        <span>MOVE FOR GHOST</span>
        <span>CLICK BUILD</span>
        <span>ESC CANCEL</span>
      </footer>
    `;

    document.body.appendChild(
      panel
    );

    panel
      .querySelector(
        "[data-road-close]"
      )
      .addEventListener(
        "click",
        closeTool
      );

    panel
      .querySelectorAll(
        "[data-road-mode]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            setMode(
              button.dataset
                .roadMode
            );
          }
        );
      });

    const curve =
      panel.querySelector(
        "#mgRoadCurve"
      );

    curve.addEventListener(
      "input",
      () => {
        curveAmount =
          Number(
            curve.value
          ) / 100;

        paintCurveValue();
      }
    );

    panel
      .querySelectorAll(
        "[data-elev]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const step =
              Number(
                button.dataset
                  .elev
              );

            if (step === 0) {
              elevationOffset = 0;
            } else {
              elevationOffset =
                Math.max(
                  -12,
                  Math.min(
                    40,
                    elevationOffset +
                      step
                  )
                );
            }

            paintElevation();
          }
        );
      });

    buildRoadTypeButtons();
    paintCurveValue();
    paintElevation();

    return panel;
  }

  function paintCurveValue() {
    const out =
      panel?.querySelector(
        "#mgRoadCurveValue"
      );

    if (!out) return;

    if (
      Math.abs(
        curveAmount
      ) < 0.02
    ) {
      out.textContent =
        "STRAIGHT";
      return;
    }

    out.textContent =
      `${Math.round(
        Math.abs(
          curveAmount
        ) * 100
      )}% ${
        curveAmount < 0
          ? "LEFT"
          : "RIGHT"
      }`;
  }

  function paintElevation() {
    const out =
      panel?.querySelector(
        "#mgRoadElevationValue"
      );

    if (!out) return;

    out.textContent =
      Math.abs(
        elevationOffset
      ) < 0.01
        ? "GROUND"
        : `${
            elevationOffset >
            0
              ? "+"
              : ""
          }${elevationOffset}m`;
  }

  function buildRoadTypeButtons() {
    const list =
      panel?.querySelector(
        "#mgRoadTypeList"
      );

    if (!list) return;

    list.innerHTML = "";

    for (
      const id of
      R()?.ROAD_ORDER || []
    ) {
      const def =
        R().ROAD_TYPES[id];

      if (!def) continue;

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.dataset
        .roadType = id;

      button.className =
        "mg-road-type";

      const sidewalk =
        roadHasSidewalk(id)
          ? " • sidewalks"
          : "";

      button.innerHTML = `
        <span class="mg-road-type-line" style="--road-width:${Math.max(2, Math.min(7, def.lanes || 2))}px"></span>
        <span class="mg-road-type-copy">
          <strong>${def.label}</strong>
          <small>${def.lanes} lanes • ${def.speed}${sidewalk}</small>
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

      list.appendChild(
        button
      );
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
          button.dataset
            .roadType ===
            roadType
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
          button.dataset
            .roadMode ===
            mode
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
        "Click a connected start point. Move the cursor to preview the exact road."
      );
    } else if (
      mode === "upgrade"
    ) {
      updateMessage(
        "Choose a higher road class, then click a road."
      );
    } else if (
      mode === "delete"
    ) {
      updateMessage(
        "Click a road segment to remove it."
      );
    } else {
      updateMessage(
        "Click a road segment to inspect its length, grade and elevation."
      );
    }
  }

  function updateMessage(
    text,
    kind = ""
  ) {
    const el =
      panel?.querySelector(
        "#mgRoadMessage"
      );

    if (!el) return;

    el.textContent =
      text;

    el.dataset.kind =
      kind;
  }

  function updateStats() {
    const t =
      activeTerritory();

    const el =
      panel?.querySelector(
        "#mgRoadNetworkReadout"
      );

    if (!el) return;

    const count =
      t
        ? R().graphFor(t.id)
            .segments.size
        : 0;

    el.textContent =
      `${count} SEGMENT${
        count === 1
          ? ""
          : "S"
      }`;
  }

  function canOpenHere() {
    const t =
      activeTerritory();

    if (!t) {
      runtime()?.showToast?.(
        "Enter a territory before building roads.",
        "info"
      );

      return false;
    }

    const capital =
      activeCapital();

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
    if (
      !canOpenHere()
    ) {
      return;
    }

    createPanel();

    enterTerritory(
      activeTerritory().id
    );

    open = true;
    panel.hidden = false;

    setMode(mode);
    refreshVisible(true);

    runtime()
      ?.setBottomStatus?.(
        "<b>ROAD TOOL</b> • curved roads • sidewalks • elevation • overpasses"
      );

    document
      .querySelector(
        "#mgDock [data-action='infrastructure']"
      )
      ?.classList.add(
        "active"
      );
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
      ?.classList.remove(
        "active"
      );

    runtime()
      ?.setBottomStatus?.(
        "Road tool closed."
      );
  }

  function clearStart() {
    startPoint = null;
    clearPreview();
  }

  function groundPoint() {
    const rt =
      runtime();

    if (!rt?.scene) {
      return null;
    }

    return (
      window.mapGameTerritoryStream
        ?.pickGround?.(
          rt.scene.pointerX,
          rt.scene.pointerY
        ) || null
    );
  }

  function endRoadY(
    point
  ) {
    return (
      Number(
        point.y ||
        terrainY(
          point.x,
          point.z
        )
      ) +
      elevationOffset
    );
  }

  function maxAllowedGrade(
    type
  ) {
    if (
      type === "freeway"
    ) {
      return 0.075;
    }

    if (
      type === "highway"
    ) {
      return 0.09;
    }

    if (
      type === "avenue4"
    ) {
      return 0.13;
    }

    if (
      type === "road2"
    ) {
      return 0.17;
    }

    return 0.22;
  }

  function minimumCurveRadiusHint(
    type
  ) {
    if (
      type === "freeway"
    ) {
      return 0.58;
    }

    if (
      type === "highway"
    ) {
      return 0.70;
    }

    return 1;
  }

  function validateRoadPath(
    a,
    b
  ) {
    const t =
      activeTerritory();

    if (
      !t ||
      !a ||
      !b
    ) {
      return {
        allowed: false,
        reason:
          "No territory.",
        state: "bad"
      };
    }

    const straightLength =
      Math.hypot(
        b.x - a.x,
        b.z - a.z
      );

    if (
      straightLength < 12
    ) {
      return {
        allowed: false,
        reason:
          "Road is too short.",
        state: "bad"
      };
    }

    if (
      straightLength > 1800
    ) {
      return {
        allowed: false,
        reason:
          "Build long roads in shorter sections (maximum 1.8 km per placement).",
        state: "bad"
      };
    }

    const startCheck =
      R()
        .validateConnectedStart(
          t.id,
          a,
          activeCapital(),
          {
            snapDistance: 36,
            capitalStartDistance: 150
          }
        );

    if (
      !startCheck.allowed
    ) {
      return {
        ...startCheck,
        state: "bad"
      };
    }

    const estimate =
      R().estimateSegment(
        t.id,
        {
          ax: a.x,
          ay: a.y,
          az: a.z,
          bx: b.x,
          by: b.y,
          bz: b.z,
          type: roadType,
          curve:
            curveAmount
        }
      );

    const gradeLimit =
      maxAllowedGrade(
        roadType
      );

    if (
      estimate.maxGrade >
      gradeLimit
    ) {
      return {
        allowed: false,
        reason:
          `Road grade is too steep (${Math.round(estimate.maxGrade * 100)}%).`,
        state: "bad",
        estimate
      };
    }

    const curveLimit =
      minimumCurveRadiusHint(
        roadType
      );

    if (
      Math.abs(
        curveAmount
      ) >
      curveLimit
    ) {
      return {
        allowed: false,
        reason:
          `${R().ROAD_TYPES[roadType]?.label || "This road"} needs a gentler curve.`,
        state: "bad",
        estimate
      };
    }

    let state = "valid";
    let reason =
      startCheck.reason;

    const elevated =
      estimate.path.some(
        p =>
          p.y -
            terrainY(
              p.x,
              p.z
            ) >
          4
      );

    if (elevated) {
      state = "warn";
      reason =
        "Elevated road / bridge • crossings below will remain separate.";
    }

    return {
      allowed: true,
      reason,
      state,
      estimate
    };
  }

  function ghostSegment(
    endPoint
  ) {
    if (
      !startPoint ||
      !endPoint
    ) {
      return null;
    }

    const t =
      activeTerritory();

    if (!t) return null;

    const end = {
      x: endPoint.x,
      y:
        endRoadY(
          endPoint
        ),
      z: endPoint.z
    };

    const estimate =
      R().estimateSegment(
        t.id,
        {
          ax: startPoint.x,
          ay: startPoint.y,
          az: startPoint.z,
          bx: end.x,
          by: end.y,
          bz: end.z,
          type: roadType,
          curve:
            curveAmount
        }
      );

    return {
      id: "GHOST",
      a: "GHOST_A",
      b: "GHOST_B",
      type: roadType,
      width:
        estimate.width,
      lanes:
        estimate.lanes,
      length:
        estimate.length,
      path:
        estimate.path,
      maxGrade:
        estimate.maxGrade
    };
  }

  function updatePreview(
    point
  ) {
    if (
      !startPoint ||
      !point
    ) {
      return;
    }

    clearPreview();

    const end = {
      x: point.x,
      y:
        endRoadY(point),
      z: point.z
    };

    const check =
      validateRoadPath(
        startPoint,
        end
      );

    const ghost =
      ghostSegment(
        point
      );

    if (!ghost) return;

    previewRoot =
      buildRoadVisual(
        ghost,
        {
          ghost: true,
          ghostState:
            check.state ===
            "bad"
              ? "bad"
              : check.state ===
                "warn"
                  ? "warn"
                  : "valid"
        }
      );

    const estimate =
      check.estimate ||
      R().estimateSegment(
        activeTerritory().id,
        {
          ax: startPoint.x,
          ay: startPoint.y,
          az: startPoint.z,
          bx: end.x,
          by: end.y,
          bz: end.z,
          type: roadType,
          curve:
            curveAmount
        }
      );

    const grade =
      Math.round(
        Number(
          estimate.maxGrade || 0
        ) * 100
      );

    const elevationText =
      Math.abs(
        elevationOffset
      ) > 0.1
        ? ` • ${elevationOffset > 0 ? "+" : ""}${elevationOffset}m`
        : "";

    updateMessage(
      check.allowed
        ? `${Math.round(estimate.length)}m • ${grade}% max grade${elevationText} • $${estimate.cost.toLocaleString()} • click to build`
        : check.reason,
      check.allowed
        ? (
            check.state ===
            "warn"
              ? "warn"
              : "good"
          )
        : "bad"
    );
  }

  function save() {
    const t =
      activeTerritory();

    if (!t) return;

    R().saveLocal(
      worldType(),
      t.id
    );
  }

  function refundMoney(
    amount
  ) {
    if (
      !amount ||
      amount <= 0
    ) {
      return;
    }

    window.mapGameEconomy
      ?.credit?.(
        "money",
        amount
      );
  }

  function buildRoad(
    endPoint
  ) {
    const t =
      activeTerritory();

    if (
      !t ||
      !startPoint
    ) {
      return;
    }

    const end = {
      x: endPoint.x,
      y:
        endRoadY(
          endPoint
        ),
      z: endPoint.z
    };

    const check =
      validateRoadPath(
        startPoint,
        end
      );

    if (
      !check.allowed
    ) {
      updateMessage(
        check.reason,
        "bad"
      );

      return;
    }

    const estimate =
      check.estimate;

    if (
      !window.mapGameEconomy
        ?.spend?.({
          money:
            estimate.cost
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
            ax:
              startPoint.x,
            ay:
              startPoint.y,
            az:
              startPoint.z,
            bx: end.x,
            by: end.y,
            bz: end.z,
            type:
              roadType,
            curve:
              curveAmount,
            capitalPoint:
              activeCapital(),
            snapDistance: 36,
            metadata: {
              elevationMode:
                Math.abs(
                  elevationOffset
                ) > 0.1
                  ? "elevated"
                  : "surface"
            }
          }
        );
    } catch (error) {
      refundMoney(
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

    clearRendered();
    ensureRoadRoot();
    refreshVisible(true);

    const last =
      created?.[
        created.length - 1
      ];

    if (last) {
      const g =
        R().graphFor(t.id);

      const node =
        g.nodes.get(
          last.b
        );

      if (node) {
        startPoint = {
          x: node.x,
          y:
            Number(
              node.y || 0
            ),
          z: node.z
        };
      }

      clearPreview();

      updateMessage(
        `${R().ROAD_TYPES[roadType]?.label || "Road"} built • endpoint remains active so you can continue.`,
        "good"
      );
    } else {
      clearStart();
    }
  }

  function pickedRoadSegment() {
    const rt =
      runtime();

    const pick =
      rt?.scene?.pick(
        rt.scene.pointerX,
        rt.scene.pointerY,
        mesh =>
          Boolean(
            mesh?.metadata
              ?.roadPick
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
    const t =
      activeTerritory();

    const segment =
      t
        ? R()
            .graphFor(t.id)
            .segments.get(id)
        : null;

    if (!segment) {
      return;
    }

    const def =
      R().ROAD_TYPES[
        segment.type
      ];

    const heights =
      segment.path.map(
        p => p.y
      );

    const elevationRange =
      Math.max(...heights) -
      Math.min(...heights);

    updateMessage(
      `${def?.label || segment.type} • ${Math.round(segment.length)}m • ${segment.lanes} lanes • ${Math.round((segment.maxGrade || 0) * 100)}% max grade • ${Math.round(elevationRange)}m elevation change`,
      "good"
    );
  }

  function upgradeRoad(id) {
    const t =
      activeTerritory();

    if (!t) return;

    const current =
      R()
        .graphFor(t.id)
        .segments.get(id);

    if (!current) return;

    if (
      roadRank[
        roadType
      ] <=
      roadRank[
        current.type
      ]
    ) {
      updateMessage(
        "Select a higher road class before upgrading.",
        "bad"
      );

      return;
    }

    const target =
      R().ROAD_TYPES[
        roadType
      ];

    const newCost =
      Math.ceil(
        current.length /
          100 *
        Number(
          target
            .costPer100m ||
          0
        )
      );

    const upgradeCost =
      Math.max(
        0,
        newCost -
        Number(
          current.cost ||
          0
        )
      );

    if (
      !window.mapGameEconomy
        ?.spend?.({
          money:
            upgradeCost
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
      refundMoney(
        upgradeCost
      );

      updateMessage(
        error.message,
        "bad"
      );

      return;
    }

    save();

    clearRendered();
    ensureRoadRoot();
    refreshVisible(true);

    updateMessage(
      `Upgraded to ${target.label} • $${upgradeCost.toLocaleString()}.`,
      "good"
    );
  }

  function deleteRoad(id) {
    const t =
      activeTerritory();

    if (!t) return;

    if (
      R().removeSegment(
        t.id,
        id
      )
    ) {
      save();

      clearRendered();
      ensureRoadRoot();
      refreshVisible(true);

      updateMessage(
        "Road segment removed.",
        "good"
      );
    }
  }

  function beginAtPoint(
    point
  ) {
    const t =
      activeTerritory();

    if (!t) return;

    const intendedY =
      Number(
        point.y ||
        terrainY(
          point.x,
          point.z
        )
      );

    const check =
      R()
        .validateConnectedStart(
          t.id,
          {
            x: point.x,
            y: intendedY,
            z: point.z
          },
          activeCapital(),
          {
            snapDistance: 36,
            capitalStartDistance: 150
          }
        );

    if (
      !check.allowed
    ) {
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
        36,
        {
          allowSplit: false,
          y: intendedY,
          verticalTolerance: 5
        }
      );

    startPoint = {
      x: snapped.x,
      y:
        Number(
          snapped.y ??
          intendedY
        ),
      z: snapped.z
    };

    updateMessage(
      "Start selected • move the cursor to see the full ghost road.",
      "good"
    );
  }

  function onPointer(info) {
    if (!open) return;

    if (
      runtime()?.getMode?.() !==
      "TERRITORY"
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

    if (
      mode === "build"
    ) {
      const point =
        groundPoint();

      if (!point) return;

      if (
        info.type ===
        BABYLON.PointerEventTypes.POINTERMOVE
      ) {
        if (startPoint) {
          updatePreview(
            point
          );
        }

        return;
      }

      if (!startPoint) {
        beginAtPoint(
          point
        );
        return;
      }

      buildRoad(
        point
      );

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

    if (
      mode === "inspect"
    ) {
      inspectSegment(id);
    } else if (
      mode === "upgrade"
    ) {
      upgradeRoad(id);
    } else if (
      mode === "delete"
    ) {
      deleteRoad(id);
    }
  }

  function enterTerritory(
    territoryId
  ) {
    if (
      !territoryId ||
      !R()
    ) {
      return;
    }

    if (
      activeTerritoryId ===
      territoryId
    ) {
      refreshVisible(true);
      return;
    }

    clearRendered();

    activeTerritoryId =
      territoryId;

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
    if (
      !runtime()?.scene
    ) {
      return;
    }

    const now =
      performance.now();

    if (
      now -
        lastStreamRefresh >
      700
    ) {
      lastStreamRefresh =
        now;

      refreshVisible();
    }
  }

  function bindRuntime() {
    const rt =
      runtime();

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
      if (!open) return;

      if (
        event.key ===
        "Escape"
      ) {
        if (startPoint) {
          clearStart();

          updateMessage(
            "Road placement cancelled."
          );
        } else {
          closeTool();
        }

        return;
      }

      if (
        event.key ===
        "PageUp"
      ) {
        elevationOffset =
          Math.min(
            40,
            elevationOffset + 4
          );

        paintElevation();
        event.preventDefault();
      }

      if (
        event.key ===
        "PageDown"
      ) {
        elevationOffset =
          Math.max(
            -12,
            elevationOffset - 4
          );

        paintElevation();
        event.preventDefault();
      }

      if (
        event.key.toLowerCase() ===
        "r"
      ) {
        curveAmount = 0;

        const input =
          panel?.querySelector(
            "#mgRoadCurve"
          );

        if (input) {
          input.value = "0";
        }

        paintCurveValue();
      }
    }
  );

  window.mapGameRoadTool = {
    VERSION:
      "0.2.2C1.5",
    open:
      openTool,
    close:
      closeTool,
    isOpen:
      () => open,
    enterTerritory,
    leaveTerritory,
    refreshVisible
  };

  window.addEventListener(
    "mapgame:runtime-ready",
    bindRuntime,
    {
      once: true
    }
  );

  console.log(
    "Map Game Road Tool 0.2.2C1.5 ready — curves, sidewalks, yellow crossings, elevation and overpasses."
  );
})();
