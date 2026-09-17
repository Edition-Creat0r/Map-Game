// ============================================================
// MAP GAME — materials.js
// Alpha 0.1.1c procedural surface pass
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameMaterialsLoaded) return;
  window.__mapGameMaterialsLoaded = true;

  function start(runtime) {
    if (!runtime || !runtime.scene || !window.BABYLON) return;

    const { scene } = runtime;

    function texture(
      name,
      base,
      variation,
      size = 256,
      speckle = 0.12
    ) {
      const tex =
        new BABYLON.DynamicTexture(
          name,
          {
            width: size,
            height: size
          },
          scene,
          false
        );

      const ctx =
        tex.getContext();

      const img =
        ctx.createImageData(
          size,
          size
        );

      for (
        let y = 0;
        y < size;
        y++
      ) {
        for (
          let x = 0;
          x < size;
          x++
        ) {
          const i =
            (
              y * size +
              x
            ) *
            4;

          const wave =
            Math.sin(
              x * .095
            ) *
              .34 +
            Math.sin(
              y * .071
            ) *
              .26 +
            Math.sin(
              (
                x + y
              ) *
              .031
            ) *
              .22;

          const p =
            Math.sin(
              x * 12.9898 +
              y * 78.233
            ) *
            43758.5453;

          const noise =
            (
              p -
              Math.floor(p)
            ) *
              2 -
            1;

          const amount =
            wave * .46 +
            noise * speckle;

          for (
            let c = 0;
            c < 3;
            c++
          ) {
            img.data[
              i + c
            ] =
              Math.max(
                0,
                Math.min(
                  255,
                  (
                    base[c] +
                    amount *
                      variation[c]
                  ) *
                    255
                )
              );
          }

          img.data[i + 3] =
            255;
        }
      }

      ctx.putImageData(
        img,
        0,
        0
      );

      tex.update(false);
      tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
      return tex;
    }

    function apply(
      material,
      tex,
      scale
    ) {
      if (!material) return;

      material.diffuseTexture =
        tex;

      tex.uScale =
        scale;

      tex.vScale =
        scale;

      material.specularColor =
        new BABYLON.Color3(
          .04,
          .05,
          .055
        );

      material.specularPower =
        12;
    }

    const grass =
      texture(
        "grassSurface",
        [.17,.38,.13],
        [.10,.15,.07],
        256,
        .15
      );

    const grassLight =
      texture(
        "grassLightSurface",
        [.27,.47,.17],
        [.12,.16,.08],
        256,
        .12
      );

    const dirt =
      texture(
        "dirtSurface",
        [.33,.24,.14],
        [.16,.12,.08],
        256,
        .22
      );

    const rock =
      texture(
        "rockSurface",
        [.29,.31,.32],
        [.17,.18,.18],
        256,
        .20
      );

    const road =
      texture(
        "roadSurface",
        [.065,.071,.079],
        [.06,.06,.06],
        256,
        .16
      );

    apply(
      runtime.grassMaterial,
      grass,
      20
    );

    apply(
      runtime.grassLightMaterial,
      grassLight,
      16
    );

    apply(
      runtime.dirtMaterial,
      dirt,
      12
    );

    apply(
      runtime.rockMaterial,
      rock,
      7
    );

    apply(
      runtime.roadMaterial,
      road,
      8
    );

    [
      runtime.treeLeafMaterial,
      runtime.treeLeafAltMaterial,
      runtime.treeTrunkMaterial
    ].forEach(
      material => {
        if (!material) return;
        material.specularColor =
          BABYLON.Color3.Black();
        material.specularPower =
          3;
      }
    );

    window.mapGameMaterials = {
      grass,
      grassLight,
      dirt,
      rock,
      road
    };
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
