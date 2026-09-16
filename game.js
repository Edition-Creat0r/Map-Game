const canvas =
  document.getElementById(
    "gameCanvas"
  );

const engine =
  new BABYLON.Engine(
    canvas,
    true
  );

const createScene = () => {
  const scene =
    new BABYLON.Scene(
      engine
    );

  scene.clearColor =
    new BABYLON.Color4(
      0.68,
      0.82,
      0.93,
      1
    );

  // CAMERA
  const camera =
    new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.05,
      55,
      new BABYLON.Vector3(
        0,
        0,
        0
      ),
      scene
    );

  camera.attachControl(
    canvas,
    true
  );

  camera.lowerRadiusLimit = 15;
  camera.upperRadiusLimit = 100;

  // LIGHT
  const light =
    new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(
        0,
        1,
        0
      ),
      scene
    );

  light.intensity = 0.9;

  // GROUND
  const ground =
    BABYLON.MeshBuilder.CreateGround(
      "ground",
      {
        width: 100,
        height: 100
      },
      scene
    );

  const groundMat =
    new BABYLON.StandardMaterial(
      "groundMat",
      scene
    );

  groundMat.diffuseColor =
    new BABYLON.Color3(
      0.25,
      0.55,
      0.22
    );

  ground.material =
    groundMat;

  // TEST BUILDING
  const building =
    BABYLON.MeshBuilder.CreateBox(
      "building",
      {
        width: 8,
        height: 6,
        depth: 8
      },
      scene
    );

  building.position.y = 3;

  const buildingMat =
    new BABYLON.StandardMaterial(
      "buildingMat",
      scene
    );

  buildingMat.diffuseColor =
    new BABYLON.Color3(
      0.6,
      0.68,
      0.75
    );

  building.material =
    buildingMat;

  return scene;
};

const scene =
  createScene();

engine.runRenderLoop(
  () => {
    scene.render();
  }
);

window.addEventListener(
  "resize",
  () => {
    engine.resize();
  }
);
