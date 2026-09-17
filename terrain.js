// MAP GAME — terrain.js
// Alpha 0.1.1d Terrain System

(() => {
  "use strict";

  function startTerrain(runtime) {
    if (!runtime) {
      console.error("Terrain: runtime missing");
      return;
    }

    const {
      scene,
      grassMaterial
    } = runtime;

    if (!scene || !grassMaterial) {
      console.error("Terrain: scene or grass material missing");
      return;
    }

    const grassTexture =
      new BABYLON.Texture(
        "assets/textures/grass/grass_diffuse.jpg",
        scene
      );

    grassTexture.uScale = 40;
    grassTexture.vScale = 40;

    grassMaterial.diffuseTexture =
      grassTexture;

    if (runtime.showToast) {
      runtime.showToast(
        "Real grass texture loaded",
        "success"
      );
    }

    console.log(
      "terrain.js: grass texture connected"
    );
  }

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