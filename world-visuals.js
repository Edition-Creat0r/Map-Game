// ============================================================
// MAP GAME — world_visuals.js
// Alpha 0.1.1c terrain + environment pass
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameVisualsLoaded) return;
  window.__mapGameVisualsLoaded = true;

  function start(runtime) {
    if (!runtime || !runtime.scene || !window.BABYLON) return;

    const {
      scene,
      camera,
      shadowGenerator
    } = runtime;

    let pipeline = null;

    function mat(
      name,
      color,
      alpha = 1
    ) {
      const m =
        new BABYLON.StandardMaterial(
          name,
          scene
        );

      m.diffuseColor =
        new BABYLON.Color3(
          ...color
        );

      m.specularColor =
        new BABYLON.Color3(
          .035,
          .045,
          .05
        );

      m.specularPower = 10;
      m.alpha = alpha;
      return m;
    }

    const sand =
      mat(
        "envSand",
        [.70,.61,.42]
      );

    const dryGrass =
      mat(
        "envDryGrass",
        [.35,.43,.16]
      );

    const forestFloor =
      mat(
        "envForestFloor",
        [.07,.17,.08]
      );

    const cliff =
      mat(
        "envCliff",
        [.25,.29,.31]
      );

    const cliffLight =
      mat(
        "envCliffLight",
        [.40,.42,.41]
      );

    const foam =
      mat(
        "envFoam",
        [.82,.92,.95],
        .63
      );

    const darkWood =
      mat(
        "envDarkWood",
        [.22,.125,.055]
      );

    const leafDark =
      mat(
        "envLeafDark",
        [.05,.21,.08]
      );

    const leafMid =
      mat(
        "envLeafMid",
        [.075,.30,.105]
      );

    const leafLight =
      mat(
        "envLeafLight",
        [.12,.38,.15]
      );

    function mark(
      mesh,
      shadow = true
    ) {
      if (!mesh) return mesh;
      mesh.isPickable = false;
      mesh.receiveShadows = true;

      if (shadow) {
        try {
          shadowGenerator.addShadowCaster(mesh);
        } catch (_) {}
      }

      return mesh;
    }

    function groundPatch(
      name,
      x,
      z,
      w,
      d,
      material,
      rotation = 0,
      y = .15
    ) {
      const mesh =
        BABYLON.MeshBuilder.CreateGround(
          name,
          {
            width:w,
            height:d,
            subdivisions:1
          },
          scene
        );

      mesh.position.set(x,y,z);
      mesh.rotation.y = rotation;
      mesh.material = material;
      return mark(mesh,false);
    }

    function rock(
      x,
      z,
      scale = 1,
      material = cliff
    ) {
      const mesh =
        BABYLON.MeshBuilder.CreatePolyhedron(
          "envRock",
          {
            type:2,
            size:3.4*scale
          },
          scene
        );

      mesh.position.set(
        x,
        1.45*scale,
        z
      );

      mesh.scaling.set(
        1.35,
        .72,
        1.0
      );

      mesh.rotation.set(
        .12,
        (x+z)*.017,
        -.08
      );

      mesh.material = material;
      return mark(mesh);
    }

    function pine(
      x,
      z,
      scale = 1,
      leafMaterial = leafDark
    ) {
      const root =
        new BABYLON.TransformNode(
          "envPine",
          scene
        );

      root.position.set(x,0,z);

      const trunk =
        BABYLON.MeshBuilder.CreateCylinder(
          "envPineTrunk",
          {
            diameterTop:.30*scale,
            diameterBottom:.68*scale,
            height:5.8*scale,
            tessellation:7
          },
          scene
        );

      trunk.position.y = 2.9*scale;
      trunk.material = darkWood;
      trunk.parent = root;
      mark(trunk);

      [
        [4.0,5.0,2.4],
        [5.3,4.0,2.15],
        [6.55,3.0,1.75],
        [7.65,1.9,1.25]
      ].forEach(
        p => {
          const crown =
            BABYLON.MeshBuilder.CreateCylinder(
              "envPineCrown",
              {
                diameterTop:.16*scale,
                diameterBottom:p[1]*scale,
                height:p[2]*scale,
                tessellation:8
              },
              scene
            );

          crown.position.y = p[0]*scale;
          crown.material = leafMaterial;
          crown.parent = root;
          mark(crown);
        }
      );

      return root;
    }

    function oak(
      x,
      z,
      scale = 1,
      index = 0
    ) {
      const root =
        new BABYLON.TransformNode(
          "envOak",
          scene
        );

      root.position.set(x,0,z);

      const trunk =
        BABYLON.MeshBuilder.CreateCylinder(
          "envOakTrunk",
          {
            diameterTop:.36*scale,
            diameterBottom:.82*scale,
            height:5.1*scale,
            tessellation:7
          },
          scene
        );

      trunk.position.y = 2.55*scale;
      trunk.material = darkWood;
      trunk.parent = root;
      mark(trunk);

      const mats = [
        leafDark,
        leafMid,
        leafLight
      ];

      [
        [-1.0,5.6,.2,1.0,.90,1.0],
        [1.0,5.9,.35,.92,1.00,.94],
        [.1,7.0,-.4,1.08,1.03,1.05]
      ].forEach(
        (p,i) => {
          const blob =
            BABYLON.MeshBuilder.CreateIcoSphere(
              "envOakLeaf",
              {
                radius:2.35*scale,
                subdivisions:1
              },
              scene
            );

          blob.position.set(
            p[0]*scale,
            p[1]*scale,
            p[2]*scale
          );

          blob.scaling.set(
            p[3],
            p[4],
            p[5]
          );

          blob.material =
            mats[
              (index+i)%3
            ];

          blob.parent = root;
          mark(blob);
        }
      );

      return root;
    }

    // Forest floor zones
    [
      [30,-330,300,270,.12],
      [930,-650,430,350,-.18],
      [-840,760,310,240,.30]
    ].forEach(
      p => groundPatch(
        "forestFloor",
        p[0],p[1],p[2],p[3],
        forestFloor,p[4]
      )
    );

    // Dry plains variation
    [
      [-880,930,450,280,.10],
      [-520,1040,280,190,-.18],
      [530,740,300,180,.23]
    ].forEach(
      p => groundPatch(
        "dryGrassPatch",
        p[0],p[1],p[2],p[3],
        dryGrass,p[4],
        .13
      )
    );

    // Actual beach bands
    [
      [1100,1060,300,115,-.20],
      [1250,720,260,100,.55],
      [760,1320,250,90,.30],
      [-980,1190,310,95,-.35],
      [-1310,700,240,90,.70]
    ].forEach(
      p => groundPatch(
        "beachPatch",
        p[0],p[1],p[2],p[3],
        sand,p[4],
        .10
      )
    );

    // Broken surf strips on one highly visible coastline
    for (let i=0;i<20;i++) {
      const angle=.38+i*.112;
      const r=1475+Math.sin(i*1.7)*52;
      const x=Math.cos(angle)*r;
      const z=Math.sin(angle)*r;

      groundPatch(
        "coastFoam",
        x,z,
        38+(i%4)*8,
        4.5,
        foam,
        -angle,
        -3.52
      );
    }

    function forestCluster(
      cx,
      cz,
      radius,
      count,
      pineBias
    ) {
      for (let i=0;i<count;i++) {
        const a=
          i*2.399963+
          Math.sin(i*1.83)*.16;

        const rr=
          radius*
          Math.sqrt((i+.5)/count);

        const x=
          cx+Math.cos(a)*rr;

        const z=
          cz+Math.sin(a)*rr;

        const s=.68+(i%7)*.055;

        if (
          (i%10)/10 <
          pineBias
        ) {
          pine(
            x,z,s,
            i%3===0
              ? leafMid
              : leafDark
          );
        } else {
          oak(
            x,z,s,i
          );
        }
      }
    }

    forestCluster(
      55,-355,165,68,.70
    );

    forestCluster(
      930,-650,240,100,.56
    );

    forestCluster(
      -840,760,160,54,.38
    );

    // Rocky highlands
    [
      [-1080,-690],
      [-900,-790],
      [-1230,-510],
      [-640,-1030]
    ].forEach(
      (center,ci) => {
        for (let i=0;i<18;i++) {
          const a=i*2.17+ci;
          const r=30+(i%6)*13;

          rock(
            center[0]+Math.cos(a)*r,
            center[1]+Math.sin(a)*r,
            .7+(i%5)*.18,
            i%3===0
              ? cliffLight
              : cliff
          );
        }
      }
    );

    // Improve the immediate city approach so first screenshot looks better.
    for (let i=0;i<34;i++) {
      const z=-250+i*18;
      const side=i%2===0 ? -1 : 1;

      if (i%3===0) {
        rock(
          side*(30+(i%4)*4),
          z,
          .55+(i%3)*.1
        );
      } else {
        oak(
          side*(32+(i%5)*3),
          z,
          .72+(i%4)*.06,
          i
        );
      }
    }

    function applyPreset(preset) {
      const regular =
        preset === "REGULAR";

      try {
        if (!pipeline) {
          pipeline =
            new BABYLON.DefaultRenderingPipeline(
              "mapGameVisualPipeline",
              true,
              scene,
              [camera]
            );
        }

        pipeline.fxaaEnabled = true;
        pipeline.samples = regular ? 2 : 1;
        pipeline.bloomEnabled = regular;
        pipeline.bloomThreshold = .88;
        pipeline.bloomWeight = .12;
        pipeline.bloomKernel = 34;
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.contrast = regular ? 1.12 : 1.06;
        pipeline.imageProcessing.exposure = regular ? 1.02 : .99;
        pipeline.imageProcessing.vignetteEnabled = regular;
        pipeline.imageProcessing.vignetteWeight = .32;
        pipeline.imageProcessing.vignetteStretch = .20;
      } catch (error) {
        console.warn(
          "Map Game visual pipeline unavailable:",
          error
        );
      }
    }

    applyPreset(
      runtime.graphicsPreset ||
      "BASIC"
    );

    window.addEventListener(
      "mapgame:graphics",
      event => applyPreset(
        event.detail &&
        event.detail.preset ||
        "BASIC"
      )
    );

    if (runtime.showToast) {
      runtime.showToast(
        "Terrain & environment upgrade loaded",
        "success"
      );
    }
  }

  if (window.mapGameRuntime) {
    start(window.mapGameRuntime);
  } else {
    window.addEventListener(
      "mapgame:runtime-ready",
      event => start(event.detail),
      { once:true }
    );
  }
})();
