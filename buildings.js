// ============================================================
// MAP GAME — buildings.js
// Alpha 0.1.1e
// Architecture System Foundation
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameBuildingsLoaded) return;
  window.__mapGameBuildingsLoaded = true;

  function startBuildings(runtime) {
    if (!runtime || !runtime.scene) {
      console.error("Buildings: runtime missing");
      return;
    }

    const scene = runtime.scene;

    console.log("Building system connected");


    // ========================================================
    // MATERIAL HELPER
    // ========================================================

    function makeMaterial(name, r, g, b) {
      const mat =
        new BABYLON.StandardMaterial(
          name,
          scene
        );

      mat.diffuseColor =
        new BABYLON.Color3(
          r,
          g,
          b
        );

      mat.specularColor =
        new BABYLON.Color3(
          0.04,
          0.04,
          0.04
        );

      return mat;
    }


    const wallMaterial =
      makeMaterial(
        "buildingWall",
        0.48,
        0.52,
        0.56
      );

    const darkWallMaterial =
      makeMaterial(
        "buildingDarkWall",
        0.25,
        0.29,
        0.33
      );

    const roofMaterial =
      makeMaterial(
        "buildingRoof",
        0.12,
        0.14,
        0.16
      );

    const trimMaterial =
      makeMaterial(
        "buildingTrim",
        0.70,
        0.72,
        0.74
      );

    const doorMaterial =
      makeMaterial(
        "buildingDoor",
        0.08,
        0.10,
        0.12
      );


    // ========================================================
    // WINDOW MATERIAL
    // ========================================================

    const windowMaterial =
      new BABYLON.StandardMaterial(
        "buildingWindow",
        scene
      );

    windowMaterial.diffuseColor =
      new BABYLON.Color3(
        0.12,
        0.28,
        0.38
      );

    windowMaterial.specularColor =
      new BABYLON.Color3(
        0.35,
        0.40,
        0.45
      );

    windowMaterial.specularPower =
      64;


    // ========================================================
    // BASIC RESIDENTIAL BUILDING
    // ========================================================

    function createBasicResidential(
      x,
      z,
      options = {}
    ) {

      const width =
        options.width || 18;

      const depth =
        options.depth || 16;

      const floors =
        options.floors || 4;

      const floorHeight = 4;

      const height =
        floors * floorHeight;

      const root =
        new BABYLON.TransformNode(
          "residentialBasic",
          scene
        );

      root.position.x = x;
      root.position.z = z;


      // ------------------------------------------------------
      // MAIN STRUCTURE
      // ------------------------------------------------------

      const body =
        BABYLON.MeshBuilder.CreateBox(
          "buildingBody",
          {
            width,
            depth,
            height
          },
          scene
        );

      body.position.y =
        height / 2;

      body.material =
        wallMaterial;

      body.parent =
        root;


      // ------------------------------------------------------
      // ROOF CAP
      // ------------------------------------------------------

      const roof =
        BABYLON.MeshBuilder.CreateBox(
          "buildingRoof",
          {
            width:
              width + 1.2,

            depth:
              depth + 1.2,

            height:
              0.8
          },
          scene
        );

      roof.position.y =
        height + 0.4;

      roof.material =
        roofMaterial;

      roof.parent =
        root;


      // ------------------------------------------------------
      // ENTRANCE
      // ------------------------------------------------------

      const entrance =
        BABYLON.MeshBuilder.CreateBox(
          "buildingEntrance",
          {
            width: 3.4,
            height: 3.2,
            depth: 0.5
          },
          scene
        );

      entrance.position.set(
        0,
        1.6,
        -depth / 2 - 0.26
      );

      entrance.material =
        doorMaterial;

      entrance.parent =
        root;


      // ------------------------------------------------------
      // WINDOWS
      // ------------------------------------------------------

      const windowWidth =
        2.2;

      const windowHeight =
        1.6;

      const windowsAcross =
        Math.max(
          2,
          Math.floor(
            width / 5
          )
        );


      for (
        let floor = 0;
        floor < floors;
        floor++
      ) {

        for (
          let column = 0;
          column < windowsAcross;
          column++
        ) {

          const spacing =
            width /
            windowsAcross;

          const windowX =
            -width / 2 +
            spacing / 2 +
            column * spacing;


          const frontWindow =
            BABYLON.MeshBuilder.CreateBox(
              "window",
              {
                width:
                  windowWidth,

                height:
                  windowHeight,

                depth:
                  0.18
              },
              scene
            );

          frontWindow.position.set(
            windowX,
            floor * floorHeight + 2.2,
            -depth / 2 - 0.12
          );

          frontWindow.material =
            windowMaterial;

          frontWindow.parent =
            root;


          const rearWindow =
            frontWindow.clone(
              "rearWindow"
            );

          rearWindow.position.z =
            depth / 2 + 0.12;

          rearWindow.parent =
            root;
        }
      }


      // ------------------------------------------------------
      // SIMPLE ROOF UNIT
      // ------------------------------------------------------

      const roofUnit =
        BABYLON.MeshBuilder.CreateBox(
          "roofUnit",
          {
            width: 5,
            depth: 4,
            height: 2
          },
          scene
        );

      roofUnit.position.set(
        width * 0.18,
        height + 1.4,
        0
      );

      roofUnit.material =
        darkWallMaterial;

      roofUnit.parent =
        root;


      // ------------------------------------------------------
      // BOTTOM TRIM
      // ------------------------------------------------------

      const bottomTrim =
        BABYLON.MeshBuilder.CreateBox(
          "buildingTrim",
          {
            width:
              width + 0.5,

            depth:
              depth + 0.5,

            height:
              0.5
          },
          scene
        );

      bottomTrim.position.y =
        0.25;

      bottomTrim.material =
        trimMaterial;

      bottomTrim.parent =
        root;


      return root;
    }


    // ========================================================
    // REGULAR RESIDENTIAL BUILDING
    // ========================================================

    function createRegularResidential(
      x,
      z,
      options = {}
    ) {

      const root =
        createBasicResidential(
          x,
          z,
          options
        );

      const width =
        options.width || 18;

      const depth =
        options.depth || 16;

      const floors =
        options.floors || 4;

      const height =
        floors * 4;


      // ------------------------------------------------------
      // CORNER COLUMNS
      // ------------------------------------------------------

      const columnPositions = [
        [
          -width / 2,
          -depth / 2
        ],

        [
          width / 2,
          -depth / 2
        ],

        [
          -width / 2,
          depth / 2
        ],

        [
          width / 2,
          depth / 2
        ]
      ];


      columnPositions.forEach(
        position => {

          const column =
            BABYLON.MeshBuilder.CreateBox(
              "architectureColumn",
              {
                width: 0.6,
                depth: 0.6,
                height:
                  height + 1
              },
              scene
            );

          column.position.set(
            position[0],
            height / 2,
            position[1]
          );

          column.material =
            trimMaterial;

          column.parent =
            root;
        }
      );


      // ------------------------------------------------------
      // FRONT AWNING
      // ------------------------------------------------------

      const awning =
        BABYLON.MeshBuilder.CreateBox(
          "entranceAwning",
          {
            width: 6,
            depth: 2.6,
            height: 0.35
          },
          scene
        );

      awning.position.set(
        0,
        4,
        -depth / 2 - 1
      );

      awning.material =
        roofMaterial;

      awning.parent =
        root;


      // ------------------------------------------------------
      // BALCONIES
      // ------------------------------------------------------

      for (
        let floor = 1;
        floor < floors;
        floor += 2
      ) {

        const balcony =
          BABYLON.MeshBuilder.CreateBox(
            "balcony",
            {
              width:
                width * 0.36,

              depth:
                1.5,

              height:
                0.3
            },
            scene
          );

        balcony.position.set(
          width * 0.22,
          floor * 4 + 1,
          -depth / 2 - 0.7
        );

        balcony.material =
          trimMaterial;

        balcony.parent =
          root;
      }


      return root;
    }


    // ========================================================
    // PRESET SELECTOR
    // ========================================================

    function createResidential(
      x,
      z,
      options = {}
    ) {

      const preset =
        runtime.graphicsPreset ||
        "BASIC";

      if (
        preset ===
        "REGULAR"
      ) {

        return createRegularResidential(
          x,
          z,
          options
        );
      }

      return createBasicResidential(
        x,
        z,
        options
      );
    }


    // ========================================================
    // TEST BUILDINGS
    // ========================================================

    // Temporary test buildings.
    // We can remove these once the real city generator uses
    // the architecture system.

    createResidential(
      40,
      40,
      {
        width: 18,
        depth: 16,
        floors: 4
      }
    );

    createResidential(
      70,
      40,
      {
        width: 22,
        depth: 18,
        floors: 7
      }
    );

    createResidential(
      100,
      40,
      {
        width: 16,
        depth: 14,
        floors: 3
      }
    );


    // ========================================================
    // PUBLIC API
    // ========================================================

    window.mapGameBuildings = {
      createResidential,
      createBasicResidential,
      createRegularResidential
    };


    if (runtime.showToast) {
      runtime.showToast(
        "Architecture system loaded",
        "success"
      );
    }
  }


  // ==========================================================
  // WAIT FOR GAME
  // ==========================================================

  if (window.mapGameRuntime) {

    startBuildings(
      window.mapGameRuntime
    );

  } else {

    window.addEventListener(
      "mapgame:runtime-ready",
      event => {

        startBuildings(
          event.detail
        );

      },
      {
        once: true
      }
    );
  }

})();