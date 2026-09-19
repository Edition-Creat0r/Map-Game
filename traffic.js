// ============================================================
// MAP GAME — traffic.js
// Alpha 0.2.1G FINAL VISUAL PASS
//
// Loads: assets/models/cars/sedan-01.glb
// Lightweight hub traffic: visual only, not full traffic simulation.
// BASIC = fewer cars / no parked-car density.
// REGULAR = more movement + parked cars.
// ============================================================

(() => {
  "use strict";

  const MODEL_ROOT = "assets/models/cars/";
  const MODEL_FILE = "sedan-01.glb";

  // Easy tuning if the converted model is unusually large/small or sideways.
  const CONFIG = {
    modelScale: 1.0,
    modelYawOffset: 0,
    basicMovingCars: 18,
    regularMovingCars: 42,
    basicParkedCars: 8,
    regularParkedCars: 24
  };

  let scene = null;
  let container = null;
  let trafficRoot = null;
  let observer = null;
  let cars = [];
  let loadPromise = null;

  function route(points) {
    let total = 0;
    const segments = [];

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      segments.push({ a, b, len, start: total });
      total += len;
    }

    return { points, segments, total };
  }

  const ROUTES = [
    route([
      { x: -288, z: -288 },
      { x:  288, z: -288 },
      { x:  288, z:  288 },
      { x: -288, z:  288 }
    ]),
    route([
      { x: -165, z: -165 },
      { x:  165, z: -165 },
      { x:  165, z:  165 },
      { x: -165, z:  165 }
    ]),
    route([
      { x: -6, z: -360 },
      { x: -6, z:  360 },
      { x:  6, z:  360 },
      { x:  6, z: -360 }
    ]),
    route([
      { x: -360, z:  6 },
      { x:  360, z:  6 },
      { x:  360, z: -6 },
      { x: -360, z: -6 }
    ])
  ];

  function pointOnRoute(r, distance) {
    let d = ((distance % r.total) + r.total) % r.total;

    for (const s of r.segments) {
      if (d <= s.start + s.len) {
        const local = (d - s.start) / Math.max(0.0001, s.len);
        const x = s.a.x + (s.b.x - s.a.x) * local;
        const z = s.a.z + (s.b.z - s.a.z) * local;
        const yaw = Math.atan2(
          s.b.x - s.a.x,
          s.b.z - s.a.z
        );
        return { x, z, yaw };
      }
    }

    return { ...r.points[0], yaw: 0 };
  }

  function stop() {
    if (observer && scene) {
      scene.onBeforeRenderObservable.remove(observer);
      observer = null;
    }

    cars = [];

    if (trafficRoot) {
      try { trafficRoot.dispose(false, false); } catch (_) {}
      trafficRoot = null;
    }
  }

  async function ensureContainer(targetScene) {
    if (container && scene === targetScene) return container;
    if (loadPromise && scene === targetScene) return loadPromise;

    scene = targetScene;

    loadPromise = BABYLON.SceneLoader.LoadAssetContainerAsync(
      MODEL_ROOT,
      MODEL_FILE,
      scene
    )
      .then(result => {
        container = result;
        console.log("Map Game traffic car loaded:", MODEL_FILE);
        return container;
      })
      .catch(error => {
        console.warn(
          "Map Game could not load sedan-01.glb; traffic disabled.",
          error
        );
        container = null;
        return null;
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  function instantiateCar(parent, name) {
    if (!container) return null;

    const instance =
      container.instantiateModelsToScene(
        sourceName => `${name}_${sourceName}`,
        false,
        { doNotInstantiate: false }
      );

    const wrapper = new BABYLON.TransformNode(name, scene);
    wrapper.parent = parent;
    wrapper.scaling.setAll(CONFIG.modelScale);

    for (const root of instance.rootNodes || []) {
      root.parent = wrapper;
    }

    for (const mesh of wrapper.getChildMeshes?.(false) || []) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
    }

    return wrapper;
  }

  function addMovingCars(count, preset) {
    for (let i = 0; i < count; i++) {
      const wrapper = instantiateCar(trafficRoot, `trafficCar_${i}`);
      if (!wrapper) continue;

      const routeIndex = i % ROUTES.length;
      const r = ROUTES[routeIndex];
      const progress =
        (i / Math.max(1, count)) * r.total +
        (routeIndex * r.total * 0.17);

      cars.push({
        node: wrapper,
        route: r,
        progress,
        speed:
          (preset === "REGULAR" ? 22 : 18) *
          (0.82 + ((i * 37) % 31) / 100)
      });
    }
  }

  function addParkedCars(count) {
    const locations = [];

    for (let i = 0; i < count; i++) {
      const side = i % 4;
      const along = -250 + ((i * 73) % 500);

      if (side === 0) {
        locations.push({ x: along, z: -316, yaw: Math.PI / 2 });
      } else if (side === 1) {
        locations.push({ x: 316, z: along, yaw: 0 });
      } else if (side === 2) {
        locations.push({ x: along, z: 316, yaw: Math.PI / 2 });
      } else {
        locations.push({ x: -316, z: along, yaw: 0 });
      }
    }

    locations.forEach((p, i) => {
      const node = instantiateCar(trafficRoot, `parkedCar_${i}`);
      if (!node) return;
      node.position.set(p.x, 1.05, p.z);
      node.rotation.y = p.yaw + CONFIG.modelYawOffset;
    });
  }

  async function startHubTraffic(parent, preset = "BASIC") {
    stop();

    if (!parent || parent.isDisposed?.()) return false;

    const loaded = await ensureContainer(parent.getScene());
    if (!loaded || parent.isDisposed?.()) return false;

    trafficRoot =
      new BABYLON.TransformNode("hubTrafficRoot", parent.getScene());
    trafficRoot.parent = parent;

    const moving =
      preset === "REGULAR"
        ? CONFIG.regularMovingCars
        : CONFIG.basicMovingCars;

    const parked =
      preset === "REGULAR"
        ? CONFIG.regularParkedCars
        : CONFIG.basicParkedCars;

    addMovingCars(moving, preset);
    addParkedCars(parked);

    observer =
      scene.onBeforeRenderObservable.add(() => {
        const dt =
          Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);

        for (const car of cars) {
          car.progress += car.speed * dt;
          const p = pointOnRoute(car.route, car.progress);
          car.node.position.set(p.x, 1.05, p.z);
          car.node.rotation.y =
            p.yaw + CONFIG.modelYawOffset;
        }
      });

    return true;
  }

  window.addEventListener("mapgame:graphics", event => {
    // game.js rebuilds the active hub after changing graphics.
    // That rebuild will call startHubTraffic again.
  });

  window.mapGameTraffic = {
    VERSION: "0.2.1G",
    CONFIG,
    startHubTraffic,
    stop
  };

  console.log("Map Game traffic 0.2.1G ready.");
})();
