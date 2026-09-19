// ============================================================
// MAP GAME — traffic.js
// Alpha 0.2.1G1 CAR SCALE / ORIENTATION / MATERIAL HOTFIX
//
// Fixes converted FBX -> GLB cars that:
//   • import at enormous scale
//   • lie on their side
//   • face sideways
//   • arrive with missing / unusable materials
//
// Model path:
//   assets/models/cars/sedan-01.glb
//
// IMPORTANT:
// The normalization is automatic. Do NOT manually resize the GLB.
// ============================================================

(() => {
  "use strict";

  const MODEL_ROOT = "assets/models/cars/";
  const MODEL_FILE = "sedan-01.glb";

  const CONFIG = {
    // A normal road sedan in Map Game units.
    desiredCarLength: 6.2,

    // Lift after automatic ground alignment.
    roadLift: 0.34,

    basicMovingCars: 10,
    regularMovingCars: 32,

    basicParkedCars: 5,
    regularParkedCars: 18,

    basicSpeed: 17,
    regularSpeed: 21
  };

  let scene = null;
  let container = null;
  let trafficRoot = null;
  let observer = null;
  let cars = [];
  let loadPromise = null;

  const materialCache = new WeakMap();

  function route(points) {
    let total = 0;
    const segments = [];

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);

      segments.push({
        a,
        b,
        len,
        start: total
      });

      total += len;
    }

    return {
      points,
      segments,
      total
    };
  }

  // Visual-only hub lanes. These can be replaced by real road graph
  // routes in 0.2.5 without changing how the car model is normalized.
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
    const d =
      ((distance % r.total) + r.total) % r.total;

    for (const s of r.segments) {
      if (d <= s.start + s.len) {
        const local =
          (d - s.start) /
          Math.max(0.0001, s.len);

        const x =
          s.a.x +
          (s.b.x - s.a.x) * local;

        const z =
          s.a.z +
          (s.b.z - s.a.z) * local;

        const yaw =
          Math.atan2(
            s.b.x - s.a.x,
            s.b.z - s.a.z
          );

        return { x, z, yaw };
      }
    }

    return {
      ...r.points[0],
      yaw: 0
    };
  }

  function getBounds(root) {
    const B = window.BABYLON;

    let min =
      new B.Vector3(
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY
      );

    let max =
      new B.Vector3(
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY
      );

    let found = false;

    root.computeWorldMatrix?.(true);

    const meshes =
      root.getChildMeshes?.(false) || [];

    for (const mesh of meshes) {
      if (!mesh.getBoundingInfo) continue;

      mesh.computeWorldMatrix(true);

      const box =
        mesh.getBoundingInfo()
          .boundingBox;

      const a = box.minimumWorld;
      const b = box.maximumWorld;

      min.x = Math.min(min.x, a.x);
      min.y = Math.min(min.y, a.y);
      min.z = Math.min(min.z, a.z);

      max.x = Math.max(max.x, b.x);
      max.y = Math.max(max.y, b.y);
      max.z = Math.max(max.z, b.z);

      found = true;
    }

    if (!found) {
      min.set(-1, -0.5, -2);
      max.set(1, 0.5, 2);
    }

    return {
      min,
      max,
      size: max.subtract(min),
      center: min.add(max).scale(0.5)
    };
  }

  function makeMaterials(targetScene) {
    if (materialCache.has(targetScene)) {
      return materialCache.get(targetScene);
    }

    const B = window.BABYLON;

    const hexes = [
      "#d8dde3", // silver
      "#2f353b", // graphite
      "#596b7d", // slate blue
      "#8d3e39", // muted red
      "#d6d0bf", // warm white
      "#23475b"  // dark blue
    ];

    const bodies =
      hexes.map((hex, i) => {
        const m =
          new B.PBRMaterial(
            `mgTrafficBody_${i}`,
            targetScene
          );

        m.albedoColor =
          B.Color3.FromHexString(hex);

        m.metallic = 0.58;
        m.roughness = 0.28;
        m.environmentIntensity = 0.82;

        return m;
      });

    const tire =
      new B.PBRMaterial(
        "mgTrafficTire",
        targetScene
      );

    tire.albedoColor =
      new B.Color3(0.028, 0.030, 0.032);

    tire.metallic = 0.0;
    tire.roughness = 0.92;

    const glass =
      new B.PBRMaterial(
        "mgTrafficGlass",
        targetScene
      );

    glass.albedoColor =
      new B.Color3(0.035, 0.11, 0.15);

    glass.metallic = 0.08;
    glass.roughness = 0.12;
    glass.alpha = 0.73;
    glass.environmentIntensity = 1.0;

    const lamp =
      new B.StandardMaterial(
        "mgTrafficLamp",
        targetScene
      );

    lamp.diffuseColor =
      new B.Color3(0.95, 0.91, 0.72);

    lamp.emissiveColor =
      new B.Color3(0.45, 0.39, 0.20);

    const brake =
      new B.StandardMaterial(
        "mgTrafficBrake",
        targetScene
      );

    brake.diffuseColor =
      new B.Color3(0.60, 0.04, 0.025);

    brake.emissiveColor =
      new B.Color3(0.28, 0.01, 0.005);

    const result = {
      bodies,
      tire,
      glass,
      lamp,
      brake
    };

    materialCache.set(
      targetScene,
      result
    );

    return result;
  }

  function applyCarMaterials(wrapper, colorIndex) {
    const mats =
      makeMaterials(wrapper.getScene());

    const body =
      mats.bodies[
        colorIndex %
        mats.bodies.length
      ];

    const meshes =
      wrapper.getChildMeshes?.(false) || [];

    for (const mesh of meshes) {
      const name =
        `${mesh.name || ""} ${mesh.material?.name || ""}`
          .toLowerCase();

      if (
        /wheel|tire|tyre|rubber/.test(name)
      ) {
        mesh.material = mats.tire;
      } else if (
        /glass|window|windshield|windscreen/.test(name)
      ) {
        mesh.material = mats.glass;
      } else if (
        /tail|brake|rear.?light/.test(name)
      ) {
        mesh.material = mats.brake;
      } else if (
        /head|lamp|front.?light|light/.test(name)
      ) {
        mesh.material = mats.lamp;
      } else {
        // This is intentional. Some browser FBX->GLB converters
        // do not preserve usable source materials.
        mesh.material = body;
      }

      mesh.isPickable = false;
      mesh.receiveShadows = true;
    }
  }

  function normalizeCar(wrapper) {
    const B = window.BABYLON;

    const holder =
      wrapper._mapGameModelHolder;

    if (!holder) {
      return {
        yawOffset: 0
      };
    }

    // --------------------------------------------------------
    // 1. Detect which imported axis is probably the car height.
    //    Cars are much thinner vertically than they are long/wide.
    // --------------------------------------------------------

    holder.rotationQuaternion = null;
    holder.rotation.set(0, 0, 0);
    holder.position.set(0, 0, 0);
    holder.scaling.setAll(1);

    let bounds =
      getBounds(holder);

    const sx = Math.abs(bounds.size.x);
    const sy = Math.abs(bounds.size.y);
    const sz = Math.abs(bounds.size.z);

    const smallest =
      Math.min(sx, sy, sz);

    if (smallest === sz) {
      // Imported Z-up -> Babylon Y-up.
      holder.rotation.x =
        -Math.PI / 2;
    } else if (smallest === sx) {
      // Imported X-up -> Babylon Y-up.
      holder.rotation.z =
        Math.PI / 2;
    }

    holder.computeWorldMatrix(true);

    // --------------------------------------------------------
    // 2. Measure again after making Y the vertical axis.
    // --------------------------------------------------------

    bounds =
      getBounds(holder);

    const horizontalLength =
      Math.max(
        Math.abs(bounds.size.x),
        Math.abs(bounds.size.z),
        0.0001
      );

    const scale =
      CONFIG.desiredCarLength /
      horizontalLength;

    holder.scaling.setAll(scale);
    holder.computeWorldMatrix(true);

    // --------------------------------------------------------
    // 3. Re-center and put the tires/model bottom on Y=0.
    // --------------------------------------------------------

    bounds =
      getBounds(holder);

    holder.position.x -= bounds.center.x;
    holder.position.z -= bounds.center.z;
    holder.position.y -= bounds.min.y;

    holder.computeWorldMatrix(true);

    // --------------------------------------------------------
    // 4. Detect whether the car's long axis is X or Z.
    //    Movement code treats +Z as "forward".
    // --------------------------------------------------------

    bounds =
      getBounds(holder);

    const xLength =
      Math.abs(bounds.size.x);

    const zLength =
      Math.abs(bounds.size.z);

    const yawOffset =
      xLength > zLength
        ? Math.PI / 2
        : 0;

    return {
      yawOffset,
      scale,
      dimensions: {
        x: bounds.size.x,
        y: bounds.size.y,
        z: bounds.size.z
      }
    };
  }

  function stop() {
    if (observer && scene) {
      scene.onBeforeRenderObservable.remove(
        observer
      );

      observer = null;
    }

    cars = [];

    if (trafficRoot) {
      try {
        trafficRoot.dispose(false, false);
      } catch (_) {}

      trafficRoot = null;
    }
  }

  async function ensureContainer(targetScene) {
    if (
      container &&
      scene === targetScene
    ) {
      return container;
    }

    if (
      loadPromise &&
      scene === targetScene
    ) {
      return loadPromise;
    }

    scene = targetScene;

    loadPromise =
      BABYLON.SceneLoader
        .LoadAssetContainerAsync(
          MODEL_ROOT,
          MODEL_FILE,
          scene
        )
        .then(result => {
          container = result;

          console.log(
            "Map Game traffic car loaded:",
            MODEL_FILE
          );

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

  function instantiateCar(
    parent,
    name,
    colorIndex = 0
  ) {
    if (!container) return null;

    const instance =
      container.instantiateModelsToScene(
        sourceName =>
          `${name}_${sourceName}`,
        false,
        {
          doNotInstantiate: false
        }
      );

    const wrapper =
      new BABYLON.TransformNode(
        name,
        scene
      );

    wrapper.parent = parent;

    const holder =
      new BABYLON.TransformNode(
        `${name}_modelHolder`,
        scene
      );

    holder.parent = wrapper;

    wrapper._mapGameModelHolder =
      holder;

    for (
      const root of
      instance.rootNodes || []
    ) {
      root.parent = holder;
    }

    applyCarMaterials(
      holder,
      colorIndex
    );

    const normalized =
      normalizeCar(wrapper);

    wrapper._mapGameYawOffset =
      normalized.yawOffset || 0;

    wrapper.metadata = {
      ...(wrapper.metadata || {}),
      mapGameTrafficCar: true,
      normalizedScale:
        normalized.scale,
      normalizedDimensions:
        normalized.dimensions
    };

    return wrapper;
  }

  function addMovingCars(
    count,
    preset
  ) {
    for (
      let i = 0;
      i < count;
      i++
    ) {
      const wrapper =
        instantiateCar(
          trafficRoot,
          `trafficCar_${i}`,
          i
        );

      if (!wrapper) continue;

      const routeIndex =
        i % ROUTES.length;

      const r =
        ROUTES[routeIndex];

      const progress =
        (
          i /
          Math.max(1, count)
        ) * r.total +
        (
          routeIndex *
          r.total *
          0.17
        );

      cars.push({
        node: wrapper,
        route: r,
        progress,
        speed:
          (
            preset === "REGULAR"
              ? CONFIG.regularSpeed
              : CONFIG.basicSpeed
          ) *
          (
            0.86 +
            ((i * 37) % 24) /
            100
          )
      });
    }
  }

  function addParkedCars(count) {
    const locations = [];

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const side = i % 4;

      const along =
        -250 +
        ((i * 73) % 500);

      if (side === 0) {
        locations.push({
          x: along,
          z: -316,
          yaw: Math.PI / 2
        });
      } else if (side === 1) {
        locations.push({
          x: 316,
          z: along,
          yaw: 0
        });
      } else if (side === 2) {
        locations.push({
          x: along,
          z: 316,
          yaw: Math.PI / 2
        });
      } else {
        locations.push({
          x: -316,
          z: along,
          yaw: 0
        });
      }
    }

    locations.forEach((p, i) => {
      const node =
        instantiateCar(
          trafficRoot,
          `parkedCar_${i}`,
          i + 2
        );

      if (!node) return;

      node.position.set(
        p.x,
        CONFIG.roadLift,
        p.z
      );

      node.rotation.y =
        p.yaw +
        (
          node._mapGameYawOffset ||
          0
        );
    });
  }

  async function startHubTraffic(
    parent,
    preset = "BASIC"
  ) {
    stop();

    if (
      !parent ||
      parent.isDisposed?.()
    ) {
      return false;
    }

    const loaded =
      await ensureContainer(
        parent.getScene()
      );

    if (
      !loaded ||
      parent.isDisposed?.()
    ) {
      return false;
    }

    trafficRoot =
      new BABYLON.TransformNode(
        "hubTrafficRoot",
        parent.getScene()
      );

    trafficRoot.parent =
      parent;

    const moving =
      preset === "REGULAR"
        ? CONFIG.regularMovingCars
        : CONFIG.basicMovingCars;

    const parked =
      preset === "REGULAR"
        ? CONFIG.regularParkedCars
        : CONFIG.basicParkedCars;

    addMovingCars(
      moving,
      preset
    );

    addParkedCars(
      parked
    );

    observer =
      scene.onBeforeRenderObservable.add(
        () => {
          const dt =
            Math.min(
              0.05,
              scene
                .getEngine()
                .getDeltaTime() /
                1000
            );

          for (const car of cars) {
            car.progress +=
              car.speed * dt;

            const p =
              pointOnRoute(
                car.route,
                car.progress
              );

            car.node.position.set(
              p.x,
              CONFIG.roadLift,
              p.z
            );

            car.node.rotation.y =
              p.yaw +
              (
                car.node
                  ._mapGameYawOffset ||
                0
              );
          }
        }
      );

    console.log(
      `Map Game traffic started: ${moving} moving, ${parked} parked (${preset}).`
    );

    return true;
  }

  window.mapGameTraffic = {
    VERSION: "0.2.1G1",
    CONFIG,
    startHubTraffic,
    stop
  };

  console.log(
    "Map Game traffic 0.2.1G1 car hotfix ready."
  );
})();
