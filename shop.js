// ============================================================
// MAP GAME — shop.js
// Alpha 0.2.1G FINAL VISUAL PASS
//
// Replaces the fake CSS tower with the actual buildings.js renderer.
// The same building renderer is used in the city and in the shop.
// ============================================================

(() => {
  "use strict";

  let canvas = null;
  let engine = null;
  let scene = null;
  let camera = null;
  let previewRoot = null;
  let ground = null;
  let resizeObserver = null;
  let visible = false;
  let currentRequest = null;

  function disposePreviewRoot() {
    if (!previewRoot) return;
    try { previewRoot.dispose(false, false); } catch (_) {}
    previewRoot = null;
  }

  function createScene() {
    if (!canvas || engine) return;

    engine = new BABYLON.Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        stencil: true,
        adaptToDeviceRatio: true
      }
    );

    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.025, 0.075, 0.105, 1);

    camera = new BABYLON.ArcRotateCamera(
      "shopPreviewCamera",
      -Math.PI * 0.66,
      Math.PI * 0.34,
      125,
      new BABYLON.Vector3(0, 22, 0),
      scene
    );
    camera.lowerBetaLimit = 0.48;
    camera.upperBetaLimit = 1.35;
    camera.lowerRadiusLimit = 35;
    camera.upperRadiusLimit = 320;
    camera.wheelPrecision = 22;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const hemi =
      new BABYLON.HemisphericLight(
        "shopPreviewHemi",
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
    hemi.intensity = 0.92;
    hemi.groundColor = new BABYLON.Color3(0.10, 0.14, 0.16);

    const key =
      new BABYLON.DirectionalLight(
        "shopPreviewKey",
        new BABYLON.Vector3(-0.45, -0.85, 0.35),
        scene
      );
    key.position.set(70, 110, -65);
    key.intensity = 1.25;

    const rim =
      new BABYLON.DirectionalLight(
        "shopPreviewRim",
        new BABYLON.Vector3(0.55, -0.45, -0.55),
        scene
      );
    rim.position.set(-80, 75, 80);
    rim.intensity = 0.42;

    ground = BABYLON.MeshBuilder.CreateGround(
      "shopPreviewGround",
      {
        width: 220,
        height: 220,
        subdivisions: 1
      },
      scene
    );

    const roadSet =
      window.mapGameMaterials?.getRoadSet?.(
        scene,
        "REGULAR"
      );

    ground.material =
      roadSet?.pavement ||
      (() => {
        const m =
          new BABYLON.StandardMaterial(
            "shopPreviewGroundFallback",
            scene
          );
        m.diffuseColor =
          new BABYLON.Color3(0.19, 0.22, 0.23);
        return m;
      })();

    engine.runRenderLoop(() => {
      if (visible && scene) scene.render();
    });

    resizeObserver =
      new ResizeObserver(() => {
        if (engine) engine.resize();
      });
    resizeObserver.observe(canvas);
  }

  function mount(targetCanvas) {
    if (!targetCanvas) return;
    if (canvas === targetCanvas && engine) return;

    dispose();

    canvas = targetCanvas;
    createScene();
  }

  function fitCamera(def) {
    const fp = def?.footprint || [50, 50];
    const maxSide = Math.max(fp[0], fp[1]);
    const tall =
      ["officeTower", "apartmentTower", "hotel"].includes(def?.id);

    camera.target.set(
      0,
      tall ? 28 : Math.max(8, maxSide * 0.16),
      0
    );

    camera.radius =
      tall
        ? Math.max(105, maxSide * 1.65)
        : Math.max(70, maxSide * 1.35);
  }

  function preview({
    itemId,
    variant = 0,
    graphicsPreset = "REGULAR"
  }) {
    if (!engine || !scene || !window.mapGameBuildings) return;

    currentRequest = {
      itemId,
      variant,
      graphicsPreset
    };

    disposePreviewRoot();

    const def = window.mapGameBuildings.item(itemId);
    fitCamera(def);

    previewRoot =
      window.mapGameBuildings.renderPlacedBuilding(
        {
          scene,
          graphicsPreset,
          isShopPreview: true
        },
        {
          id: `preview_${itemId}`,
          type: itemId,
          category: def.category,
          variant,
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
          foundationDepth: 2.3,
          level: 1,
          ownerId: "preview"
        },
        null
      );

    if (previewRoot) {
      previewRoot.metadata = {
        ...(previewRoot.metadata || {}),
        shopPreview: true
      };
    }
  }

  function setVisible(value) {
    visible = Boolean(value);
    if (visible && engine) {
      requestAnimationFrame(() => engine.resize());
    }
  }

  function refresh() {
    if (currentRequest) preview(currentRequest);
  }

  function dispose() {
    visible = false;
    currentRequest = null;
    disposePreviewRoot();

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (scene) {
      try { scene.dispose(); } catch (_) {}
      scene = null;
    }

    if (engine) {
      try { engine.dispose(); } catch (_) {}
      engine = null;
    }

    camera = null;
    ground = null;
    canvas = null;
  }

  window.mapGameShopPreview = {
    VERSION: "0.2.1G",
    mount,
    preview,
    refresh,
    setVisible,
    dispose
  };

  console.log("Map Game 3D shop preview 0.2.1G ready.");
})();
