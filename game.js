// ============================================================
// MAP GAME — Alpha 0.0.5
// WORLD + INTERFACE EXPANSION
// Standalone GitHub Pages / Babylon.js build
//
// Includes:
// - much larger world
// - terrain regions / hills
// - river + bridges
// - city center + residential + industrial + power districts
// - mining zone + forests + rocks
// - power pylons
// - improved top HUD
// - left navigation bar
// - contextual right-side panel
// - bottom status / build bar
// - upgraded construction terminal with working category tabs
// - keyboard + arrow + touch movement
// - save/load + offline cash
//
// This file is meant to replace your current game.js.
// ============================================================

const canvas = document.getElementById("gameCanvas");

const engine = new BABYLON.Engine(
  canvas,
  true,
  {
    preserveDrawingBuffer: true,
    stencil: true
  }
);

// ============================================================
// SCENE
// ============================================================

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(
    0.66,
    0.80,
    0.92,
    1
  );

  // =========================================================
  // GLOBAL GAME STATE
  // =========================================================

  let money = 25000;
  let iron = 40;
  let steel = 20;
  let energy = 150;
  let population = 2200;
  let incomePerMinute = 120;

  let townHallLevel = 1;

  const SAVE_KEY = "mapGame_alpha005_world_ui";

  // =========================================================
  // WORLD CONSTANTS
  // =========================================================

  const MAP_SIZE = 760;
  const MAP_HALF = MAP_SIZE / 2;

  const regions = [
    {
      id: "capital",
      name: "Capital District",
      type: "Urban",
      x: 0,
      z: -35,
      radius: 95,
      description: "Administrative and commercial core of your civilization."
    },
    {
      id: "northForest",
      name: "Northern Forest",
      type: "Forest",
      x: 15,
      z: -220,
      radius: 110,
      description: "Dense forest and rolling hills. Good future area for lumber and expansion."
    },
    {
      id: "northWestMine",
      name: "Northwest Mining Zone",
      type: "Mining",
      x: -220,
      z: -185,
      radius: 100,
      description: "Rocky terrain with rich mineral deposits."
    },
    {
      id: "eastIndustry",
      name: "Eastern Industry",
      type: "Industrial",
      x: 220,
      z: -70,
      radius: 110,
      description: "Heavy industry, steel production, and future manufacturing."
    },
    {
      id: "westPower",
      name: "Western Power District",
      type: "Power",
      x: -220,
      z: 70,
      radius: 100,
      description: "Power generation and grid infrastructure."
    },
    {
      id: "southResidential",
      name: "Southern Residential Expansion",
      type: "Residential",
      x: 30,
      z: 190,
      radius: 125,
      description: "Large future civilian growth area."
    },
    {
      id: "southEastOpen",
      name: "Southeast Development Reserve",
      type: "Open Land",
      x: 220,
      z: 190,
      radius: 120,
      description: "Open land reserved for future military, transport, or airport development."
    }
  ];

  // =========================================================
  // FOG
  // =========================================================

  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.00165;

  scene.fogColor = new BABYLON.Color3(
    0.66,
    0.80,
    0.92
  );

  // =========================================================
  // CAMERA
  // =========================================================

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.02,
    160,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );

  camera.attachControl(canvas, true);

  camera.lowerRadiusLimit = 28;
  camera.upperRadiusLimit = 360;

  camera.lowerBetaLimit = 0.28;
  camera.upperBetaLimit = 1.35;

  camera.wheelPrecision = 30;
  camera.inertia = 0.82;
  camera.panningInertia = 0.86;
  camera.panningSensibility = 85;

  // =========================================================
  // LIGHTING
  // =========================================================

  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );

  hemi.intensity = 0.58;

  const sun = new BABYLON.DirectionalLight(
    "sun",
    new BABYLON.Vector3(-0.52, -1, -0.38),
    scene
  );

  sun.position = new BABYLON.Vector3(
    190,
    260,
    150
  );

  sun.intensity = 1.05;

  const shadowGenerator = new BABYLON.ShadowGenerator(
    1024,
    sun
  );

  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 14;

  // =========================================================
  // MATERIAL HELPERS
  // =========================================================

  function makeMaterial(name, r, g, b) {
    const mat = new BABYLON.StandardMaterial(name, scene);

    mat.diffuseColor = new BABYLON.Color3(
      r,
      g,
      b
    );

    return mat;
  }

  const grassMat = makeMaterial(
    "grassMat",
    0.21,
    0.46,
    0.17
  );

  const dirtMat = makeMaterial(
    "dirtMat",
    0.36,
    0.28,
    0.17
  );

  const roadMat = makeMaterial(
    "roadMat",
    0.08,
    0.095,
    0.11
  );

  const roadEdgeMat = makeMaterial(
    "roadEdgeMat",
    0.34,
    0.36,
    0.38
  );

  const lineMat = makeMaterial(
    "lineMat",
    0.92,
    0.82,
    0.28
  );

  const concreteMat = makeMaterial(
    "concreteMat",
    0.56,
    0.61,
    0.66
  );

  const darkMat = makeMaterial(
    "darkMat",
    0.035,
    0.045,
    0.06
  );

  const industrialMat = makeMaterial(
    "industrialMat",
    0.34,
    0.41,
    0.47
  );

  const mineMat = makeMaterial(
    "mineMat",
    0.20,
    0.22,
    0.25
  );

  const powerMat = makeMaterial(
    "powerMat",
    0.50,
    0.39,
    0.11
  );

  const treeTrunkMat = makeMaterial(
    "treeTrunkMat",
    0.28,
    0.14,
    0.055
  );

  const treeLeafMat = makeMaterial(
    "treeLeafMat",
    0.085,
    0.31,
    0.095
  );

  const treeLeafAltMat = makeMaterial(
    "treeLeafAltMat",
    0.12,
    0.39,
    0.12
  );

  const rockMat = makeMaterial(
    "rockMat",
    0.29,
    0.31,
    0.33
  );

  const pylonMat = makeMaterial(
    "pylonMat",
    0.27,
    0.30,
    0.33
  );

  const glassMat = new BABYLON.StandardMaterial(
    "glassMat",
    scene
  );

  glassMat.diffuseColor = new BABYLON.Color3(
    0.11,
    0.43,
    0.68
  );

  glassMat.alpha = 0.60;

  glassMat.specularColor = new BABYLON.Color3(
    0.8,
    0.9,
    1.0
  );

  // =========================================================
  // TERRAIN
  // =========================================================

  const ground = BABYLON.MeshBuilder.CreateGround(
    "ground",
    {
      width: MAP_SIZE,
      height: MAP_SIZE,
      subdivisions: 110
    },
    scene
  );

  ground.material = grassMat;
  ground.receiveShadows = true;
  ground.isPickable = true;

  const positions = ground.getVerticesData(
    BABYLON.VertexBuffer.PositionKind
  );

  if (positions) {
    for (
      let i = 0;
      i < positions.length;
      i += 3
    ) {
      const x = positions[i];
      const z = positions[i + 2];

      let height =
        Math.sin(x * 0.014) * 3.2 +
        Math.cos(z * 0.012) * 3.0 +
        Math.sin((x + z) * 0.009) * 2.0 +
        Math.cos((x - z) * 0.006) * 1.5;

      // Capital area flatter
      const capitalDistance = Math.sqrt(
        x * x +
        (z + 35) * (z + 35)
      );

      if (capitalDistance < 120) {
        height *= 0.12;
      }

      // Southern residential area slightly smoother
      const southDistance = Math.sqrt(
        (x - 30) * (x - 30) +
        (z - 190) * (z - 190)
      );

      if (southDistance < 130) {
        height *= 0.35;
      }

      // Northwest mining zone more rugged
      const miningDistance = Math.sqrt(
        (x + 220) * (x + 220) +
        (z + 185) * (z + 185)
      );

      if (miningDistance < 120) {
        height +=
          Math.sin(x * 0.045) * 3 +
          Math.cos(z * 0.055) * 3;
      }

      positions[i + 1] = height;
    }

    ground.updateVerticesData(
      BABYLON.VertexBuffer.PositionKind,
      positions
    );

    ground.refreshBoundingInfo();
  }

  // =========================================================
  // RIVER
  // =========================================================

  const waterMat = new BABYLON.StandardMaterial(
    "waterMat",
    scene
  );

  waterMat.diffuseColor = new BABYLON.Color3(
    0.06,
    0.31,
    0.52
  );

  waterMat.alpha = 0.84;

  waterMat.specularColor = new BABYLON.Color3(
    0.72,
    0.90,
    1.0
  );

  function createRiverSegment(
    x,
    z,
    width,
    depth,
    rotation
  ) {
    const river = BABYLON.MeshBuilder.CreateGround(
      "riverSegment",
      {
        width,
        height: depth,
        subdivisions: 1
      },
      scene
    );

    river.position = new BABYLON.Vector3(
      x,
      -0.32,
      z
    );

    river.rotation.y = rotation;
    river.material = waterMat;
    river.isPickable = false;

    return river;
  }

  createRiverSegment(
    -150,
    110,
    220,
    32,
    Math.PI / 16
  );

  createRiverSegment(
    50,
    135,
    250,
    34,
    -Math.PI / 20
  );

  createRiverSegment(
    245,
    160,
    170,
    30,
    Math.PI / 14
  );

  // =========================================================
  // ROADS
  // =========================================================

  function createRoad(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const road = BABYLON.MeshBuilder.CreateBox(
      "road",
      {
        width,
        height: 0.12,
        depth
      },
      scene
    );

    road.position = new BABYLON.Vector3(
      x,
      0.10,
      z
    );

    road.rotation.y = rotation;
    road.material = roadMat;
    road.receiveShadows = true;
    road.isPickable = false;

    return road;
  }

  function createRoadEdge(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const edge = BABYLON.MeshBuilder.CreateBox(
      "roadEdge",
      {
        width,
        height: 0.06,
        depth
      },
      scene
    );

    edge.position = new BABYLON.Vector3(
      x,
      0.07,
      z
    );

    edge.rotation.y = rotation;
    edge.material = roadEdgeMat;
    edge.isPickable = false;

    return edge;
  }

  function createRoadLine(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const line = BABYLON.MeshBuilder.CreateBox(
      "roadLine",
      {
        width,
        height: 0.025,
        depth
      },
      scene
    );

    line.position = new BABYLON.Vector3(
      x,
      0.17,
      z
    );

    line.rotation.y = rotation;
    line.material = lineMat;
    line.isPickable = false;

    return line;
  }

  // Main north/south avenue
  createRoadEdge(
    0,
    -45,
    18,
    360
  );

  createRoad(
    0,
    -45,
    13,
    360
  );

  // Main east/west avenue
  createRoadEdge(
    0,
    -35,
    390,
    18
  );

  createRoad(
    0,
    -35,
    390,
    13
  );

  // East industrial road
  createRoadEdge(
    185,
    -85,
    16,
    220
  );

  createRoad(
    185,
    -85,
    11,
    220
  );

  // West power road
  createRoadEdge(
    -190,
    25,
    16,
    210
  );

  createRoad(
    -190,
    25,
    11,
    210
  );

  // Southern residential road
  createRoadEdge(
    10,
    190,
    320,
    16
  );

  createRoad(
    10,
    190,
    320,
    11
  );

  // Southeast future expansion
  createRoadEdge(
    215,
    160,
    14,
    150,
    -Math.PI / 12
  );

  createRoad(
    215,
    160,
    10,
    150,
    -Math.PI / 12
  );

  // Road markings
  for (
    let z = -210;
    z <= 120;
    z += 18
  ) {
    createRoadLine(
      0,
      z,
      0.65,
      7
    );
  }

  for (
    let x = -185;
    x <= 185;
    x += 18
  ) {
    createRoadLine(
      x,
      -35,
      7,
      0.65
    );
  }

  // =========================================================
  // BRIDGES
  // =========================================================

  function createBridge(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const bridgeBase = BABYLON.MeshBuilder.CreateBox(
      "bridgeBase",
      {
        width,
        height: 0.55,
        depth
      },
      scene
    );

    bridgeBase.position = new BABYLON.Vector3(
      x,
      1.05,
      z
    );

    bridgeBase.rotation.y = rotation;
    bridgeBase.material = roadMat;

    const rail1 = BABYLON.MeshBuilder.CreateBox(
      "bridgeRail",
      {
        width: 0.45,
        height: 1.1,
        depth
      },
      scene
    );

    rail1.position = new BABYLON.Vector3(
      x - width / 2 + 0.35,
      1.75,
      z
    );

    rail1.rotation.y = rotation;
    rail1.material = concreteMat;

    const rail2 = rail1.clone(
      "bridgeRail2"
    );

    rail2.position.x =
      x + width / 2 - 0.35;

    shadowGenerator.addShadowCaster(
      bridgeBase
    );

    return bridgeBase;
  }

  createBridge(
    0,
    115,
    13,
    60
  );

  createBridge(
    190,
    145,
    11,
    46,
    -Math.PI / 12
  );

  // =========================================================
  // BUILDING HELPERS
  // =========================================================

  function markInteractive(
    mesh,
    type,
    displayName,
    data = {}
  ) {
    mesh.metadata = {
      interactiveType: type,
      displayName,
      ...data
    };

    mesh.isPickable = true;
  }

  function createModernBuilding(
    x,
    z,
    w,
    h,
    d,
    glassAmount = 0.65,
    name = "Building",
    type = "building"
  ) {
    const body = BABYLON.MeshBuilder.CreateBox(
      "modernBuilding",
      {
        width: w,
        height: h,
        depth: d
      },
      scene
    );

    body.position = new BABYLON.Vector3(
      x,
      h / 2,
      z
    );

    body.material = concreteMat;

    shadowGenerator.addShadowCaster(
      body
    );

    const glassFront = BABYLON.MeshBuilder.CreateBox(
      "glassFront",
      {
        width: w * glassAmount,
        height: h * 0.58,
        depth: 0.3
      },
      scene
    );

    glassFront.position = new BABYLON.Vector3(
      x,
      h * 0.52,
      z - d / 2 - 0.16
    );

    glassFront.material = glassMat;
    glassFront.isPickable = false;

    const top = BABYLON.MeshBuilder.CreateBox(
      "buildingTop",
      {
        width: w + 0.8,
        height: 0.7,
        depth: d + 0.8
      },
      scene
    );

    top.position = new BABYLON.Vector3(
      x,
      h + 0.35,
      z
    );

    top.material = darkMat;
    top.isPickable = false;

    const sideStrip = BABYLON.MeshBuilder.CreateBox(
      "sideStrip",
      {
        width: 0.8,
        height: h,
        depth: d + 0.2
      },
      scene
    );

    sideStrip.position = new BABYLON.Vector3(
      x - w / 2 + 0.4,
      h / 2,
      z
    );

    sideStrip.material = darkMat;
    sideStrip.isPickable = false;

    markInteractive(
      body,
      type,
      name,
      {
        level: 1
      }
    );

    return body;
  }

  // =========================================================
  // CAPITAL CITY
  // =========================================================

  createModernBuilding(
    0,
    -62,
    24,
    13,
    20,
    0.78,
    "Central Administration",
    "townHall"
  );

  createModernBuilding(
    34,
    -68,
    13,
    26,
    13,
    0.82,
    "Commerce Tower",
    "commercial"
  );

  createModernBuilding(
    -34,
    -66,
    14,
    18,
    14,
    0.74,
    "Civic Offices",
    "commercial"
  );

  createModernBuilding(
    32,
    -18,
    15,
    16,
    15,
    0.72,
    "Central Apartments",
    "residential"
  );

  createModernBuilding(
    -35,
    -18,
    14,
    14,
    14,
    0.70,
    "Central Apartments",
    "residential"
  );

  createModernBuilding(
    62,
    -62,
    12,
    20,
    12,
    0.76,
    "Tech Offices",
    "commercial"
  );

  createModernBuilding(
    -64,
    -62,
    12,
    17,
    12,
    0.72,
    "Municipal Offices",
    "commercial"
  );

  // =========================================================
  // RESIDENTIAL DISTRICTS
  // =========================================================

  function createResidentialBlock(
    startX,
    startZ,
    columns,
    rows,
    spacingX,
    spacingZ
  ) {
    for (
      let row = 0;
      row < rows;
      row++
    ) {
      for (
        let col = 0;
        col < columns;
        col++
      ) {
        const x =
          startX +
          col * spacingX;

        const z =
          startZ +
          row * spacingZ;

        const height =
          6 +
          Math.floor(
            Math.random() * 8
          );

        createModernBuilding(
          x,
          z,
          10,
          height,
          10,
          0.58,
          "Residential Block",
          "residential"
        );
      }
    }
  }

  createResidentialBlock(
    -72,
    28,
    5,
    3,
    23,
    23
  );

  createResidentialBlock(
    -90,
    205,
    7,
    3,
    28,
    26
  );

  // =========================================================
  // IRON MINE COMPLEX
  // =========================================================

  const mineBase = BABYLON.MeshBuilder.CreateBox(
    "mineBase",
    {
      width: 28,
      height: 7,
      depth: 24
    },
    scene
  );

  mineBase.position = new BABYLON.Vector3(
    -220,
    3.5,
    -185
  );

  mineBase.material = mineMat;

  markInteractive(
    mineBase,
    "ironMine",
    "Iron Mine Complex",
    {
      level: 1,
      production: "+3 Iron / cycle",
      consumption: "-1 Energy"
    }
  );

  shadowGenerator.addShadowCaster(
    mineBase
  );

  const mineTower = BABYLON.MeshBuilder.CreateCylinder(
    "mineTower",
    {
      diameter: 10,
      height: 18,
      tessellation: 8
    },
    scene
  );

  mineTower.position = new BABYLON.Vector3(
    -220,
    12,
    -185
  );

  mineTower.material = darkMat;
  mineTower.isPickable = false;

  const mineShed = BABYLON.MeshBuilder.CreateBox(
    "mineShed",
    {
      width: 18,
      height: 5,
      depth: 12
    },
    scene
  );

  mineShed.position = new BABYLON.Vector3(
    -192,
    2.5,
    -195
  );

  mineShed.material = industrialMat;
  mineShed.isPickable = false;

  // =========================================================
  // STEEL / INDUSTRIAL DISTRICT
  // =========================================================

  const steelMill = BABYLON.MeshBuilder.CreateBox(
    "steelMill",
    {
      width: 34,
      height: 10,
      depth: 26
    },
    scene
  );

  steelMill.position = new BABYLON.Vector3(
    220,
    5,
    -95
  );

  steelMill.material = industrialMat;

  markInteractive(
    steelMill,
    "steelMill",
    "Eastern Steel Mill",
    {
      level: 1,
      production: "+1 Steel / cycle",
      consumption: "-3 Iron, -2 Energy"
    }
  );

  shadowGenerator.addShadowCaster(
    steelMill
  );

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    const chimney = BABYLON.MeshBuilder.CreateCylinder(
      "steelChimney" + i,
      {
        diameter: 4,
        height: 25,
        tessellation: 16
      },
      scene
    );

    chimney.position = new BABYLON.Vector3(
      205 + i * 11,
      13,
      -105
    );

    chimney.material = darkMat;
    chimney.isPickable = false;

    shadowGenerator.addShadowCaster(
      chimney
    );
  }

  const factory2 = BABYLON.MeshBuilder.CreateBox(
    "factory2",
    {
      width: 32,
      height: 8,
      depth: 22
    },
    scene
  );

  factory2.position = new BABYLON.Vector3(
    228,
    4,
    -45
  );

  factory2.material = industrialMat;

  markInteractive(
    factory2,
    "factory",
    "Industrial Fabrication Plant",
    {
      level: 1,
      production: "Future manufacturing"
    }
  );

  // =========================================================
  // POWER DISTRICT
  // =========================================================

  const powerPlant = BABYLON.MeshBuilder.CreateBox(
    "powerPlant",
    {
      width: 30,
      height: 10,
      depth: 26
    },
    scene
  );

  powerPlant.position = new BABYLON.Vector3(
    -220,
    5,
    70
  );

  powerPlant.material = powerMat;

  markInteractive(
    powerPlant,
    "powerPlant",
    "Western Power Plant",
    {
      level: 1,
      production: "+8 Energy / cycle"
    }
  );

  shadowGenerator.addShadowCaster(
    powerPlant
  );

  for (
    let i = 0;
    i < 2;
    i++
  ) {
    const coolingTower = BABYLON.MeshBuilder.CreateCylinder(
      "coolingTower" + i,
      {
        diameterTop: 10,
        diameterBottom: 15,
        height: 24,
        tessellation: 20
      },
      scene
    );

    coolingTower.position = new BABYLON.Vector3(
      -235 + i * 28,
      14,
      70
    );

    coolingTower.material = concreteMat;
    coolingTower.isPickable = false;

    shadowGenerator.addShadowCaster(
      coolingTower
    );
  }

  // =========================================================
  // POWER PYLONS
  // =========================================================

  function createPylon(
    x,
    z
  ) {
    const base = BABYLON.MeshBuilder.CreateBox(
      "pylonBase",
      {
        width: 2,
        height: 16,
        depth: 2
      },
      scene
    );

    base.position = new BABYLON.Vector3(
      x,
      8,
      z
    );

    base.material = pylonMat;
    base.isPickable = false;

    const arm1 = BABYLON.MeshBuilder.CreateBox(
      "pylonArm",
      {
        width: 10,
        height: 1,
        depth: 1
      },
      scene
    );

    arm1.position = new BABYLON.Vector3(
      x,
      13,
      z
    );

    arm1.material = pylonMat;
    arm1.isPickable = false;

    const arm2 = arm1.clone(
      "pylonArm2"
    );

    arm2.position.y = 10;

    shadowGenerator.addShadowCaster(
      base
    );
  }

  for (
    let i = 0;
    i < 7;
    i++
  ) {
    createPylon(
      -185 + i * 28,
      95 + i * 5
    );
  }

  // =========================================================
  // TREES
  // =========================================================

  function createTree(
    x,
    z,
    scale = 1,
    alt = false
  ) {
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      "treeTrunk",
      {
        diameter: 0.9 * scale,
        height: 4 * scale,
        tessellation: 8
      },
      scene
    );

    trunk.position = new BABYLON.Vector3(
      x,
      2 * scale,
      z
    );

    trunk.material = treeTrunkMat;
    trunk.isPickable = false;

    const crown = BABYLON.MeshBuilder.CreateSphere(
      "treeCrown",
      {
        diameter: 5.5 * scale,
        segments: 7
      },
      scene
    );

    crown.position = new BABYLON.Vector3(
      x,
      5 * scale,
      z
    );

    crown.material =
      alt
        ? treeLeafAltMat
        : treeLeafMat;

    crown.isPickable = false;
  }

  // Northern forest cluster
  for (
    let i = 0;
    i < 125;
    i++
  ) {
    const angle =
      Math.random() *
      Math.PI *
      2;

    const radius =
      Math.sqrt(
        Math.random()
      ) *
      140;

    const x =
      15 +
      Math.cos(angle) *
      radius;

    const z =
      -220 +
      Math.sin(angle) *
      radius;

    createTree(
      x,
      z,
      0.8 +
      Math.random() * 0.8,
      Math.random() > 0.55
    );
  }

  // General scattered trees
  for (
    let i = 0;
    i < 95;
    i++
  ) {
    const x =
      Math.random() *
      680 -
      340;

    const z =
      Math.random() *
      680 -
      340;

    const distCapital = Math.sqrt(
      x * x +
      (z + 35) * (z + 35)
    );

    const riverDistance =
      Math.abs(z - 135);

    if (
      distCapital > 130 &&
      riverDistance > 38
    ) {
      createTree(
        x,
        z,
        0.75 +
        Math.random() * 0.65,
        Math.random() > 0.65
      );
    }
  }

  // =========================================================
  // ROCK FORMATIONS
  // =========================================================

  function createRock(
    x,
    z,
    size
  ) {
    const rock = BABYLON.MeshBuilder.CreateSphere(
      "rock",
      {
        diameter: size,
        segments: 6
      },
      scene
    );

    rock.position = new BABYLON.Vector3(
      x,
      size * 0.23,
      z
    );

    rock.scaling.y =
      0.55 +
      Math.random() * 0.35;

    rock.scaling.x =
      0.75 +
      Math.random() * 0.4;

    rock.material = rockMat;
    rock.isPickable = false;

    shadowGenerator.addShadowCaster(
      rock
    );
  }

  // Northwest rocky zone
  for (
    let i = 0;
    i < 55;
    i++
  ) {
    const angle =
      Math.random() *
      Math.PI *
      2;

    const radius =
      Math.sqrt(
        Math.random()
      ) *
      120;

    createRock(
      -220 +
      Math.cos(angle) *
      radius,
      -185 +
      Math.sin(angle) *
      radius,
      3 +
      Math.random() * 7
    );
  }

  // =========================================================
  // UI HELPERS
  // =========================================================

  function uiPanelBase() {
    return `
      background:
        linear-gradient(
          180deg,
          rgba(6,13,24,0.97),
          rgba(8,18,31,0.95)
        );

      border:
        1px solid
        rgba(80,210,255,0.32);

      box-shadow:
        0 0 25px
        rgba(0,160,255,0.10);

      color:white;

      font-family:
        Arial,
        sans-serif;
    `;
  }

  function formatMoney(value) {
    return "$" +
      Math.floor(value)
        .toLocaleString();
  }

  // =========================================================
  // TOP HUD
  // =========================================================

  const topBar = document.createElement(
    "div"
  );

  topBar.style.cssText = `
    position:absolute;
    left:0;
    right:0;
    top:0;

    height:64px;

    ${uiPanelBase()}

    border-left:none;
    border-right:none;
    border-top:none;

    display:flex;
    align-items:center;
    justify-content:space-between;

    padding:
      0 18px;

    z-index:70;
  `;

  document.body.appendChild(
    topBar
  );

  const titleArea = document.createElement(
    "div"
  );

  titleArea.innerHTML = `
    <div
      style="
        font-size:18px;
        font-weight:800;
        letter-spacing:1.2px;
        color:#86eaff;
      "
    >
      MAP GAME
    </div>

    <div
      style="
        margin-top:2px;
        font-size:10px;
        opacity:0.50;
        letter-spacing:0.7px;
      "
    >
      ALPHA 0.0.5 — WORLD + INTERFACE
    </div>
  `;

  topBar.appendChild(
    titleArea
  );

  const resourceBar = document.createElement(
    "div"
  );

  resourceBar.style.cssText = `
    display:flex;
    align-items:center;
    gap:16px;
    font-size:13px;
    font-weight:700;
  `;

  topBar.appendChild(
    resourceBar
  );

  function updateHUD() {
    resourceBar.innerHTML = `
      <span>
        💰 ${formatMoney(money)}
      </span>

      <span>
        ⛏️ ${Math.floor(iron)}
      </span>

      <span>
        🏗️ ${Math.floor(steel)}
      </span>

      <span>
        ⚡ ${Math.floor(energy)}
      </span>

      <span>
        👥 ${population.toLocaleString()}
      </span>

      <span
        style="
          color:#75e3a1;
        "
      >
        +$${incomePerMinute}/min
      </span>
    `;
  }

  // =========================================================
  // LEFT NAVIGATION
  // =========================================================

  const sideBar = document.createElement(
    "div"
  );

  sideBar.style.cssText = `
    position:absolute;

    left:14px;
    top:82px;

    width:58px;

    ${uiPanelBase()}

    border-radius:12px;

    padding:8px;

    display:flex;
    flex-direction:column;
    gap:8px;

    z-index:60;
  `;

  document.body.appendChild(
    sideBar
  );

  function createSideButton(
    icon,
    label
  ) {
    const button = document.createElement(
      "button"
    );

    button.innerHTML = icon;
    button.title = label;

    button.style.cssText = `
      width:42px;
      height:42px;

      border:
        1px solid
        rgba(255,255,255,0.08);

      border-radius:8px;

      background:
        rgba(255,255,255,0.035);

      color:white;

      font-size:18px;

      cursor:pointer;

      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    `;

    button.onmouseenter = () => {
      button.style.background =
        "rgba(35,165,235,0.18)";

      button.style.borderColor =
        "rgba(80,210,255,0.35)";
    };

    button.onmouseleave = () => {
      button.style.background =
        "rgba(255,255,255,0.035)";

      button.style.borderColor =
        "rgba(255,255,255,0.08)";
    };

    sideBar.appendChild(
      button
    );

    return button;
  }

  const buildButton = createSideButton(
    "🏗️",
    "Construction"
  );

  const worldButton = createSideButton(
    "🌍",
    "World"
  );

  const economyButton = createSideButton(
    "📊",
    "Economy"
  );

  const researchButton = createSideButton(
    "🔬",
    "Research"
  );

  const settingsButton = createSideButton(
    "⚙️",
    "Settings"
  );

  // =========================================================
  // RIGHT CONTEXT PANEL
  // =========================================================

  const contextPanel = document.createElement(
    "div"
  );

  contextPanel.style.cssText = `
    position:absolute;

    right:16px;
    top:82px;

    width:300px;

    ${uiPanelBase()}

    border-radius:12px;

    padding:16px;

    z-index:58;

    display:none;
  `;

  document.body.appendChild(
    contextPanel
  );

  function hideContextPanel() {
    contextPanel.style.display =
      "none";
  }

  function showBuildingContext(
    mesh
  ) {
    if (
      !mesh ||
      !mesh.metadata
    ) {
      return;
    }

    const data =
      mesh.metadata;

    const name =
      data.displayName ||
      "Building";

    const type =
      data.interactiveType ||
      "building";

    let details = "";

    if (
      data.production
    ) {
      details += `
        <div
          style="
            margin-top:12px;
          "
        >
          <div
            style="
              font-size:10px;
              opacity:0.5;
              margin-bottom:4px;
            "
          >
            PRODUCTION
          </div>

          <div
            style="
              color:#8ef0ae;
              font-weight:bold;
            "
          >
            ${data.production}
          </div>
        </div>
      `;
    }

    if (
      data.consumption
    ) {
      details += `
        <div
          style="
            margin-top:10px;
          "
        >
          <div
            style="
              font-size:10px;
              opacity:0.5;
              margin-bottom:4px;
            "
          >
            CONSUMPTION
          </div>

          <div
            style="
              color:#ffd272;
            "
          >
            ${data.consumption}
          </div>
        </div>
      `;
    }

    contextPanel.style.display =
      "block";

    contextPanel.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:center;
        "
      >
        <div>
          <div
            style="
              font-size:20px;
              font-weight:800;
              color:#89eaff;
            "
          >
            ${name}
          </div>

          <div
            style="
              margin-top:2px;
              font-size:10px;
              opacity:0.50;
              text-transform:uppercase;
            "
          >
            ${type}
          </div>
        </div>

        <button
          id="closeContext"
          style="
            border:none;
            background:none;
            color:white;
            font-size:18px;
            cursor:pointer;
          "
        >
          ✕
        </button>
      </div>

      <div
        style="
          margin-top:14px;
          padding:10px;
          border-radius:8px;
          background:
            rgba(255,255,255,0.035);
        "
      >
        <div
          style="
            display:flex;
            justify-content:
              space-between;
          "
        >
          <span
            style="
              opacity:0.60;
            "
          >
            Level
          </span>

          <b>
            ${data.level || 1}
          </b>
        </div>

        <div
          style="
            display:flex;
            justify-content:
              space-between;
            margin-top:7px;
          "
        >
          <span
            style="
              opacity:0.60;
            "
          >
            Efficiency
          </span>

          <b>
            100%
          </b>
        </div>
      </div>

      ${details}

      <button
        id="upgradeSelected"
        style="
          width:100%;
          margin-top:16px;
          padding:10px;

          border:
            1px solid
            rgba(80,210,255,0.35);

          border-radius:8px;

          background:
            rgba(20,130,200,0.80);

          color:white;

          font-weight:bold;

          cursor:pointer;
        "
      >
        UPGRADE
      </button>

      <button
        id="demolishSelected"
        style="
          width:100%;
          margin-top:8px;
          padding:9px;

          border:
            1px solid
            rgba(255,100,100,0.22);

          border-radius:8px;

          background:
            rgba(120,30,35,0.45);

          color:#ffb0b0;

          font-weight:bold;

          cursor:pointer;
        "
      >
        DEMOLISH
      </button>
    `;

    const closeButton =
      document.getElementById(
        "closeContext"
      );

    if (
      closeButton instanceof
      HTMLButtonElement
    ) {
      closeButton.onclick =
        hideContextPanel;
    }

    const upgradeButton =
      document.getElementById(
        "upgradeSelected"
      );

    if (
      upgradeButton instanceof
      HTMLButtonElement
    ) {
      upgradeButton.onclick =
        () => {
          const cost =
            1000 *
            (data.level || 1);

          if (
            money <
            cost
          ) {
            showBottomMessage(
              "Not enough money for upgrade."
            );

            return;
          }

          money -= cost;

          data.level =
            (data.level || 1) +
            1;

          mesh.scaling.y *= 1.04;

          updateHUD();
          saveGame();

          showBuildingContext(
            mesh
          );

          showBottomMessage(
            name +
            " upgraded to Level " +
            data.level
          );
        };
    }

    const demolishButton =
      document.getElementById(
        "demolishSelected"
      );

    if (
      demolishButton instanceof
      HTMLButtonElement
    ) {
      demolishButton.onclick =
        () => {
          showBottomMessage(
            "Demolition will be enabled when full construction placement is added."
          );
        };
    }
  }

  function showTerrainContext(
    point
  ) {
    let closestRegion = null;
    let bestDistance = Infinity;

    for (
      const region of regions
    ) {
      const dx =
        point.x -
        region.x;

      const dz =
        point.z -
        region.z;

      const distance =
        Math.sqrt(
          dx * dx +
          dz * dz
        );

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        closestRegion =
          region;
      }
    }

    if (!closestRegion) {
      return;
    }

    const insideRegion =
      bestDistance <=
      closestRegion.radius;

    const regionName =
      insideRegion
        ? closestRegion.name
        : "Open Grassland";

    const regionType =
      insideRegion
        ? closestRegion.type
        : "Plains";

    const description =
      insideRegion
        ? closestRegion.description
        : "Open terrain available for future civilization expansion.";

    contextPanel.style.display =
      "block";

    contextPanel.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:center;
        "
      >
        <div>
          <div
            style="
              font-size:20px;
              font-weight:800;
              color:#89eaff;
            "
          >
            ${regionName}
          </div>

          <div
            style="
              margin-top:2px;
              font-size:10px;
              opacity:0.50;
            "
          >
            TERRAIN / ${regionType.toUpperCase()}
          </div>
        </div>

        <button
          id="closeContext"
          style="
            border:none;
            background:none;
            color:white;
            font-size:18px;
            cursor:pointer;
          "
        >
          ✕
        </button>
      </div>

      <div
        style="
          margin-top:14px;
          line-height:1.55;
          font-size:13px;
          opacity:0.82;
        "
      >
        ${description}
      </div>

      <div
        style="
          margin-top:14px;
          padding:10px;
          border-radius:8px;
          background:
            rgba(255,255,255,0.035);
          font-size:12px;
        "
      >
        <div>
          <span
            style="
              opacity:0.55;
            "
          >
            X:
          </span>
          ${point.x.toFixed(1)}
        </div>

        <div
          style="
            margin-top:4px;
          "
        >
          <span
            style="
              opacity:0.55;
            "
          >
            Z:
          </span>
          ${point.z.toFixed(1)}
        </div>

        <div
          style="
            margin-top:4px;
          "
        >
          <span
            style="
              opacity:0.55;
            "
          >
            Buildable:
          </span>
          Yes
        </div>
      </div>
    `;

    const closeButton =
      document.getElementById(
        "closeContext"
      );

    if (
      closeButton instanceof
      HTMLButtonElement
    ) {
      closeButton.onclick =
        hideContextPanel;
    }
  }

  // =========================================================
  // BOTTOM STATUS BAR
  // =========================================================

  const bottomBar = document.createElement(
    "div"
  );

  bottomBar.style.cssText = `
    position:absolute;

    left:50%;
    bottom:14px;

    transform:
      translateX(-50%);

    min-width:420px;
    max-width:70vw;

    ${uiPanelBase()}

    border-radius:10px;

    padding:
      9px 14px;

    text-align:center;

    font-size:12px;

    z-index:62;
  `;

  document.body.appendChild(
    bottomBar
  );

  function showBottomMessage(
    message
  ) {
    bottomBar.innerHTML =
      message;
  }

  showBottomMessage(
    "Click a building or region for information. Use WASD / arrows / touch to move."
  );

  // =========================================================
  // CONSTRUCTION TERMINAL
  // =========================================================

  const shop = document.createElement(
    "div"
  );

  shop.style.cssText = `
    position:absolute;

    left:84px;
    top:82px;

    width:470px;

    max-height:
      calc(100vh - 120px);

    overflow-y:auto;

    ${uiPanelBase()}

    border-radius:14px;

    padding:18px;

    z-index:64;

    display:none;
  `;

  document.body.appendChild(
    shop
  );

  let shopCategory =
    "industry";

  const shopItems = {
    industry: [
      {
        name: "Iron Mine",
        category: "RESOURCE EXTRACTION",
        cost: 750,
        accent: "#bcc8d0",
        description: "Extracts iron for industrial production.",
        stats: "+3 Iron / cycle • -1 Energy"
      },
      {
        name: "Steel Mill",
        category: "HEAVY INDUSTRY",
        cost: 1200,
        accent: "#8fb9d6",
        description: "Converts iron into steel.",
        stats: "+1 Steel / cycle • -3 Iron • -2 Energy"
      },
      {
        name: "Fabrication Plant",
        category: "MANUFACTURING",
        cost: 1800,
        accent: "#83c5e8",
        description: "Future manufacturing and advanced production.",
        stats: "Unlocks later"
      }
    ],

    civil: [
      {
        name: "Residential Block",
        category: "CIVIL",
        cost: 500,
        accent: "#9cecc0",
        description: "Expands population and tax capacity.",
        stats: "+500 population capacity"
      },
      {
        name: "Town Hall Upgrade",
        category: "ADMINISTRATION",
        cost: 2000 * townHallLevel,
        accent: "#83e8ff",
        description: "Improves administration and offline income.",
        stats:
          "Current level: " +
          townHallLevel
      }
    ],

    power: [
      {
        name: "Power Plant",
        category: "ENERGY",
        cost: 950,
        accent: "#ffd768",
        description: "Generates energy for industry.",
        stats: "+8 Energy / cycle"
      },
      {
        name: "Grid Substation",
        category: "POWER GRID",
        cost: 700,
        accent: "#ffe99c",
        description: "Future distribution and efficiency system.",
        stats: "Infrastructure"
      }
    ],

    infrastructure: [
      {
        name: "Road",
        category: "TRANSPORT",
        cost: 100,
        accent: "#c1c6cc",
        description: "Connects city districts and future logistics.",
        stats: "Placement coming next"
      },
      {
        name: "Bridge",
        category: "TRANSPORT",
        cost: 450,
        accent: "#d7dde2",
        description: "Crosses rivers and connects regions.",
        stats: "Placement coming next"
      }
    ]
  };

  function shopCardHTML(
    item,
    index
  ) {
    return `
      <div
        style="
          padding:13px;

          background:
            rgba(255,255,255,0.035);

          border:
            1px solid
            rgba(255,255,255,0.07);

          border-radius:10px;
        "
      >
        <div
          style="
            color:${item.accent};
            font-size:16px;
            font-weight:800;
          "
        >
          ${item.name}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:10px;
            opacity:0.48;
          "
        >
          ${item.category}
        </div>

        <div
          style="
            margin-top:9px;
            line-height:1.45;
            font-size:12px;
            opacity:0.82;
          "
        >
          ${item.description}
        </div>

        <div
          style="
            margin-top:9px;
            font-size:11px;
            color:#9cdff4;
          "
        >
          ${item.stats}
        </div>

        <div
          style="
            display:flex;
            justify-content:
              space-between;
            align-items:center;
            margin-top:12px;
          "
        >
          <b>
            ${formatMoney(item.cost)}
          </b>

          <button
            class="shopSelectButton"
            data-shop-index="${index}"
            style="
              padding:
                7px 13px;

              border:
                1px solid
                rgba(80,210,255,0.32);

              border-radius:7px;

              background:
                rgba(20,130,200,0.76);

              color:white;

              font-weight:bold;

              cursor:pointer;
            "
          >
            SELECT
          </button>
        </div>
      </div>
    `;
  }

  function updateShop() {
    const items =
      shopItems[
        shopCategory
      ] ||
      [];

    shop.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:center;
        "
      >
        <div>
          <div
            style="
              font-size:21px;
              font-weight:800;
              color:#83e8ff;
            "
          >
            CONSTRUCTION NETWORK
          </div>

          <div
            style="
              margin-top:2px;
              font-size:10px;
              opacity:0.48;
            "
          >
            CIVILIZATION DEVELOPMENT TERMINAL
          </div>
        </div>

        <button
          id="closeShop"
          style="
            border:none;
            background:none;
            color:white;
            font-size:20px;
            cursor:pointer;
          "
        >
          ✕
        </button>
      </div>

      <div
        id="shopTabs"
        style="
          display:flex;
          flex-wrap:wrap;
          gap:7px;
          margin-top:15px;
        "
      >
        <button
          data-category="industry"
          class="shopTab"
        >
          INDUSTRY
        </button>

        <button
          data-category="civil"
          class="shopTab"
        >
          CIVIL
        </button>

        <button
          data-category="power"
          class="shopTab"
        >
          POWER
        </button>

        <button
          data-category="infrastructure"
          class="shopTab"
        >
          INFRASTRUCTURE
        </button>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:
            1fr 1fr;
          gap:10px;
          margin-top:14px;
        "
      >
        ${items
          .map(
            (item, index) =>
              shopCardHTML(
                item,
                index
              )
          )
          .join("")}
      </div>
    `;

    const closeButton =
      document.getElementById(
        "closeShop"
      );

    if (
      closeButton instanceof
      HTMLButtonElement
    ) {
      closeButton.onclick =
        () => {
          shop.style.display =
            "none";
        };
    }

    const tabs =
      shop.querySelectorAll(
        ".shopTab"
      );

    tabs.forEach(
      tab => {
        if (
          !(
            tab instanceof
            HTMLButtonElement
          )
        ) {
          return;
        }

        const category =
          tab.dataset.category;

        const active =
          category ===
          shopCategory;

        tab.style.cssText = `
          padding:
            7px 10px;

          border:
            1px solid
            ${
              active
                ? "rgba(80,210,255,0.48)"
                : "rgba(255,255,255,0.08)"
            };

          border-radius:7px;

          background:
            ${
              active
                ? "rgba(30,155,225,0.16)"
                : "rgba(255,255,255,0.03)"
            };

          color:
            ${
              active
                ? "#8beaff"
                : "white"
            };

          font-size:10px;
          font-weight:bold;

          cursor:pointer;
        `;

        tab.onclick =
          () => {
            if (
              !category
            ) {
              return;
            }

            shopCategory =
              category;

            updateShop();
          };
      }
    );

    const selectButtons =
      shop.querySelectorAll(
        ".shopSelectButton"
      );

    selectButtons.forEach(
      button => {
        if (
          !(
            button instanceof
            HTMLButtonElement
          )
        ) {
          return;
        }

        button.onclick =
          () => {
            const index =
              Number(
                button.dataset
                  .shopIndex
              );

            const item =
              items[index];

            if (!item) {
              return;
            }

            showBottomMessage(
              item.name +
              " selected — full ghost placement comes in the next construction update."
            );

            shop.style.display =
              "none";
          };
      }
    );
  }

  buildButton.onclick = () => {
    const open =
      shop.style.display ===
      "block";

    shop.style.display =
      open
        ? "none"
        : "block";

    if (!open) {
      updateShop();
    }
  };

  // =========================================================
  // WORLD PANEL
  // =========================================================

  worldButton.onclick = () => {
    contextPanel.style.display =
      "block";

    contextPanel.innerHTML = `
      <div
        style="
          font-size:20px;
          font-weight:800;
          color:#89eaff;
        "
      >
        WORLD OVERVIEW
      </div>

      <div
        style="
          margin-top:4px;
          font-size:11px;
          opacity:0.52;
        "
      >
        ${regions.length} DEVELOPMENT REGIONS
      </div>

      <div
        style="
          margin-top:14px;
          display:flex;
          flex-direction:column;
          gap:8px;
        "
      >
        ${regions
          .map(
            region => `
              <div
                style="
                  padding:9px;
                  border-radius:7px;
                  background:
                    rgba(255,255,255,0.035);
                "
              >
                <b>
                  ${region.name}
                </b>

                <div
                  style="
                    font-size:10px;
                    opacity:0.50;
                    margin-top:2px;
                  "
                >
                  ${region.type.toUpperCase()}
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  };

  // =========================================================
  // ECONOMY PANEL
  // =========================================================

  economyButton.onclick = () => {
    contextPanel.style.display =
      "block";

    contextPanel.innerHTML = `
      <div
        style="
          font-size:20px;
          font-weight:800;
          color:#89eaff;
        "
      >
        ECONOMY
      </div>

      <div
        style="
          margin-top:14px;
          display:flex;
          flex-direction:column;
          gap:8px;
        "
      >
        <div
          style="
            padding:10px;
            background:
              rgba(255,255,255,0.035);
            border-radius:8px;
          "
        >
          Money:
          <b>
            ${formatMoney(money)}
          </b>
        </div>

        <div
          style="
            padding:10px;
            background:
              rgba(255,255,255,0.035);
            border-radius:8px;
          "
        >
          Passive income:
          <b>
            +$${incomePerMinute}/min
          </b>
        </div>

        <div
          style="
            padding:10px;
            background:
              rgba(255,255,255,0.035);
            border-radius:8px;
          "
        >
          Iron:
          <b>
            ${Math.floor(iron)}
          </b>
        </div>

        <div
          style="
            padding:10px;
            background:
              rgba(255,255,255,0.035);
            border-radius:8px;
          "
        >
          Steel:
          <b>
            ${Math.floor(steel)}
          </b>
        </div>

        <div
          style="
            padding:10px;
            background:
              rgba(255,255,255,0.035);
            border-radius:8px;
          "
        >
          Energy:
          <b>
            ${Math.floor(energy)}
          </b>
        </div>
      </div>
    `;
  };

  // =========================================================
  // RESEARCH / SETTINGS PLACEHOLDERS
  // =========================================================

  researchButton.onclick = () => {
    showBottomMessage(
      "Research tree is planned for a later Alpha update."
    );
  };

  settingsButton.onclick = () => {
    showBottomMessage(
      "Graphics presets and control settings will be added later."
    );
  };

  // =========================================================
  // CLICK SELECTION
  // =========================================================

  scene.onPointerObservable.add(
    pointerInfo => {
      if (
        pointerInfo.type !==
        BABYLON.PointerEventTypes
          .POINTERPICK
      ) {
        return;
      }

      const pickInfo =
        pointerInfo.pickInfo;

      if (
        !pickInfo ||
        !pickInfo.hit
      ) {
        return;
      }

      const mesh =
        pickInfo.pickedMesh;

      if (
        mesh &&
        mesh.metadata &&
        mesh.metadata
          .interactiveType
      ) {
        showBuildingContext(
          mesh
        );

        return;
      }

      if (
        mesh === ground &&
        pickInfo.pickedPoint
      ) {
        showTerrainContext(
          pickInfo.pickedPoint
        );
      }
    }
  );

  // =========================================================
  // TOUCH CONTROLS
  // =========================================================

  const touchControls = document.createElement(
    "div"
  );

  touchControls.style.cssText = `
    position:absolute;

    right:18px;
    bottom:70px;

    display:grid;

    grid-template-columns:
      54px 54px 54px;

    grid-template-rows:
      54px 54px 54px;

    gap:6px;

    z-index:68;
  `;

  document.body.appendChild(
    touchControls
  );

  function makeTouchButton(
    text,
    col,
    row
  ) {
    const button = document.createElement(
      "button"
    );

    button.innerText = text;

    button.style.cssText = `
      grid-column:${col};
      grid-row:${row};

      width:54px;
      height:54px;

      border-radius:13px;

      border:
        1px solid
        rgba(90,215,255,0.35);

      background:
        rgba(5,14,25,0.78);

      color:white;

      font-size:22px;
      font-weight:bold;

      touch-action:none;
      user-select:none;

      cursor:pointer;
    `;

    touchControls.appendChild(
      button
    );

    return button;
  }

  const touchUp =
    makeTouchButton(
      "▲",
      2,
      1
    );

  const touchLeft =
    makeTouchButton(
      "◀",
      1,
      2
    );

  const touchRight =
    makeTouchButton(
      "▶",
      3,
      2
    );

  const touchDown =
    makeTouchButton(
      "▼",
      2,
      3
    );

  const touchMove = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  function bindHoldButton(
    button,
    direction
  ) {
    button.addEventListener(
      "pointerdown",
      event => {
        event.preventDefault();

        touchMove[
          direction
        ] = true;

        button.style.background =
          "rgba(30,150,220,0.9)";

        try {
          button.setPointerCapture(
            event.pointerId
          );
        } catch {}
      }
    );

    function stop() {
      touchMove[
        direction
      ] = false;

      button.style.background =
        "rgba(5,14,25,0.78)";
    }

    button.addEventListener(
      "pointerup",
      stop
    );

    button.addEventListener(
      "pointercancel",
      stop
    );

    button.addEventListener(
      "lostpointercapture",
      stop
    );
  }

  bindHoldButton(
    touchUp,
    "up"
  );

  bindHoldButton(
    touchDown,
    "down"
  );

  bindHoldButton(
    touchLeft,
    "left"
  );

  bindHoldButton(
    touchRight,
    "right"
  );

  // =========================================================
  // CAMERA MOVEMENT
  // =========================================================

  const keys = {};

  window.addEventListener(
    "keydown",
    event => {
      keys[
        event.key.toLowerCase()
      ] = true;
    }
  );

  window.addEventListener(
    "keyup",
    event => {
      keys[
        event.key.toLowerCase()
      ] = false;
    }
  );

  scene
    .onBeforeRenderObservable
    .add(
      () => {
        const speed =
          0.70 *
          (
            camera.radius /
            130
          );

        if (
          keys["w"] ||
          keys["arrowup"] ||
          touchMove.up
        ) {
          camera.target.z +=
            speed;
        }

        if (
          keys["s"] ||
          keys["arrowdown"] ||
          touchMove.down
        ) {
          camera.target.z -=
            speed;
        }

        if (
          keys["a"] ||
          keys["arrowleft"] ||
          touchMove.left
        ) {
          camera.target.x -=
            speed;
        }

        if (
          keys["d"] ||
          keys["arrowright"] ||
          touchMove.right
        ) {
          camera.target.x +=
            speed;
        }

        camera.target.x =
          BABYLON.Scalar.Clamp(
            camera.target.x,
            -MAP_HALF + 35,
            MAP_HALF - 35
          );

        camera.target.z =
          BABYLON.Scalar.Clamp(
            camera.target.z,
            -MAP_HALF + 35,
            MAP_HALF - 35
          );
      }
    );

  // =========================================================
  // SAVE / LOAD / OFFLINE CASH
  // =========================================================

  function saveGame() {
    const data = {
      money,
      iron,
      steel,
      energy,
      population,
      townHallLevel,
      lastSaved: Date.now()
    };

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(
        data
      )
    );
  }

  function loadGame() {
    const raw =
      localStorage.getItem(
        SAVE_KEY
      );

    if (!raw) {
      return;
    }

    try {
      const data =
        JSON.parse(
          raw
        );

      money =
        data.money ??
        money;

      iron =
        data.iron ??
        iron;

      steel =
        data.steel ??
        steel;

      energy =
        data.energy ??
        energy;

      population =
        data.population ??
        population;

      townHallLevel =
        data.townHallLevel ??
        townHallLevel;

      const lastSaved =
        data.lastSaved ??
        Date.now();

      const secondsAway =
        Math.min(
          Math.floor(
            (
              Date.now() -
              lastSaved
            ) /
            1000
          ),
          12 * 60 * 60
        );

      const offlineRate =
        2 *
        townHallLevel;

      const offlineCash =
        secondsAway *
        offlineRate;

      money +=
        offlineCash;

      if (
        offlineCash >
        0
      ) {
        showBottomMessage(
          "Offline earnings collected: " +
          formatMoney(
            offlineCash
          )
        );
      }
    } catch {
      console.log(
        "Could not load save."
      );
    }
  }

  // =========================================================
  // PASSIVE ECONOMY
  // =========================================================

  const productionTimer =
    setInterval(
      () => {
        energy += 8;

        if (
          energy >= 1
        ) {
          energy -= 1;
          iron += 3;
        }

        if (
          iron >= 3 &&
          energy >= 2
        ) {
          iron -= 3;
          energy -= 2;

          steel += 1;
          money += 75;
        }

        updateHUD();
      },
      2000
    );

  // =========================================================
  // START
  // =========================================================

  loadGame();
  updateHUD();

  const saveTimer =
    setInterval(
      saveGame,
      5000
    );

  window.addEventListener(
    "beforeunload",
    saveGame
  );

  // =========================================================
  // CLEANUP
  // =========================================================

  scene
    .onDisposeObservable
    .add(
      () => {
        clearInterval(
          productionTimer
        );

        clearInterval(
          saveTimer
        );

        topBar.remove();
        sideBar.remove();
        contextPanel.remove();
        bottomBar.remove();
        shop.remove();
        touchControls.remove();
      }
    );

  return scene;
};

// ============================================================
// START ENGINE
// ============================================================

const scene = createScene();

engine.runRenderLoop(
  () => {
    scene.render();
  }
);

// Remove loading screen if your index.html has one.
const loadingScreen =
  document.getElementById(
    "loadingScreen"
  );

if (loadingScreen) {
  loadingScreen.remove();
}

// Resize support
window.addEventListener(
  "resize",
  () => {
    engine.resize();
  }
);
