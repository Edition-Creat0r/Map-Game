// ============================================================
// MAP GAME — terrain.js
// Alpha 0.1.1d Terrain System
// ============================================================

(() => {
  "use strict";

  // Prevent this file from initializing twice.
  if (window.__mapGameTerrainLoaded) {
    return;
  }

  window.__mapGameTerrainLoaded = true;

  function clamp01(value) {
    return Math.max(
      0,
      Math.min(
        1,
        value
      )
    );
  }

  function startTerrain(runtime) {
    if (!runtime) {
      console.error(
        "Terrain: runtime missing"
      );

      return;
    }

    const {
      scene,
      ground,
      grassMaterial
    } = runtime;

    if (!scene) {
      console.error(
        "Terrain: Babylon scene missing"
      );

      return;
    }

    if (!ground) {
      console.error(
        "Terrain: ground mesh missing"
      );

      return;
    }

    if (!grassMaterial) {
      console.error(
        "Terrain: grass material missing"
      );

      return;
    }

    console.log(
      "terrain.js connected"
    );

    // ========================================================
    // REAL GRASS TEXTURE
    // ========================================================

    const grassTexture =
      new BABYLON.Texture(
        "assets/textures/grass/grass_diffuse.jpg",
        scene,
        false,
        false,
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE
      );

    grassTexture.wrapU =
      BABYLON.Texture.WRAP_ADDRESSMODE;

    grassTexture.wrapV =
      BABYLON.Texture.WRAP_ADDRESSMODE;

    // Lower than before so the repeating pattern is less obvious.
    grassTexture.uScale = 14;
    grassTexture.vScale = 14;

    grassMaterial.diffuseTexture =
      grassTexture;

    // Slight tint so the image is not overwhelmingly photographic.
    grassMaterial.diffuseColor =
      new BABYLON.Color3(
        0.76,
        0.86,
        0.70
      );

    // Grass should not look shiny/plastic.
    grassMaterial.specularColor =
      new BABYLON.Color3(
        0.025,
        0.03,
        0.025
      );

    grassMaterial.specularPower =
      8;

    // ========================================================
    // LARGE-SCALE TERRAIN COLOR VARIATION
    // ========================================================
    //
    // The photo texture gives us small grass detail.
    // Vertex colors give us huge natural-looking patches.
    //
    // This is what prevents:
    //
    // grass grass grass grass grass
    //
    // across the entire world.
    // ========================================================

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
        const x =
          positions[i];

        const y =
          positions[i + 1];

        const z =
          positions[i + 2];

        // ----------------------------------------------------
        // MACRO VARIATION
        // ----------------------------------------------------
        //
        // Very large slow waves.
        // These are visible when zoomed out.
        // ----------------------------------------------------

        const macro1 =
          Math.sin(
            x * 0.0022
          ) *
          0.42;

        const macro2 =
          Math.cos(
            z * 0.0025
          ) *
          0.34;

        const macro3 =
          Math.sin(
            (
              x +
              z
            ) *
            0.0013
          ) *
          0.24;

        const macro =
          macro1 +
          macro2 +
          macro3;

        // ----------------------------------------------------
        // MEDIUM VARIATION
        // ----------------------------------------------------
        //
        // Adds smaller terrain-region differences.
        // ----------------------------------------------------

        const medium =
          Math.sin(
            x * 0.0105
          ) *
          Math.cos(
            z * 0.0087
          );

        // ----------------------------------------------------
        // HEIGHT VARIATION
        // ----------------------------------------------------
        //
        // Higher terrain becomes a little less saturated.
        // ----------------------------------------------------

        const heightFactor =
          clamp01(
            (
              y +
              5
            ) /
            90
          );

        // ----------------------------------------------------
        // COMBINE
        // ----------------------------------------------------

        const variation =
          macro *
            0.095 +
          medium *
            0.028;

        let r =
          0.83 +
          variation;

        let g =
          0.92 +
          variation *
            0.72;

        let b =
          0.78 +
          variation *
            0.46;

        // Higher ground trends slightly drier / rockier.
        r +=
          heightFactor *
          0.025;

        g -=
          heightFactor *
          0.035;

        b -=
          heightFactor *
          0.018;

        // Keep everything inside valid color ranges.
        r =
          Math.max(
            0.58,
            Math.min(
              1.0,
              r
            )
          );

        g =
          Math.max(
            0.62,
            Math.min(
              1.0,
              g
            )
          );

        b =
          Math.max(
            0.52,
            Math.min(
              0.96,
              b
            )
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

      ground.useVertexColors =
        true;
    }

    // ========================================================
    // DISTANCE-BASED TEXTURE FEEL
    // ========================================================
    //
    // In Basic mode:
    // slightly cheaper / softer texture.
    //
    // In Regular:
    // sharper filtering.
    // ========================================================

    function applyGraphicsPreset(
      preset
    ) {
      const regular =
        preset ===
        "REGULAR";

      grassTexture.anisotropicFilteringLevel =
        regular
          ? 8
          : 2;

      grassTexture.updateSamplingMode(
        regular
          ? BABYLON.Texture
              .TRILINEAR_SAMPLINGMODE
          : BABYLON.Texture
              .BILINEAR_SAMPLINGMODE
      );

      grassMaterial.specularPower =
        regular
          ? 10
          : 6;
    }

    applyGraphicsPreset(
      runtime.graphicsPreset ||
      "BASIC"
    );

    window.addEventListener(
      "mapgame:graphics",
      event => {
        const preset =
          event.detail &&
          event.detail.preset
            ? event.detail.preset
            : "BASIC";

        applyGraphicsPreset(
          preset
        );
      }
    );

    // ========================================================
    // DEBUG / LOADING FEEDBACK
    // ========================================================

    grassTexture.onLoadObservable.add(
      () => {
        console.log(
          "Terrain: grass texture loaded successfully"
        );

        if (
          runtime.showToast
        ) {
          runtime.showToast(
            "Grass terrain loaded",
            "success"
          );
        }
      }
    );

    grassTexture.onErrorObservable.add(
      message => {
        console.error(
          "Terrain grass texture failed:",
          message
        );

        if (
          runtime.showToast
        ) {
          runtime.showToast(
            "Grass texture failed to load",
            "warning"
          );
        }
      }
    );

    // Make useful pieces available later when we add:
    // normal maps, rock, sand, dirt, biome blending, etc.
    window.mapGameTerrain = {
      grassTexture,
      ground
    };
  }

  // ==========================================================
  // WAIT FOR GAME.JS
  // ==========================================================

  if (
    window.mapGameRuntime
  ) {
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