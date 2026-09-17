// ============================================================
// MAP GAME — terrain.js
// Alpha 0.1.1d
// Grass + Rock + Sand texture foundation
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameTerrainLoaded) return;
  window.__mapGameTerrainLoaded = true;

  function startTerrain(runtime) {

    if (!runtime || !runtime.scene) {
      console.error("Terrain: runtime/scene missing");
      return;
    }

    const scene = runtime.scene;
    const ground = runtime.ground;

    console.log("Terrain system starting...");


    // ========================================================
    // TEXTURE HELPER
    // ========================================================

    function makeTexture(path, scale) {

      const texture = new BABYLON.Texture(
        path,
        scene,
        false,
        false,
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE
      );

      texture.wrapU =
        BABYLON.Texture.WRAP_ADDRESSMODE;

      texture.wrapV =
        BABYLON.Texture.WRAP_ADDRESSMODE;

      texture.uScale = scale;
      texture.vScale = scale;

      return texture;
    }


    // ========================================================
    // GRASS
    // ========================================================

    const grassTexture =
      makeTexture(
        "assets/textures/grass/grass_diffuse.jpg",
        14
      );

    if (runtime.grassMaterial) {

      runtime.grassMaterial.diffuseTexture =
        grassTexture;

      runtime.grassMaterial.diffuseColor =
        new BABYLON.Color3(
          0.82,
          0.88,
          0.76
        );

      runtime.grassMaterial.specularColor =
        new BABYLON.Color3(
          0.02,
          0.025,
          0.02
        );

      runtime.grassMaterial.specularPower = 6;
    }


    // ========================================================
    // ROCK
    // ========================================================

    const rockTexture =
      makeTexture(
        "assets/textures/rock/rock_diffuse.jpg",
        9
      );

    if (runtime.rockMaterial) {

      runtime.rockMaterial.diffuseTexture =
        rockTexture;

      runtime.rockMaterial.diffuseColor =
        new BABYLON.Color3(
          0.88,
          0.88,
          0.86
        );

      runtime.rockMaterial.specularColor =
        new BABYLON.Color3(
          0.025,
          0.025,
          0.025
        );

      runtime.rockMaterial.specularPower = 5;
    }


    // ========================================================
    // SAND
    // ========================================================

    const sandTexture =
      makeTexture(
        "assets/textures/sand/sand_diffuse.jpg",
        12
      );

    const sandMaterial =
      new BABYLON.StandardMaterial(
        "terrainSandMaterial",
        scene
      );

    sandMaterial.diffuseTexture =
      sandTexture;

    sandMaterial.diffuseColor =
      new BABYLON.Color3(
        0.95,
        0.91,
        0.78
      );

    sandMaterial.specularColor =
      new BABYLON.Color3(
        0.015,
        0.015,
        0.012
      );

    sandMaterial.specularPower = 4;


    // ========================================================
    // LARGE-SCALE GRASS COLOR VARIATION
    // ========================================================

    if (ground) {

      const positions =
        ground.getVerticesData(
          BABYLON.VertexBuffer.PositionKind
        );

      if (positions) {

        const colors = [];

        for (
          let i = 0;
          i < positions.length;
          i += 3
        ) {

          const x = positions[i];
          const y = positions[i + 1];
          const z = positions[i + 2];


          // Huge color regions
          const macro =
            Math.sin(x * 0.0022) * 0.42 +
            Math.cos(z * 0.0025) * 0.34 +
            Math.sin(
              (x + z) * 0.0013
            ) * 0.24;


          // Medium variation
          const medium =
            Math.sin(x * 0.0105) *
            Math.cos(z * 0.0087);


          // Height variation
          const height =
            Math.max(
              0,
              Math.min(
                1,
                (y + 5) / 90
              )
            );


          const variation =
            macro * 0.095 +
            medium * 0.028;


          let r =
            0.83 + variation;

          let g =
            0.92 +
            variation * 0.72;

          let b =
            0.78 +
            variation * 0.46;


          // Slightly drier higher land
          r += height * 0.025;
          g -= height * 0.035;
          b -= height * 0.018;


          r =
            Math.max(
              0.58,
              Math.min(1, r)
            );

          g =
            Math.max(
              0.62,
              Math.min(1, g)
            );

          b =
            Math.max(
              0.52,
              Math.min(0.96, b)
            );


          colors.push(
            r,
            g,
            b,
            1
          );
        }


        ground.setVerticesData(
          BABYLON.VertexBuffer.ColorKind,
          colors
        );

        ground.useVertexColors = true;
      }
    }


    // ========================================================
    // GRAPHICS PRESETS
    // ========================================================

    function applyGraphicsPreset(preset) {

      const regular =
        preset === "REGULAR";

      const filtering =
        regular ? 8 : 2;

      grassTexture.anisotropicFilteringLevel =
        filtering;

      rockTexture.anisotropicFilteringLevel =
        filtering;

      sandTexture.anisotropicFilteringLevel =
        filtering;
    }


    applyGraphicsPreset(
      runtime.graphicsPreset ||
      "BASIC"
    );


    window.addEventListener(
      "mapgame:graphics",
      event => {

        const preset =
          event.detail?.preset ||
          "BASIC";

        applyGraphicsPreset(
          preset
        );
      }
    );


    // ========================================================
    // MAKE AVAILABLE TO OTHER SYSTEMS
    // ========================================================

    window.mapGameTerrain = {

      ground,

      grassTexture,
      rockTexture,
      sandTexture,

      grassMaterial:
        runtime.grassMaterial,

      rockMaterial:
        runtime.rockMaterial,

      sandMaterial
    };


    // ========================================================
    // LOAD CHECKS
    // ========================================================

    grassTexture.onLoadObservable.add(
      () =>
        console.log(
          "✓ Grass texture loaded"
        )
    );

    rockTexture.onLoadObservable.add(
      () =>
        console.log(
          "✓ Rock texture loaded"
        )
    );

    sandTexture.onLoadObservable.add(
      () =>
        console.log(
          "✓ Sand texture loaded"
        )
    );


    console.log(
      "Terrain textures connected."
    );

    if (runtime.showToast) {

      runtime.showToast(
        "Terrain materials loaded",
        "success"
      );
    }
  }


  // ==========================================================
  // WAIT FOR GAME
  // ==========================================================

  if (window.mapGameRuntime) {

    startTerrain(
      window.mapGameRuntime
    );

  } else {

    window.addEventListener(
      "mapgame:runtime-ready",
      event => {

        startTerrain(
          event.detail
        );

      },
      {
        once: true
      }
    );
  }

})();