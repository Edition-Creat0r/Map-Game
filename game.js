// ============================================================
// MAP GAME — Alpha 0.0.7
// CONSTRUCTION CORE + CENTRAL WORLD HOME
//
// Goal:
// - Make the "Basic" preset look genuinely good.
// - Push visuals close to "Regular" without making the Chromebook
//   completely hate us.
// - Expand the world into recognizable regions and districts.
// - Improve the entire HUD / panel language so it feels like one game.
//
// Replace your current game.js with this file.
// Build 0.0.7: Central World home + real construction placement.
// Your existing index.html + styles.css can stay the same.
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

// Slightly reduce internal resolution on weaker hardware.
// This keeps the scene sharper than "potato mode" while helping Chromebooks.
const deviceScale =
  window.devicePixelRatio >= 2
    ? 1.35
    : 1.15;

engine.setHardwareScalingLevel(deviceScale);

// ============================================================
// SCENE
// ============================================================

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(
    0.66,
    0.79,
    0.91,
    1
  );

  // =========================================================
  // GAME STATE
  // =========================================================

  let money = 35000;
  let iron = 60;
  let steel = 28;
  let energy = 220;
  let population = 3800;
  let incomePerMinute = 175;

  let townHallLevel = 1;

  const SAVE_KEY =
    "mapGame_alpha007_construction";

  // Gameplay data stays separate from Babylon meshes.
  // That makes future Basic / Regular / Deep / Hyper switching much safer.
  let placedBuildings = [];
  let nextBuildingId = 1;

  let buildMode = null;
  let buildGhost = null;
  let buildGhostValid = false;
  let buildRotation = 0;

  // Planned account-level cap for player-created PRIVATE worlds.
  // This is only a UI/design constant for now; the real server will enforce it later.
  const PRIVATE_WORLD_LIMIT = 3;

  // =========================================================
  // GRAPHICS TARGET
  // =========================================================

  // For now this build is our polished BASIC target.
  // Later we can make REGULAR swap in better materials/models.
  const GRAPHICS_PRESET = "BASIC";

  // =========================================================
  // WORLD
  // =========================================================

  const MAP_SIZE = 1100;
  const MAP_HALF = MAP_SIZE / 2;

  const WORLD_LIMIT =
    MAP_HALF - 45;

  const regions = [
    {
      id: "capital",
      name: "Nova Capital",
      type: "Capital",
      x: 0,
      z: -65,
      radius: 135,
      color: "#83e8ff",
      description:
        "Administrative, commercial, and high-density center of your civilization."
    },
    {
      id: "northForest",
      name: "Northwood",
      type: "Forest",
      x: 30,
      z: -330,
      radius: 160,
      color: "#91e6a5",
      description:
        "Dense forest, rolling hills, and future lumber or conservation development."
    },
    {
      id: "northWestMine",
      name: "Granite Reach",
      type: "Mining",
      x: -330,
      z: -285,
      radius: 145,
      color: "#c5cbd1",
      description:
        "Rugged mineral country containing the civilization's primary mining complex."
    },
    {
      id: "eastIndustry",
      name: "Forge District",
      type: "Industrial",
      x: 330,
      z: -115,
      radius: 150,
      color: "#91bad7",
      description:
        "Heavy industry, refining, fabrication, and future manufacturing."
    },
    {
      id: "westPower",
      name: "Helios Grid",
      type: "Power",
      x: -325,
      z: 65,
      radius: 140,
      color: "#ffd86a",
      description:
        "Power generation, substations, transmission, and utility infrastructure."
    },
    {
      id: "southResidential",
      name: "Southbank",
      type: "Residential",
      x: 0,
      z: 285,
      radius: 170,
      color: "#a4ecc2",
      description:
        "Major residential expansion zone with parks, roads, and river access."
    },
    {
      id: "southEastReserve",
      name: "Apex Reserve",
      type: "Development",
      x: 330,
      z: 285,
      radius: 160,
      color: "#d1c7ff",
      description:
        "Large open reserve for future airports, military bases, logistics, or special projects."
    },
    {
      id: "southWestPlains",
      name: "Westfield Plains",
      type: "Plains",
      x: -330,
      z: 290,
      radius: 165,
      color: "#d7e6a2",
      description:
        "Open land ideal for agriculture, large factories, or future suburban expansion."
    }
  ];

  // =========================================================
  // SKY / FOG
  // =========================================================

  scene.fogMode =
    BABYLON.Scene.FOGMODE_EXP2;

  scene.fogDensity = 0.00115;

  scene.fogColor =
    new BABYLON.Color3(
      0.66,
      0.79,
      0.91
    );

  // =========================================================
  // CAMERA
  // =========================================================

  const camera =
    new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.01,
      190,
      new BABYLON.Vector3(
        0,
        0,
        -30
      ),
      scene
    );

  camera.attachControl(
    canvas,
    true
  );

  camera.lowerRadiusLimit = 30;
  camera.upperRadiusLimit = 440;

  camera.lowerBetaLimit = 0.27;
  camera.upperBetaLimit = 1.37;

  camera.wheelPrecision = 30;
  camera.inertia = 0.82;
  camera.panningInertia = 0.86;
  camera.panningSensibility = 80;

  // =========================================================
  // LIGHTING
  // =========================================================

  const hemi =
    new BABYLON.HemisphericLight(
      "hemi",
      new BABYLON.Vector3(
        0,
        1,
        0
      ),
      scene
    );

  hemi.intensity = 0.62;

  const sun =
    new BABYLON.DirectionalLight(
      "sun",
      new BABYLON.Vector3(
        -0.48,
        -1,
        -0.34
      ),
      scene
    );

  sun.position =
    new BABYLON.Vector3(
      260,
      360,
      210
    );

  sun.intensity = 1.0;

  const shadowGenerator =
    new BABYLON.ShadowGenerator(
      1024,
      sun
    );

  shadowGenerator.useBlurExponentialShadowMap =
    true;

  shadowGenerator.blurKernel = 12;

  // =========================================================
  // MATERIAL HELPERS
  // =========================================================

  function makeMaterial(
    name,
    r,
    g,
    b
  ) {
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

    return mat;
  }

  const grassMat =
    makeMaterial(
      "grassMat",
      0.22,
      0.47,
      0.18
    );

  const grassLightMat =
    makeMaterial(
      "grassLightMat",
      0.30,
      0.54,
      0.22
    );

  const dirtMat =
    makeMaterial(
      "dirtMat",
      0.36,
      0.28,
      0.18
    );

  const roadMat =
    makeMaterial(
      "roadMat",
      0.075,
      0.085,
      0.10
    );

  const roadEdgeMat =
    makeMaterial(
      "roadEdgeMat",
      0.34,
      0.36,
      0.39
    );

  const roadLineYellowMat =
    makeMaterial(
      "roadLineYellowMat",
      0.94,
      0.80,
      0.24
    );

  const roadLineWhiteMat =
    makeMaterial(
      "roadLineWhiteMat",
      0.88,
      0.90,
      0.92
    );

  const concreteMat =
    makeMaterial(
      "concreteMat",
      0.57,
      0.62,
      0.66
    );

  const concreteDarkMat =
    makeMaterial(
      "concreteDarkMat",
      0.30,
      0.34,
      0.38
    );

  const darkMat =
    makeMaterial(
      "darkMat",
      0.028,
      0.038,
      0.052
    );

  const industrialMat =
    makeMaterial(
      "industrialMat",
      0.33,
      0.40,
      0.47
    );

  const mineMat =
    makeMaterial(
      "mineMat",
      0.19,
      0.21,
      0.24
    );

  const powerMat =
    makeMaterial(
      "powerMat",
      0.51,
      0.39,
      0.10
    );

  const treeTrunkMat =
    makeMaterial(
      "treeTrunkMat",
      0.27,
      0.14,
      0.055
    );

  const treeLeafMat =
    makeMaterial(
      "treeLeafMat",
      0.075,
      0.30,
      0.085
    );

  const treeLeafAltMat =
    makeMaterial(
      "treeLeafAltMat",
      0.12,
      0.38,
      0.12
    );

  const rockMat =
    makeMaterial(
      "rockMat",
      0.28,
      0.30,
      0.33
    );

  const pylonMat =
    makeMaterial(
      "pylonMat",
      0.25,
      0.28,
      0.31
    );

  const parkMat =
    makeMaterial(
      "parkMat",
      0.19,
      0.50,
      0.17
    );

  const glassMat =
    new BABYLON.StandardMaterial(
      "glassMat",
      scene
    );

  glassMat.diffuseColor =
    new BABYLON.Color3(
      0.08,
      0.40,
      0.67
    );

  glassMat.alpha = 0.62;

  glassMat.specularColor =
    new BABYLON.Color3(
      0.9,
      0.95,
      1.0
    );

  const darkGlassMat =
    new BABYLON.StandardMaterial(
      "darkGlassMat",
      scene
    );

  darkGlassMat.diffuseColor =
    new BABYLON.Color3(
      0.04,
      0.18,
      0.28
    );

  darkGlassMat.alpha = 0.78;

  // =========================================================
  // TERRAIN
  // =========================================================

  const ground =
    BABYLON.MeshBuilder.CreateGround(
      "ground",
      {
        width: MAP_SIZE,
        height: MAP_SIZE,
        subdivisions: 105
      },
      scene
    );

  ground.material = grassMat;
  ground.receiveShadows = true;
  ground.isPickable = true;

  const positions =
    ground.getVerticesData(
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
        Math.sin(x * 0.0105) * 4.0 +
        Math.cos(z * 0.009) * 3.6 +
        Math.sin((x + z) * 0.0068) * 2.5 +
        Math.cos((x - z) * 0.0045) * 1.8;

      // Flatten capital
      const capitalDistance =
        Math.sqrt(
          x * x +
          (z + 65) *
            (z + 65)
        );

      if (
        capitalDistance <
        160
      ) {
        height *= 0.10;
      }

      // Smooth Southbank
      const southDistance =
        Math.sqrt(
          x * x +
          (z - 285) *
            (z - 285)
        );

      if (
        southDistance <
        185
      ) {
        height *= 0.28;
      }

      // Rugged mining terrain
      const miningDistance =
        Math.sqrt(
          (x + 330) *
            (x + 330) +
          (z + 285) *
            (z + 285)
        );

      if (
        miningDistance <
        175
      ) {
        height +=
          Math.sin(
            x * 0.038
          ) * 4.5 +
          Math.cos(
            z * 0.043
          ) * 4.0;
      }

      // Northwood rolling hills
      const forestDistance =
        Math.sqrt(
          (x - 30) *
            (x - 30) +
          (z + 330) *
            (z + 330)
        );

      if (
        forestDistance <
        180
      ) {
        height +=
          Math.sin(
            z * 0.024
          ) * 2.5;
      }

      positions[
        i + 1
      ] = height;
    }

    ground.updateVerticesData(
      BABYLON.VertexBuffer.PositionKind,
      positions
    );

    ground.refreshBoundingInfo();
  }

  // =========================================================
  // LOW-POLY DISTANT RIDGES
  // =========================================================

  function createMountain(
    x,
    z,
    radius,
    height
  ) {
    const mountain =
      BABYLON.MeshBuilder.CreateCylinder(
        "mountain",
        {
          diameterTop: 0,
          diameterBottom:
            radius * 2,
          height,
          tessellation: 7
        },
        scene
      );

    mountain.position =
      new BABYLON.Vector3(
        x,
        height / 2 - 3,
        z
      );

    mountain.material =
      rockMat;

    mountain.isPickable =
      false;

    return mountain;
  }

  for (
    let i = 0;
    i < 12;
    i++
  ) {
    createMountain(
      -500 +
        Math.random() *
          220,
      -470 +
        Math.random() *
          220,
      35 +
        Math.random() *
          45,
      45 +
        Math.random() *
          60
    );
  }

  // =========================================================
  // WATER
  // =========================================================

  const waterMat =
    new BABYLON.StandardMaterial(
      "waterMat",
      scene
    );

  waterMat.diffuseColor =
    new BABYLON.Color3(
      0.055,
      0.30,
      0.52
    );

  waterMat.alpha = 0.85;

  waterMat.specularColor =
    new BABYLON.Color3(
      0.75,
      0.90,
      1.0
    );

  function createWater(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const water =
      BABYLON.MeshBuilder.CreateGround(
        "water",
        {
          width,
          height: depth,
          subdivisions: 1
        },
        scene
      );

    water.position =
      new BABYLON.Vector3(
        x,
        -0.36,
        z
      );

    water.rotation.y =
      rotation;

    water.material =
      waterMat;

    water.isPickable =
      false;

    return water;
  }

  // Main river
  createWater(
    -270,
    125,
    300,
    42,
    Math.PI / 20
  );

  createWater(
    0,
    150,
    330,
    46,
    -Math.PI / 28
  );

  createWater(
    300,
    175,
    310,
    42,
    Math.PI / 18
  );

  // Small lake
  createWater(
    -365,
    330,
    150,
    100,
    Math.PI / 10
  );

  // =========================================================
  // ROAD HELPERS
  // =========================================================

  function createRoadBase(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const shoulder =
      BABYLON.MeshBuilder.CreateBox(
        "roadShoulder",
        {
          width:
            width + 5,
          height: 0.08,
          depth:
            depth + 5
        },
        scene
      );

    shoulder.position =
      new BABYLON.Vector3(
        x,
        0.055,
        z
      );

    shoulder.rotation.y =
      rotation;

    shoulder.material =
      roadEdgeMat;

    shoulder.isPickable =
      false;

    const road =
      BABYLON.MeshBuilder.CreateBox(
        "road",
        {
          width,
          height: 0.12,
          depth
        },
        scene
      );

    road.position =
      new BABYLON.Vector3(
        x,
        0.11,
        z
      );

    road.rotation.y =
      rotation;

    road.material =
      roadMat;

    road.receiveShadows =
      true;

    road.isPickable =
      false;

    return road;
  }

  function createDash(
    x,
    z,
    width,
    depth,
    material,
    rotation = 0
  ) {
    const dash =
      BABYLON.MeshBuilder.CreateBox(
        "roadDash",
        {
          width,
          height: 0.025,
          depth
        },
        scene
      );

    dash.position =
      new BABYLON.Vector3(
        x,
        0.185,
        z
      );

    dash.rotation.y =
      rotation;

    dash.material =
      material;

    dash.isPickable =
      false;
  }

  // Capital cross
  createRoadBase(
    0,
    -70,
    15,
    470
  );

  createRoadBase(
    0,
    -65,
    500,
    15
  );

  // East industry corridor
  createRoadBase(
    285,
    -115,
    13,
    270
  );

  // West utility corridor
  createRoadBase(
    -280,
    25,
    13,
    280
  );

  // Southbank avenue
  createRoadBase(
    0,
    285,
    500,
    14
  );

  // Mining road
  createRoadBase(
    -250,
    -230,
    13,
    240,
    -Math.PI / 7
  );

  // Southeast development road
  createRoadBase(
    310,
    270,
    13,
    260,
    -Math.PI / 12
  );

  // Road markings
  for (
    let z = -290;
    z <= 140;
    z += 20
  ) {
    createDash(
      0,
      z,
      0.7,
      8,
      roadLineYellowMat
    );
  }

  for (
    let x = -235;
    x <= 235;
    x += 20
  ) {
    createDash(
      x,
      -65,
      8,
      0.7,
      roadLineWhiteMat
    );
  }

  for (
    let x = -235;
    x <= 235;
    x += 22
  ) {
    createDash(
      x,
      285,
      8,
      0.7,
      roadLineWhiteMat
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
    const deck =
      BABYLON.MeshBuilder.CreateBox(
        "bridgeDeck",
        {
          width,
          height: 0.65,
          depth
        },
        scene
      );

    deck.position =
      new BABYLON.Vector3(
        x,
        1.15,
        z
      );

    deck.rotation.y =
      rotation;

    deck.material =
      roadMat;

    shadowGenerator.addShadowCaster(
      deck
    );

    const railWidth =
      0.45;

    const rail1 =
      BABYLON.MeshBuilder.CreateBox(
        "bridgeRail",
        {
          width:
            railWidth,
          height: 1.15,
          depth
        },
        scene
      );

    rail1.position =
      new BABYLON.Vector3(
        x - width / 2 +
          0.45,
        1.85,
        z
      );

    rail1.rotation.y =
      rotation;

    rail1.material =
      concreteMat;

    const rail2 =
      rail1.clone(
        "bridgeRail2"
      );

    rail2.position.x =
      x +
      width / 2 -
      0.45;

    return deck;
  }

  createBridge(
    0,
    145,
    15,
    78
  );

  createBridge(
    305,
    168,
    13,
    62,
    -Math.PI / 12
  );

  // =========================================================
  // INTERACTIVE DATA
  // =========================================================

  function markInteractive(
    mesh,
    type,
    displayName,
    data = {}
  ) {
    mesh.metadata = {
      interactiveType:
        type,
      displayName,
      blocksConstruction: true,
      ...data
    };

    mesh.isPickable =
      true;
  }

  // =========================================================
  // BASIC-PRESET MODERN BUILDING
  // =========================================================

  function createModernBuilding(
    x,
    z,
    w,
    h,
    d,
    options = {}
  ) {
    const {
      name =
        "Modern Building",
      type =
        "building",
      glassAmount =
        0.66,
      material =
        concreteMat,
      darkGlass =
        false
    } = options;

    const body =
      BABYLON.MeshBuilder.CreateBox(
        "modernBuilding",
        {
          width: w,
          height: h,
          depth: d
        },
        scene
      );

    body.position =
      new BABYLON.Vector3(
        x,
        h / 2,
        z
      );

    body.material =
      material;

    shadowGenerator.addShadowCaster(
      body
    );

    const frontGlass =
      BABYLON.MeshBuilder.CreateBox(
        "frontGlass",
        {
          width:
            w *
            glassAmount,
          height:
            h * 0.57,
          depth: 0.25
        },
        scene
      );

    frontGlass.position =
      new BABYLON.Vector3(
        x,
        h * 0.52,
        z - d / 2 - 0.14
      );

    frontGlass.material =
      darkGlass
        ? darkGlassMat
        : glassMat;

    frontGlass.isPickable =
      false;

    const roofCap =
      BABYLON.MeshBuilder.CreateBox(
        "roofCap",
        {
          width:
            w + 0.9,
          height: 0.65,
          depth:
            d + 0.9
        },
        scene
      );

    roofCap.position =
      new BABYLON.Vector3(
        x,
        h + 0.33,
        z
      );

    roofCap.material =
      darkMat;

    roofCap.isPickable =
      false;

    // Black structural stripes
    const stripeLeft =
      BABYLON.MeshBuilder.CreateBox(
        "stripeLeft",
        {
          width: 0.75,
          height: h,
          depth:
            d + 0.25
        },
        scene
      );

    stripeLeft.position =
      new BABYLON.Vector3(
        x - w / 2 +
          0.38,
        h / 2,
        z
      );

    stripeLeft.material =
      darkMat;

    stripeLeft.isPickable =
      false;

    const stripeRight =
      stripeLeft.clone(
        "stripeRight"
      );

    stripeRight.position.x =
      x +
      w / 2 -
      0.38;

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
  // CAPITAL CORE
  // =========================================================

  createModernBuilding(
    0,
    -95,
    28,
    15,
    22,
    {
      name:
        "Central Administration",
      type:
        "townHall",
      glassAmount:
        0.80
    }
  );

  createModernBuilding(
    42,
    -102,
    14,
    30,
    14,
    {
      name:
        "Commerce Tower",
      type:
        "commercial",
      glassAmount:
        0.84,
      darkGlass:
        true
    }
  );

  createModernBuilding(
    -43,
    -100,
    15,
    22,
    15,
    {
      name:
        "Civic Offices",
      type:
        "commercial",
      glassAmount:
        0.76
    }
  );

  createModernBuilding(
    42,
    -42,
    16,
    19,
    16,
    {
      name:
        "Central Residences",
      type:
        "residential",
      glassAmount:
        0.72
    }
  );

  createModernBuilding(
    -44,
    -42,
    16,
    17,
    16,
    {
      name:
        "Central Residences",
      type:
        "residential",
      glassAmount:
        0.70
    }
  );

  createModernBuilding(
    78,
    -96,
    13,
    22,
    13,
    {
      name:
        "Technology Center",
      type:
        "commercial",
      glassAmount:
        0.78,
      darkGlass:
        true
    }
  );

  createModernBuilding(
    -80,
    -96,
    13,
    20,
    13,
    {
      name:
        "Municipal Center",
      type:
        "commercial",
      glassAmount:
        0.72
    }
  );

  // =========================================================
  // CAPITAL PARK
  // =========================================================

  const park =
    BABYLON.MeshBuilder.CreateBox(
      "capitalPark",
      {
        width: 75,
        height: 0.16,
        depth: 60
      },
      scene
    );

  park.position =
    new BABYLON.Vector3(
      0,
      0.10,
      15
    );

  park.material =
    parkMat;

  park.isPickable =
    false;

  // =========================================================
  // RESIDENTIAL BLOCK HELPER
  // =========================================================

  function createResidentialDistrict(
    startX,
    startZ,
    columns,
    rows,
    spacingX,
    spacingZ,
    minHeight,
    maxHeight
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
          col *
            spacingX;

        const z =
          startZ +
          row *
            spacingZ;

        const h =
          minHeight +
          Math.floor(
            Math.random() *
              (
                maxHeight -
                minHeight +
                1
              )
          );

        createModernBuilding(
          x,
          z,
          11,
          h,
          11,
          {
            name:
              "Residential Block",
            type:
              "residential",
            glassAmount:
              0.60
          }
        );
      }
    }
  }

  createResidentialDistrict(
    -105,
    55,
    6,
    3,
    35,
    31,
    7,
    14
  );

  createResidentialDistrict(
    -150,
    315,
    8,
    4,
    42,
    35,
    7,
    16
  );

  // =========================================================
  // MINING COMPLEX
  // =========================================================

  const mineBase =
    BABYLON.MeshBuilder.CreateBox(
      "mineBase",
      {
        width: 36,
        height: 8,
        depth: 30
      },
      scene
    );

  mineBase.position =
    new BABYLON.Vector3(
      -330,
      4,
      -285
    );

  mineBase.material =
    mineMat;

  markInteractive(
    mineBase,
    "ironMine",
    "Granite Reach Mine",
    {
      level: 1,
      production:
        "+3 Iron / cycle",
      consumption:
        "-1 Energy"
    }
  );

  shadowGenerator.addShadowCaster(
    mineBase
  );

  const mineTower =
    BABYLON.MeshBuilder.CreateCylinder(
      "mineTower",
      {
        diameter: 12,
        height: 24,
        tessellation: 8
      },
      scene
    );

  mineTower.position =
    new BABYLON.Vector3(
      -330,
      15,
      -285
    );

  mineTower.material =
    darkMat;

  mineTower.isPickable =
    false;

  // =========================================================
  // INDUSTRIAL DISTRICT
  // =========================================================

  const steelMill =
    BABYLON.MeshBuilder.CreateBox(
      "steelMill",
      {
        width: 42,
        height: 12,
        depth: 32
      },
      scene
    );

  steelMill.position =
    new BABYLON.Vector3(
      330,
      6,
      -145
    );

  steelMill.material =
    industrialMat;

  markInteractive(
    steelMill,
    "steelMill",
    "Forge District Steelworks",
    {
      level: 1,
      production:
        "+1 Steel / cycle",
      consumption:
        "-3 Iron, -2 Energy"
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
    const chimney =
      BABYLON.MeshBuilder.CreateCylinder(
        "steelChimney" + i,
        {
          diameter: 4.5,
          height: 31,
          tessellation: 14
        },
        scene
      );

    chimney.position =
      new BABYLON.Vector3(
        311 +
          i * 13,
        17,
        -158
      );

    chimney.material =
      darkMat;

    chimney.isPickable =
      false;

    shadowGenerator.addShadowCaster(
      chimney
    );
  }

  createModernBuilding(
    332,
    -88,
    34,
    10,
    25,
    {
      name:
        "Fabrication Plant",
      type:
        "factory",
      material:
        industrialMat,
      glassAmount:
        0.35
    }
  );

  createModernBuilding(
    372,
    -88,
    28,
    9,
    22,
    {
      name:
        "Industrial Warehouse",
      type:
        "factory",
      material:
        industrialMat,
      glassAmount:
        0.24
    }
  );

  // =========================================================
  // POWER DISTRICT
  // =========================================================

  const powerPlant =
    BABYLON.MeshBuilder.CreateBox(
      "powerPlant",
      {
        width: 38,
        height: 12,
        depth: 32
      },
      scene
    );

  powerPlant.position =
    new BABYLON.Vector3(
      -325,
      6,
      65
    );

  powerPlant.material =
    powerMat;

  markInteractive(
    powerPlant,
    "powerPlant",
    "Helios Power Station",
    {
      level: 1,
      production:
        "+8 Energy / cycle"
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
    const coolingTower =
      BABYLON.MeshBuilder.CreateCylinder(
        "coolingTower" + i,
        {
          diameterTop: 13,
          diameterBottom: 20,
          height: 31,
          tessellation: 18
        },
        scene
      );

    coolingTower.position =
      new BABYLON.Vector3(
        -348 +
          i * 38,
        18,
        65
      );

    coolingTower.material =
      concreteMat;

    coolingTower.isPickable =
      false;

    shadowGenerator.addShadowCaster(
      coolingTower
    );
  }

  // =========================================================
  // POWER PYLONS
  // =========================================================

  function createPylon(
    x,
    z,
    scale = 1
  ) {
    const mast =
      BABYLON.MeshBuilder.CreateBox(
        "pylonMast",
        {
          width:
            2.3 * scale,
          height:
            20 * scale,
          depth:
            2.3 * scale
        },
        scene
      );

    mast.position =
      new BABYLON.Vector3(
        x,
        10 * scale,
        z
      );

    mast.material =
      pylonMat;

    mast.isPickable =
      false;

    const arm =
      BABYLON.MeshBuilder.CreateBox(
        "pylonArm",
        {
          width:
            12 * scale,
          height:
            1.2 * scale,
          depth:
            1.2 * scale
        },
        scene
      );

    arm.position =
      new BABYLON.Vector3(
        x,
        15 * scale,
        z
      );

    arm.material =
      pylonMat;

    arm.isPickable =
      false;

    const arm2 =
      arm.clone(
        "pylonArm2"
      );

    arm2.position.y =
      11 * scale;
  }

  for (
    let i = 0;
    i < 9;
    i++
  ) {
    createPylon(
      -275 +
        i * 37,
      112 +
        i * 4,
      0.9
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
    const trunk =
      BABYLON.MeshBuilder.CreateCylinder(
        "treeTrunk",
        {
          diameter:
            0.9 * scale,
          height:
            4.2 * scale,
          tessellation: 7
        },
        scene
      );

    trunk.position =
      new BABYLON.Vector3(
        x,
        2.1 * scale,
        z
      );

    trunk.material =
      treeTrunkMat;

    trunk.isPickable =
      false;

    const crown =
      BABYLON.MeshBuilder.CreateSphere(
        "treeCrown",
        {
          diameter:
            5.8 * scale,
          segments: 6
        },
        scene
      );

    crown.position =
      new BABYLON.Vector3(
        x,
        5.1 * scale,
        z
      );

    crown.material =
      alt
        ? treeLeafAltMat
        : treeLeafMat;

    crown.isPickable =
      false;
  }

  // Northwood forest
  for (
    let i = 0;
    i < 165;
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
      175;

    createTree(
      30 +
        Math.cos(angle) *
          radius,
      -330 +
        Math.sin(angle) *
          radius,
      0.75 +
        Math.random() *
          0.9,
      Math.random() >
        0.55
    );
  }

  // Scattered world trees
  for (
    let i = 0;
    i < 135;
    i++
  ) {
    const x =
      Math.random() *
      960 -
      480;

    const z =
      Math.random() *
      960 -
      480;

    const capitalDist =
      Math.sqrt(
        x * x +
        (z + 65) *
          (z + 65)
      );

    const southDist =
      Math.sqrt(
        x * x +
        (z - 285) *
          (z - 285)
      );

    if (
      capitalDist >
        180 &&
      southDist >
        115
    ) {
      createTree(
        x,
        z,
        0.75 +
          Math.random() *
            0.65,
        Math.random() >
          0.68
      );
    }
  }

  // =========================================================
  // ROCKS
  // =========================================================

  function createRock(
    x,
    z,
    size
  ) {
    const rock =
      BABYLON.MeshBuilder.CreateSphere(
        "rock",
        {
          diameter: size,
          segments: 6
        },
        scene
      );

    rock.position =
      new BABYLON.Vector3(
        x,
        size * 0.24,
        z
      );

    rock.scaling.y =
      0.55 +
      Math.random() *
        0.35;

    rock.scaling.x =
      0.75 +
      Math.random() *
        0.45;

    rock.material =
      rockMat;

    rock.isPickable =
      false;
  }

  for (
    let i = 0;
    i < 70;
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
      155;

    createRock(
      -330 +
        Math.cos(angle) *
          radius,
      -285 +
        Math.sin(angle) *
          radius,
      3 +
        Math.random() *
          8
    );
  }

  // =========================================================
  // UI HELPERS
  // =========================================================

  function panelTheme() {
    return `
      background:
        linear-gradient(
          180deg,
          rgba(5,12,23,0.965),
          rgba(7,18,31,0.945)
        );

      border:
        1px solid
        rgba(93,216,255,0.30);

      box-shadow:
        0 12px 32px
        rgba(0,0,0,0.22),
        0 0 24px
        rgba(0,160,255,0.08);

      color:white;

      font-family:
        Inter,
        Arial,
        sans-serif;

      backdrop-filter:
        blur(8px);
    `;
  }

  function formatMoney(
    value
  ) {
    return "$" +
      Math.floor(
        value
      ).toLocaleString();
  }

  function resourceChip(
    label,
    value,
    color
  ) {
    return `
      <div
        style="
          display:flex;
          align-items:center;
          gap:7px;

          padding:
            7px 10px;

          border-radius:8px;

          background:
            rgba(255,255,255,0.035);

          border:
            1px solid
            rgba(255,255,255,0.055);

          white-space:nowrap;
        "
      >
        <span
          style="
            color:${color};
            opacity:0.95;
          "
        >
          ${label}
        </span>

        <b>
          ${value}
        </b>
      </div>
    `;
  }

  // =========================================================
  // TOP BAR
  // =========================================================

  const topBar =
    document.createElement(
      "div"
    );

  topBar.style.cssText = `
    position:absolute;
    top:0;
    left:0;
    right:0;

    min-height:66px;

    ${panelTheme()}

    border-top:none;
    border-left:none;
    border-right:none;

    display:flex;
    align-items:center;
    justify-content:space-between;

    padding:
      0 18px;

    z-index:90;
  `;

  document.body.appendChild(
    topBar
  );

  const civIdentity =
    document.createElement(
      "div"
    );

  civIdentity.innerHTML = `
    <div
      style="
        display:flex;
        align-items:center;
        gap:9px;
      "
    >
      <div
        style="
          width:28px;
          height:28px;

          display:flex;
          align-items:center;
          justify-content:center;

          border-radius:8px;

          background:
            linear-gradient(
              135deg,
              #1e86c8,
              #64e5ff
            );

          color:#06101b;

          font-weight:900;
        "
      >
        M
      </div>

      <div>
        <div
          style="
            font-size:16px;
            font-weight:850;
            letter-spacing:0.8px;
          "
        >
          NOVA CIVILIZATION
        </div>

        <div
          style="
            margin-top:2px;
            font-size:9px;
            letter-spacing:0.7px;
            opacity:0.48;
          "
        >
          ALPHA 0.0.7 • CONSTRUCTION CORE
        </div>
      </div>
    </div>
  `;

  topBar.appendChild(
    civIdentity
  );

  const resourceBar =
    document.createElement(
      "div"
    );

  resourceBar.style.cssText = `
    display:flex;
    align-items:center;
    gap:7px;

    font-size:12px;
  `;

  topBar.appendChild(
    resourceBar
  );

  function updateHUD() {
    resourceBar.innerHTML =
      resourceChip(
        "CREDITS",
        formatMoney(
          money
        ),
        "#7fe9ff"
      ) +
      resourceChip(
        "IRON",
        Math.floor(
          iron
        ),
        "#cbd3da"
      ) +
      resourceChip(
        "STEEL",
        Math.floor(
          steel
        ),
        "#93bfe0"
      ) +
      resourceChip(
        "POWER",
        Math.floor(
          energy
        ),
        "#ffd66c"
      ) +
      resourceChip(
        "POP",
        population.toLocaleString(),
        "#a4ecc2"
      ) +
      resourceChip(
        "INCOME",
        "+$" +
          incomePerMinute +
          "/m",
        "#7ee5a2"
      );
  }

  // =========================================================
  // LEFT DOCK
  // =========================================================

  const sideDock =
    document.createElement(
      "div"
    );

  sideDock.style.cssText = `
    position:absolute;

    left:14px;
    top:84px;

    width:60px;

    ${panelTheme()}

    border-radius:14px;

    padding:8px;

    display:flex;
    flex-direction:column;
    gap:8px;

    z-index:80;
  `;

  document.body.appendChild(
    sideDock
  );

  function createDockButton(
    icon,
    label
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.innerHTML =
      icon;

    button.title =
      label;

    button.style.cssText = `
      width:44px;
      height:44px;

      border:
        1px solid
        rgba(255,255,255,0.07);

      border-radius:10px;

      background:
        rgba(255,255,255,0.03);

      color:white;

      font-size:18px;

      cursor:pointer;

      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.15s ease;
    `;

    button.onmouseenter =
      () => {
        button.style.background =
          "rgba(38,164,230,0.17)";

        button.style.borderColor =
          "rgba(88,218,255,0.30)";

        button.style.transform =
          "translateY(-1px)";
      };

    button.onmouseleave =
      () => {
        button.style.background =
          "rgba(255,255,255,0.03)";

        button.style.borderColor =
          "rgba(255,255,255,0.07)";

        button.style.transform =
          "translateY(0)";
      };

    sideDock.appendChild(
      button
    );

    return button;
  }

  const buildButton =
    createDockButton(
      "🏗️",
      "Construction"
    );

  const worldButton =
    createDockButton(
      "🌍",
      "World"
    );

  const economyButton =
    createDockButton(
      "📊",
      "Economy"
    );

  const regionButton =
    createDockButton(
      "🗺️",
      "Regions"
    );

  const researchButton =
    createDockButton(
      "🔬",
      "Research"
    );

  const settingsButton =
    createDockButton(
      "⚙️",
      "Settings"
    );

  // =========================================================
  // RIGHT INSPECTOR
  // =========================================================

  const inspector =
    document.createElement(
      "div"
    );

  inspector.style.cssText = `
    position:absolute;

    right:16px;
    top:84px;

    width:320px;

    max-height:
      calc(100vh - 135px);

    overflow-y:auto;

    ${panelTheme()}

    border-radius:14px;

    padding:16px;

    z-index:76;

    display:none;
  `;

  document.body.appendChild(
    inspector
  );

  function hideInspector() {
    inspector.style.display =
      "none";
  }

  function inspectorHeader(
    title,
    subtitle,
    accent =
      "#87eaff"
  ) {
    return `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:flex-start;
          gap:12px;
        "
      >
        <div>
          <div
            style="
              color:${accent};
              font-size:20px;
              font-weight:850;
            "
          >
            ${title}
          </div>

          <div
            style="
              margin-top:3px;
              font-size:10px;
              letter-spacing:0.6px;
              opacity:0.48;
            "
          >
            ${subtitle}
          </div>
        </div>

        <button
          id="closeInspector"
          style="
            border:none;
            background:none;
            color:white;
            font-size:18px;
            cursor:pointer;
            opacity:0.8;
          "
        >
          ✕
        </button>
      </div>
    `;
  }

  function wireInspectorClose() {
    const closeButton =
      document.getElementById(
        "closeInspector"
      );

    if (
      closeButton instanceof
      HTMLButtonElement
    ) {
      closeButton.onclick =
        hideInspector;
    }
  }

  function showBuildingInspector(
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

    inspector.style.display =
      "block";

    let productionBlock =
      "";

    if (
      data.production
    ) {
      productionBlock += `
        <div
          style="
            margin-top:12px;
            padding:10px;
            border-radius:9px;
            background:
              rgba(126,229,162,0.07);
            border:
              1px solid
              rgba(126,229,162,0.12);
          "
        >
          <div
            style="
              font-size:9px;
              opacity:0.48;
            "
          >
            PRODUCTION
          </div>

          <div
            style="
              margin-top:4px;
              color:#8debae;
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
      productionBlock += `
        <div
          style="
            margin-top:8px;
            padding:10px;
            border-radius:9px;
            background:
              rgba(255,209,103,0.06);
            border:
              1px solid
              rgba(255,209,103,0.10);
          "
        >
          <div
            style="
              font-size:9px;
              opacity:0.48;
            "
          >
            CONSUMPTION
          </div>

          <div
            style="
              margin-top:4px;
              color:#ffd66f;
              font-weight:bold;
            "
          >
            ${data.consumption}
          </div>
        </div>
      `;
    }

    inspector.innerHTML =
      inspectorHeader(
        data.displayName ||
          "Building",
        (
          data.interactiveType ||
          "BUILDING"
        ).toUpperCase()
      ) +
      `
        <div
          style="
            margin-top:14px;
            display:grid;
            grid-template-columns:
              1fr 1fr;
            gap:8px;
          "
        >
          <div
            style="
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              LEVEL
            </div>

            <b>
              ${data.level || 1}
            </b>
          </div>

          <div
            style="
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              EFFICIENCY
            </div>

            <b>
              100%
            </b>
          </div>
        </div>

        ${productionBlock}

        <button
          id="upgradeSelected"
          style="
            width:100%;

            margin-top:14px;

            padding:10px;

            border:
              1px solid
              rgba(80,210,255,0.32);

            border-radius:9px;

            background:
              linear-gradient(
                180deg,
                rgba(31,145,210,0.85),
                rgba(18,105,168,0.85)
              );

            color:white;
            font-weight:bold;
            cursor:pointer;
          "
        >
          UPGRADE BUILDING
        </button>

        <button
          id="demolishSelected"
          style="
            width:100%;

            margin-top:8px;

            padding:9px;

            border:
              1px solid
              rgba(255,110,110,0.14);

            border-radius:9px;

            background:
              rgba(125,35,42,0.35);

            color:#ffb4b4;

            font-weight:bold;
            cursor:pointer;
          "
        >
          DEMOLISH
        </button>
      `;

    wireInspectorClose();

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
          const currentLevel =
            data.level ||
            1;

          const cost =
            1000 *
            currentLevel;

          if (
            money < cost
          ) {
            showToast(
              "Not enough credits.",
              "warning"
            );

            return;
          }

          money -= cost;

          data.level =
            currentLevel +
            1;

          mesh.scaling.y *=
            1.035;

          updateHUD();
          saveGame();

          showBuildingInspector(
            mesh
          );

          showToast(
            data.displayName +
              " upgraded to Level " +
              data.level,
            "success"
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
          showToast(
            "Demolition will activate with full construction placement.",
            "info"
          );
        };
    }
  }

  // =========================================================
  // TERRAIN / REGION INSPECTOR
  // =========================================================

  function closestRegionTo(
    point
  ) {
    let closest = null;
    let best = Infinity;

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
        distance < best
      ) {
        best = distance;
        closest = region;
      }
    }

    return {
      region: closest,
      distance: best
    };
  }

  function showTerrainInspector(
    point
  ) {
    const result =
      closestRegionTo(
        point
      );

    const region =
      result.region;

    const inside =
      region &&
      result.distance <=
        region.radius;

    const name =
      inside
        ? region.name
        : "Open Territory";

    const type =
      inside
        ? region.type
        : "Grassland";

    const accent =
      inside
        ? region.color
        : "#bfe09a";

    const description =
      inside
        ? region.description
        : "Open land available for future expansion and development.";

    inspector.style.display =
      "block";

    inspector.innerHTML =
      inspectorHeader(
        name,
        "REGION • " +
          type.toUpperCase(),
        accent
      ) +
      `
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

            display:grid;
            grid-template-columns:
              1fr 1fr;
            gap:8px;
          "
        >
          <div
            style="
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              X
            </div>

            <b>
              ${point.x.toFixed(0)}
            </b>
          </div>

          <div
            style="
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              Z
            </div>

            <b>
              ${point.z.toFixed(0)}
            </b>
          </div>
        </div>

        <div
          style="
            margin-top:8px;
            padding:10px;
            border-radius:9px;
            background:
              rgba(255,255,255,0.035);
          "
        >
          <div
            style="
              font-size:9px;
              opacity:0.48;
            "
          >
            CONSTRUCTION
          </div>

          <div
            style="
              margin-top:3px;
              color:#8debae;
              font-weight:bold;
            "
          >
            BUILDABLE
          </div>
        </div>
      `;

    wireInspectorClose();
  }

  // =========================================================
  // BOTTOM STATUS BAR
  // =========================================================

  const bottomBar =
    document.createElement(
      "div"
    );

  bottomBar.style.cssText = `
    position:absolute;

    left:50%;
    bottom:15px;

    transform:
      translateX(-50%);

    min-width:420px;
    max-width:68vw;

    ${panelTheme()}

    border-radius:11px;

    padding:
      9px 14px;

    text-align:center;

    font-size:11px;

    z-index:78;
  `;

  document.body.appendChild(
    bottomBar
  );

  function setBottomStatus(
    text
  ) {
    bottomBar.innerHTML =
      text;
  }

  setBottomStatus(
    "Explore the expanded world • Click buildings or terrain for details"
  );

  // =========================================================
  // TOASTS
  // =========================================================

  const toastHost =
    document.createElement(
      "div"
    );

  toastHost.style.cssText = `
    position:absolute;

    top:82px;
    left:50%;

    transform:
      translateX(-50%);

    display:flex;
    flex-direction:column;
    gap:7px;

    z-index:120;

    pointer-events:none;
  `;

  document.body.appendChild(
    toastHost
  );

  function showToast(
    text,
    type =
      "info"
  ) {
    const toast =
      document.createElement(
        "div"
      );

    let accent =
      "#7fe9ff";

    if (
      type ===
      "success"
    ) {
      accent =
        "#88e8a9";
    }

    if (
      type ===
      "warning"
    ) {
      accent =
        "#ffd46d";
    }

    toast.style.cssText = `
      padding:
        9px 13px;

      border-radius:9px;

      background:
        rgba(5,12,23,0.94);

      border:
        1px solid
        ${accent}44;

      color:white;

      font-family:
        Arial,
        sans-serif;

      font-size:11px;

      box-shadow:
        0 8px 24px
        rgba(0,0,0,0.22);

      pointer-events:none;
    `;

    toast.innerHTML = `
      <span
        style="
          color:${accent};
          font-weight:bold;
        "
      >
        ${text}
      </span>
    `;

    toastHost.appendChild(
      toast
    );

    setTimeout(
      () => {
        toast.remove();
      },
      2600
    );
  }


  // =========================================================
  // BUILD MODE ACTION CONTROLS
  // =========================================================

  const buildActionControls =
    document.createElement(
      "div"
    );

  buildActionControls.style.cssText = `
    position:absolute;
    right:18px;
    bottom:248px;

    display:none;
    flex-direction:column;
    gap:7px;

    z-index:96;
  `;

  document.body.appendChild(
    buildActionControls
  );

  function createBuildActionButton(
    label
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.innerText =
      label;

    button.style.cssText = `
      min-width:112px;

      padding:
        9px 12px;

      border:
        1px solid
        rgba(90,215,255,0.30);

      border-radius:9px;

      background:
        rgba(5,14,25,0.88);

      color:white;

      font-size:11px;
      font-weight:bold;

      cursor:pointer;
      touch-action:none;

      backdrop-filter:
        blur(6px);
    `;

    buildActionControls.appendChild(
      button
    );

    return button;
  }

  const rotateBuildButton =
    createBuildActionButton(
      "↻ ROTATE"
    );

  const cancelBuildButton =
    createBuildActionButton(
      "✕ CANCEL"
    );

  // =========================================================
  // CONSTRUCTION TERMINAL
  // =========================================================

  const shop =
    document.createElement(
      "div"
    );

  shop.style.cssText = `
    position:absolute;

    left:86px;
    top:84px;

    width:520px;

    max-height:
      calc(100vh - 125px);

    overflow-y:auto;

    ${panelTheme()}

    border-radius:15px;

    padding:18px;

    z-index:84;

    display:none;
  `;

  document.body.appendChild(
    shop
  );

  let activeCategory =
    "industry";

  const shopItems = {
    industry: [
      {
        name:
          "Iron Mine",
        buildType:
          "ironMine",
        type:
          "RESOURCE EXTRACTION",
        cost: 750,
        accent:
          "#c8d0d6",
        description:
          "Extracts iron ore for industrial production.",
        stats:
          "+3 Iron / cycle • -1 Power"
      },
      {
        name:
          "Steel Mill",
        buildType:
          "steelMill",
        type:
          "HEAVY INDUSTRY",
        cost: 1200,
        accent:
          "#94bddb",
        description:
          "Refines iron into construction-grade steel.",
        stats:
          "+1 Steel / cycle • -3 Iron • -2 Power"
      },
      {
        name:
          "Fabrication Plant",
        buildType:
          "fabricationPlant",
        type:
          "MANUFACTURING",
        cost: 1800,
        accent:
          "#88c8ec",
        description:
          "Future manufacturing center for advanced goods.",
        stats:
          "Advanced production"
      },
      {
        name:
          "Warehouse",
        buildType:
          "warehouse",
        type:
          "STORAGE",
        cost: 650,
        accent:
          "#d1d7dc",
        description:
          "Future storage and logistics buffer.",
        stats:
          "Storage infrastructure"
      }
    ],

    civil: [
      {
        name:
          "Residential Block",
        buildType:
          "residential",
        type:
          "RESIDENTIAL",
        cost: 500,
        accent:
          "#9fecc0",
        description:
          "Expands housing and population capacity.",
        stats:
          "+500 population capacity"
      },
      {
        name:
          "Commercial Center",
        buildType:
          "commercial",
        type:
          "COMMERCIAL",
        cost: 900,
        accent:
          "#8de5dc",
        description:
          "Future local income and employment hub.",
        stats:
          "Income infrastructure"
      },
      {
        name:
          "Town Hall Upgrade",
        type:
          "ADMINISTRATION",
        cost:
          2000 *
          townHallLevel,
        accent:
          "#82eaff",
        description:
          "Improves government capacity and offline income.",
        stats:
          "Current Level " +
          townHallLevel
      }
    ],

    power: [
      {
        name:
          "Power Plant",
        buildType:
          "powerPlant",
        type:
          "ENERGY",
        cost: 950,
        accent:
          "#ffd76e",
        description:
          "Generates power for industrial buildings.",
        stats:
          "+8 Power / cycle"
      },
      {
        name:
          "Grid Substation",
        buildType:
          "substation",
        type:
          "POWER GRID",
        cost: 700,
        accent:
          "#ffe8a0",
        description:
          "Future power distribution and efficiency structure.",
        stats:
          "Grid infrastructure"
      }
    ],

    infrastructure: [
      {
        name:
          "Road",
        type:
          "TRANSPORT",
        cost: 100,
        accent:
          "#c9ced4",
        description:
          "Connects districts and future logistics systems.",
        stats:
          "Placement coming next"
      },
      {
        name:
          "Bridge",
        type:
          "TRANSPORT",
        cost: 450,
        accent:
          "#dde2e6",
        description:
          "Connects development across rivers.",
        stats:
          "Placement coming next"
      },
      {
        name:
          "Power Pylon",
        buildType:
          "pylon",
        type:
          "UTILITIES",
        cost: 220,
        accent:
          "#c4cbd1",
        description:
          "Future transmission network component.",
        stats:
          "Grid infrastructure"
      }
    ]
  };


  // =========================================================
  // CONSTRUCTION CORE
  // =========================================================

  const buildingDefinitions = {
    ironMine: {
      name: "Iron Mine",
      width: 28,
      depth: 24,
      height: 8,
      cost: 750,
      production: "+3 Iron / cycle",
      consumption: "-1 Power"
    },

    steelMill: {
      name: "Steel Mill",
      width: 36,
      depth: 28,
      height: 11,
      cost: 1200,
      production: "+1 Steel / cycle",
      consumption: "-3 Iron, -2 Power"
    },

    fabricationPlant: {
      name: "Fabrication Plant",
      width: 30,
      depth: 24,
      height: 9,
      cost: 1800,
      production: "Advanced manufacturing",
      consumption: "-4 Power"
    },

    warehouse: {
      name: "Warehouse",
      width: 28,
      depth: 22,
      height: 8,
      cost: 650,
      production: "Storage infrastructure"
    },

    residential: {
      name: "Residential Block",
      width: 18,
      depth: 18,
      height: 14,
      cost: 500,
      production: "+500 population capacity"
    },

    commercial: {
      name: "Commercial Center",
      width: 22,
      depth: 20,
      height: 17,
      cost: 900,
      production: "Commercial income"
    },

    powerPlant: {
      name: "Power Plant",
      width: 34,
      depth: 28,
      height: 11,
      cost: 950,
      production: "+8 Power / cycle"
    },

    substation: {
      name: "Grid Substation",
      width: 22,
      depth: 18,
      height: 6,
      cost: 700,
      production: "Power-grid infrastructure"
    },

    pylon: {
      name: "Power Pylon",
      width: 10,
      depth: 10,
      height: 20,
      cost: 220,
      production: "Power-grid infrastructure"
    }
  };

  const ghostGoodMat =
    new BABYLON.StandardMaterial(
      "ghostGoodMat",
      scene
    );

  ghostGoodMat.diffuseColor =
    new BABYLON.Color3(
      0.10,
      0.92,
      0.48
    );

  ghostGoodMat.emissiveColor =
    new BABYLON.Color3(
      0.03,
      0.32,
      0.13
    );

  ghostGoodMat.alpha = 0.44;

  const ghostBadMat =
    new BABYLON.StandardMaterial(
      "ghostBadMat",
      scene
    );

  ghostBadMat.diffuseColor =
    new BABYLON.Color3(
      0.95,
      0.13,
      0.16
    );

  ghostBadMat.emissiveColor =
    new BABYLON.Color3(
      0.32,
      0.02,
      0.03
    );

  ghostBadMat.alpha = 0.44;

  const blockedInfrastructureZones = [
    // Main roads
    { x: 0, z: -70, width: 20, depth: 475, rotation: 0 },
    { x: 0, z: -65, width: 505, depth: 20, rotation: 0 },
    { x: 285, z: -115, width: 18, depth: 275, rotation: 0 },
    { x: -280, z: 25, width: 18, depth: 285, rotation: 0 },
    { x: 0, z: 285, width: 505, depth: 19, rotation: 0 },
    { x: -250, z: -230, width: 18, depth: 245, rotation: -Math.PI / 7 },
    { x: 310, z: 270, width: 18, depth: 265, rotation: -Math.PI / 12 },

    // River and lake
    { x: -270, z: 125, width: 305, depth: 48, rotation: Math.PI / 20 },
    { x: 0, z: 150, width: 335, depth: 52, rotation: -Math.PI / 28 },
    { x: 300, z: 175, width: 315, depth: 48, rotation: Math.PI / 18 },
    { x: -365, z: 330, width: 158, depth: 108, rotation: Math.PI / 10 }
  ];

  function getRotatedFootprint(
    definition,
    rotation
  ) {
    const turns =
      Math.round(
        rotation /
        (Math.PI / 2)
      );

    const odd =
      Math.abs(turns % 2) === 1;

    return odd
      ? {
          width: definition.depth,
          depth: definition.width
        }
      : {
          width: definition.width,
          depth: definition.depth
        };
  }

  function pointInRotatedRectangle(
    px,
    pz,
    cx,
    cz,
    width,
    depth,
    rotation
  ) {
    const dx = px - cx;
    const dz = pz - cz;

    const cos =
      Math.cos(-rotation);

    const sin =
      Math.sin(-rotation);

    const localX =
      dx * cos -
      dz * sin;

    const localZ =
      dx * sin +
      dz * cos;

    return (
      Math.abs(localX) <=
        width / 2 &&
      Math.abs(localZ) <=
        depth / 2
    );
  }

  function footprintHitsBlockedZone(
    x,
    z,
    width,
    depth
  ) {
    const points = [
      [x, z],
      [x - width / 2, z - depth / 2],
      [x + width / 2, z - depth / 2],
      [x - width / 2, z + depth / 2],
      [x + width / 2, z + depth / 2]
    ];

    return blockedInfrastructureZones.some(
      zone =>
        points.some(
          point =>
            pointInRotatedRectangle(
              point[0],
              point[1],
              zone.x,
              zone.z,
              zone.width,
              zone.depth,
              zone.rotation
            )
        )
    );
  }

  function rectangleOverlap(
    ax,
    az,
    aw,
    ad,
    bx,
    bz,
    bw,
    bd,
    padding = 3
  ) {
    return (
      Math.abs(ax - bx) <
        (aw + bw) / 2 +
          padding &&
      Math.abs(az - bz) <
        (ad + bd) / 2 +
          padding
    );
  }

  function overlapsExistingStructure(
    x,
    z,
    width,
    depth
  ) {
    for (
      const building of placedBuildings
    ) {
      const definition =
        buildingDefinitions[
          building.type
        ];

      if (!definition) {
        continue;
      }

      const fp =
        getRotatedFootprint(
          definition,
          building.rotation || 0
        );

      if (
        rectangleOverlap(
          x,
          z,
          width,
          depth,
          building.x,
          building.z,
          fp.width,
          fp.depth,
          4
        )
      ) {
        return true;
      }
    }

    for (
      const mesh of scene.meshes
    ) {
      if (
        !mesh.metadata ||
        !mesh.metadata
          .blocksConstruction ||
        mesh.metadata
          .placedBuildingId
      ) {
        continue;
      }

      const info =
        mesh.getBoundingInfo();

      if (!info) {
        continue;
      }

      const bounds =
        info.boundingBox;

      const min =
        bounds.minimumWorld;

      const max =
        bounds.maximumWorld;

      const meshWidth =
        Math.max(
          1,
          max.x - min.x
        );

      const meshDepth =
        Math.max(
          1,
          max.z - min.z
        );

      const centerX =
        (min.x + max.x) / 2;

      const centerZ =
        (min.z + max.z) / 2;

      if (
        rectangleOverlap(
          x,
          z,
          width,
          depth,
          centerX,
          centerZ,
          meshWidth,
          meshDepth,
          4
        )
      ) {
        return true;
      }
    }

    return false;
  }

  function isPlacementValid(
    x,
    z,
    type,
    rotation
  ) {
    const definition =
      buildingDefinitions[
        type
      ];

    if (!definition) {
      return false;
    }

    const fp =
      getRotatedFootprint(
        definition,
        rotation
      );

    if (
      Math.abs(x) +
        fp.width / 2 >
        WORLD_LIMIT ||
      Math.abs(z) +
        fp.depth / 2 >
        WORLD_LIMIT
    ) {
      return false;
    }

    if (
      money <
      definition.cost
    ) {
      return false;
    }

    if (
      footprintHitsBlockedZone(
        x,
        z,
        fp.width,
        fp.depth
      )
    ) {
      return false;
    }

    if (
      overlapsExistingStructure(
        x,
        z,
        fp.width,
        fp.depth
      )
    ) {
      return false;
    }

    return true;
  }

  function createGhost(
    type
  ) {
    const definition =
      buildingDefinitions[
        type
      ];

    if (!definition) {
      return null;
    }

    const ghost =
      BABYLON.MeshBuilder.CreateBox(
        "buildGhost",
        {
          width:
            definition.width,
          height:
            definition.height,
          depth:
            definition.depth
        },
        scene
      );

    ghost.material =
      ghostBadMat;

    ghost.isPickable =
      false;

    ghost.renderingGroupId = 2;

    return ghost;
  }

  function createPlacedBuildingVisual(
    data
  ) {
    const definition =
      buildingDefinitions[
        data.type
      ];

    if (!definition) {
      return null;
    }

    const root =
      new BABYLON.TransformNode(
        "playerBuildingRoot_" +
          data.id,
        scene
      );

    root.position =
      new BABYLON.Vector3(
        data.x,
        data.y || 0,
        data.z
      );

    root.rotation.y =
      data.rotation || 0;

    let bodyMaterial =
      concreteMat;

    if (
      data.type ===
      "ironMine"
    ) {
      bodyMaterial =
        mineMat;
    }

    if (
      data.type ===
        "steelMill" ||
      data.type ===
        "fabricationPlant" ||
      data.type ===
        "warehouse" ||
      data.type ===
        "substation"
    ) {
      bodyMaterial =
        industrialMat;
    }

    if (
      data.type ===
      "powerPlant"
    ) {
      bodyMaterial =
        powerMat;
    }

    if (
      data.type ===
      "pylon"
    ) {
      bodyMaterial =
        pylonMat;
    }

    const body =
      BABYLON.MeshBuilder.CreateBox(
        "playerBuilding_" +
          data.id,
        {
          width:
            definition.width,
          height:
            definition.height,
          depth:
            definition.depth
        },
        scene
      );

    body.parent = root;

    body.position.y =
      definition.height / 2;

    body.material =
      bodyMaterial;

    shadowGenerator.addShadowCaster(
      body
    );

    markInteractive(
      body,
      data.type,
      definition.name,
      {
        level:
          data.level || 1,
        production:
          definition.production,
        consumption:
          definition.consumption,
        placedBuildingId:
          data.id
      }
    );

    body.metadata
      .blocksConstruction =
      true;

    if (
      data.type ===
        "residential" ||
      data.type ===
        "commercial"
    ) {
      const glass =
        BABYLON.MeshBuilder.CreateBox(
          "playerGlass_" +
            data.id,
          {
            width:
              definition.width *
              0.68,
            height:
              definition.height *
              0.58,
            depth: 0.25
          },
          scene
        );

      glass.parent = root;

      glass.position =
        new BABYLON.Vector3(
          0,
          definition.height *
            0.52,
          -definition.depth /
            2 -
            0.14
        );

      glass.material =
        glassMat;

      glass.isPickable =
        false;

      const roof =
        BABYLON.MeshBuilder.CreateBox(
          "playerRoof_" +
            data.id,
          {
            width:
              definition.width +
              0.8,
            height: 0.7,
            depth:
              definition.depth +
              0.8
          },
          scene
        );

      roof.parent = root;

      roof.position.y =
        definition.height +
        0.35;

      roof.material =
        darkMat;

      roof.isPickable =
        false;
    }

    if (
      data.type ===
      "ironMine"
    ) {
      const tower =
        BABYLON.MeshBuilder.CreateCylinder(
          "playerMineTower_" +
            data.id,
          {
            diameter:
              definition.width *
              0.34,
            height:
              definition.height *
              1.7,
            tessellation: 8
          },
          scene
        );

      tower.parent =
        root;

      tower.position.y =
        definition.height +
        3;

      tower.material =
        darkMat;

      tower.isPickable =
        false;
    }

    if (
      data.type ===
        "steelMill" ||
      data.type ===
        "fabricationPlant"
    ) {
      for (
        let i = 0;
        i < 3;
        i++
      ) {
        const stack =
          BABYLON.MeshBuilder.CreateCylinder(
            "playerStack_" +
              data.id +
              "_" +
              i,
            {
              diameter: 2.5,
              height:
                definition.height *
                1.7,
              tessellation: 12
            },
            scene
          );

        stack.parent =
          root;

        stack.position =
          new BABYLON.Vector3(
            -definition.width *
              0.28 +
              i * 7,
            definition.height +
              4,
            -definition.depth *
              0.22
          );

        stack.material =
          darkMat;

        stack.isPickable =
          false;
      }
    }

    if (
      data.type ===
      "powerPlant"
    ) {
      for (
        let i = 0;
        i < 2;
        i++
      ) {
        const tower =
          BABYLON.MeshBuilder.CreateCylinder(
            "playerCooling_" +
              data.id +
              "_" +
              i,
            {
              diameterTop: 6,
              diameterBottom: 9,
              height: 15,
              tessellation: 16
            },
            scene
          );

        tower.parent =
          root;

        tower.position =
          new BABYLON.Vector3(
            -8 + i * 16,
            12,
            0
          );

        tower.material =
          concreteMat;

        tower.isPickable =
          false;
      }
    }

    if (
      data.type ===
      "pylon"
    ) {
      body.scaling.x =
        0.24;

      body.scaling.z =
        0.24;

      const arm =
        BABYLON.MeshBuilder.CreateBox(
          "playerPylonArm_" +
            data.id,
          {
            width: 9,
            height: 1,
            depth: 1
          },
          scene
        );

      arm.parent =
        root;

      arm.position.y =
        definition.height *
        0.72;

      arm.material =
        pylonMat;

      arm.isPickable =
        false;
    }

    return {
      root,
      body
    };
  }

  function beginBuildMode(
    type
  ) {
    const definition =
      buildingDefinitions[
        type
      ];

    if (!definition) {
      showToast(
        "This structure is not placeable yet.",
        "warning"
      );

      return;
    }

    cancelBuildMode(
      false
    );

    buildMode = {
      type
    };

    buildRotation = 0;

    buildGhost =
      createGhost(
        type
      );

    buildActionControls
      .style.display =
      "flex";

    setBottomStatus(
      "<b>" +
        definition.name +
        "</b> • " +
        formatMoney(
          definition.cost
        ) +
        " • Click/tap to place • R rotate • Esc cancel"
    );

    showToast(
      definition.name +
        " ready to place",
      "info"
    );
  }

  function cancelBuildMode(
    notify = true
  ) {
    if (
      buildGhost
    ) {
      buildGhost.dispose();
      buildGhost = null;
    }

    buildMode = null;

    buildGhostValid =
      false;

    buildActionControls
      .style.display =
      "none";

    if (notify) {
      setBottomStatus(
        "Construction cancelled • choose another building or continue exploring"
      );
    }
  }

  function rotateBuildGhost() {
    if (
      !buildMode ||
      !buildGhost
    ) {
      return;
    }

    buildRotation +=
      Math.PI / 2;

    if (
      buildRotation >=
      Math.PI * 2
    ) {
      buildRotation = 0;
    }

    buildGhost.rotation.y =
      buildRotation;
  }

  function updateBuildGhost() {
    if (
      !buildMode ||
      !buildGhost
    ) {
      return;
    }

    const pick =
      scene.pick(
        scene.pointerX,
        scene.pointerY,
        mesh =>
          mesh === ground
      );

    if (
      !pick ||
      !pick.hit ||
      !pick.pickedPoint
    ) {
      buildGhost.setEnabled(
        false
      );

      buildGhostValid =
        false;

      return;
    }

    const point =
      pick.pickedPoint;

    buildGhost.setEnabled(
      true
    );

    const definition =
      buildingDefinitions[
        buildMode.type
      ];

    buildGhost.position =
      new BABYLON.Vector3(
        point.x,
        point.y +
          definition.height /
            2,
        point.z
      );

    buildGhost.rotation.y =
      buildRotation;

    buildGhostValid =
      isPlacementValid(
        point.x,
        point.z,
        buildMode.type,
        buildRotation
      );

    buildGhost.material =
      buildGhostValid
        ? ghostGoodMat
        : ghostBadMat;
  }

  function placeCurrentBuilding() {
    if (
      !buildMode ||
      !buildGhost ||
      !buildGhostValid
    ) {
      showToast(
        "That location is blocked.",
        "warning"
      );

      return;
    }

    const definition =
      buildingDefinitions[
        buildMode.type
      ];

    if (
      money <
      definition.cost
    ) {
      showToast(
        "Not enough credits.",
        "warning"
      );

      return;
    }

    const id =
      "building_" +
      nextBuildingId++;

    const data = {
      id,
      type:
        buildMode.type,
      x:
        buildGhost.position.x,
      y:
        buildGhost.position.y -
        definition.height / 2,
      z:
        buildGhost.position.z,
      rotation:
        buildRotation,
      level: 1
    };

    money -=
      definition.cost;

    placedBuildings.push(
      data
    );

    createPlacedBuildingVisual(
      data
    );

    updateHUD();
    saveGame();

    showToast(
      definition.name +
        " constructed",
      "success"
    );

    // Keep placing the same type until cancelled, like a real strategy game.
    updateBuildGhost();
  }

  rotateBuildButton.onclick =
    rotateBuildGhost;

  cancelBuildButton.onclick =
    () => {
      cancelBuildMode();
    };

  function shopCard(
    item,
    index
  ) {
    return `
      <div
        style="
          padding:13px;

          border-radius:11px;

          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.04),
              rgba(255,255,255,0.022)
            );

          border:
            1px solid
            rgba(255,255,255,0.07);
        "
      >
        <div
          style="
            color:${item.accent};
            font-size:16px;
            font-weight:850;
          "
        >
          ${item.name}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:9px;
            opacity:0.46;
            letter-spacing:0.5px;
          "
        >
          ${item.type}
        </div>

        <div
          style="
            margin-top:9px;
            font-size:12px;
            line-height:1.45;
            opacity:0.80;
          "
        >
          ${item.description}
        </div>

        <div
          style="
            margin-top:9px;
            color:#9bdff5;
            font-size:10px;
          "
        >
          ${item.stats}
        </div>

        <div
          style="
            margin-top:12px;

            display:flex;
            align-items:center;
            justify-content:
              space-between;
          "
        >
          <b>
            ${formatMoney(
              item.cost
            )}
          </b>

          <button
            class="shopSelect"
            data-index="${index}"

            style="
              padding:
                7px 13px;

              border:
                1px solid
                rgba(80,210,255,0.30);

              border-radius:8px;

              background:
                linear-gradient(
                  180deg,
                  rgba(31,145,210,0.86),
                  rgba(18,105,168,0.86)
                );

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

  function renderShop() {
    const items =
      shopItems[
        activeCategory
      ] || [];

    shop.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:flex-start;
          gap:12px;
        "
      >
        <div>
          <div
            style="
              font-size:21px;
              font-weight:850;
              color:#84eaff;
            "
          >
            CONSTRUCTION NETWORK
          </div>

          <div
            style="
              margin-top:2px;
              font-size:9px;
              letter-spacing:0.6px;
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
            opacity:0.8;
          "
        >
          ✕
        </button>
      </div>

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:7px;
          margin-top:15px;
        "
      >
        <button
          class="shopTab"
          data-category="industry"
        >
          INDUSTRY
        </button>

        <button
          class="shopTab"
          data-category="civil"
        >
          CIVIL
        </button>

        <button
          class="shopTab"
          data-category="power"
        >
          POWER
        </button>

        <button
          class="shopTab"
          data-category="infrastructure"
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
              shopCard(
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
          activeCategory;

        tab.style.cssText = `
          padding:
            7px 10px;

          border:
            1px solid
            ${
              active
                ? "rgba(86,218,255,0.42)"
                : "rgba(255,255,255,0.07)"
            };

          border-radius:8px;

          background:
            ${
              active
                ? "rgba(32,154,220,0.16)"
                : "rgba(255,255,255,0.025)"
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

            activeCategory =
              category;

            renderShop();
          };
      }
    );

    const selectButtons =
      shop.querySelectorAll(
        ".shopSelect"
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
                button.dataset.index
              );

            const item =
              items[
                index
              ];

            if (!item) {
              return;
            }

            shop.style.display =
              "none";

            if (
              item.buildType
            ) {
              beginBuildMode(
                item.buildType
              );

              return;
            }

            showToast(
              item.name +
                " is not placeable yet.",
              "warning"
            );
          };
      }
    );
  }

  buildButton.onclick =
    () => {
      const open =
        shop.style.display ===
        "block";

      shop.style.display =
        open
          ? "none"
          : "block";

      if (!open) {
        renderShop();
      }
    };

  // =========================================================
  // WORLD OVERVIEW
  // =========================================================

  function showWorldOverview() {
    inspector.style.display =
      "block";

    inspector.innerHTML =
      inspectorHeader(
        "World Overview",
        regions.length +
          " DEVELOPMENT REGIONS"
      ) +
      `
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
                <button
                  class="regionJump"
                  data-region="${region.id}"

                  style="
                    padding:10px;

                    text-align:left;

                    border:
                      1px solid
                      rgba(255,255,255,0.06);

                    border-radius:9px;

                    background:
                      rgba(255,255,255,0.03);

                    color:white;

                    cursor:pointer;
                  "
                >
                  <div
                    style="
                      color:${region.color};
                      font-weight:bold;
                    "
                  >
                    ${region.name}
                  </div>

                  <div
                    style="
                      margin-top:2px;
                      font-size:9px;
                      opacity:0.48;
                    "
                  >
                    ${region.type.toUpperCase()}
                  </div>
                </button>
              `
            )
            .join("")}
        </div>
      `;

    wireInspectorClose();

    const jumpButtons =
      inspector.querySelectorAll(
        ".regionJump"
      );

    jumpButtons.forEach(
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
            const id =
              button.dataset.region;

            const region =
              regions.find(
                r =>
                  r.id ===
                  id
              );

            if (!region) {
              return;
            }

            camera.target.x =
              region.x;

            camera.target.z =
              region.z;

            camera.radius =
              Math.max(
                115,
                region.radius *
                  1.3
              );

            showToast(
              "Camera moved to " +
                region.name,
              "info"
            );
          };
      }
    );
  }

  worldButton.onclick =
    showWorldOverview;

  regionButton.onclick =
    showWorldOverview;

  // =========================================================
  // ECONOMY PANEL
  // =========================================================

  economyButton.onclick =
    () => {
      inspector.style.display =
        "block";

      inspector.innerHTML =
        inspectorHeader(
          "Economy",
          "CIVILIZATION FINANCIAL NETWORK",
          "#82e8b0"
        ) +
        `
          <div
            style="
              margin-top:14px;
              display:grid;
              grid-template-columns:
                1fr 1fr;
              gap:8px;
            "
          >
            <div
              style="
                padding:10px;
                border-radius:9px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:9px;
                  opacity:0.48;
                "
              >
                TREASURY
              </div>

              <b>
                ${formatMoney(
                  money
                )}
              </b>
            </div>

            <div
              style="
                padding:10px;
                border-radius:9px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:9px;
                  opacity:0.48;
                "
              >
                INCOME
              </div>

              <b
                style="
                  color:#82e8b0;
                "
              >
                +$${incomePerMinute}/m
              </b>
            </div>

            <div
              style="
                padding:10px;
                border-radius:9px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:9px;
                  opacity:0.48;
                "
              >
                IRON
              </div>

              <b>
                ${Math.floor(
                  iron
                )}
              </b>
            </div>

            <div
              style="
                padding:10px;
                border-radius:9px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:9px;
                  opacity:0.48;
                "
              >
                STEEL
              </div>

              <b>
                ${Math.floor(
                  steel
                )}
              </b>
            </div>
          </div>

          <div
            style="
              margin-top:9px;
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              GRID POWER
            </div>

            <b
              style="
                color:#ffd66f;
              "
            >
              ${Math.floor(
                energy
              )}
            </b>
          </div>
        `;

      wireInspectorClose();
    };

  researchButton.onclick =
    () => {
      showToast(
        "Research comes after the construction foundation.",
        "info"
      );
    };

  settingsButton.onclick =
    () => {
      inspector.style.display =
        "block";

      inspector.innerHTML =
        inspectorHeader(
          "Settings",
          "DISPLAY + CONTROLS"
        ) +
        `
          <div
            style="
              margin-top:14px;
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
            "
          >
            <div
              style="
                font-size:9px;
                opacity:0.48;
              "
            >
              GRAPHICS PRESET
            </div>

            <b
              style="
                color:#8beaff;
              "
            >
              ${GRAPHICS_PRESET}
            </b>
          </div>

          <div
            style="
              margin-top:8px;
              padding:10px;
              border-radius:9px;
              background:
                rgba(255,255,255,0.035);
              line-height:1.5;
              font-size:11px;
            "
          >
            <b>Controls</b>
            <br>
            WASD / Arrow Keys / Touch pad — move
            <br>
            Mouse / touch drag — orbit
            <br>
            Wheel / pinch — zoom
          </div>
        `;

      wireInspectorClose();
    };

  // =========================================================
  // CLICK / TAP INSPECTION + CONSTRUCTION
  // =========================================================

  scene.onPointerObservable.add(
    pointerInfo => {
      if (
        pointerInfo.type ===
        BABYLON.PointerEventTypes
          .POINTERMOVE
      ) {
        updateBuildGhost();
        return;
      }

      if (
        pointerInfo.type !==
        BABYLON.PointerEventTypes
          .POINTERPICK
      ) {
        return;
      }

      if (
        buildMode
      ) {
        updateBuildGhost();

        if (
          buildGhostValid
        ) {
          placeCurrentBuilding();
        }

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
        showBuildingInspector(
          mesh
        );

        return;
      }

      if (
        mesh === ground &&
        pickInfo.pickedPoint
      ) {
        showTerrainInspector(
          pickInfo.pickedPoint
        );
      }
    }
  );

  // =========================================================
  // TOUCH MOVEMENT PAD
  // =========================================================

  const touchControls =
    document.createElement(
      "div"
    );

  touchControls.style.cssText = `
    position:absolute;

    right:18px;
    bottom:78px;

    display:grid;

    grid-template-columns:
      52px 52px 52px;

    grid-template-rows:
      52px 52px 52px;

    gap:6px;

    z-index:82;
  `;

  document.body.appendChild(
    touchControls
  );

  function makeTouchButton(
    text,
    col,
    row
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.innerText =
      text;

    button.style.cssText = `
      grid-column:${col};
      grid-row:${row};

      width:52px;
      height:52px;

      border-radius:13px;

      border:
        1px solid
        rgba(90,215,255,0.30);

      background:
        rgba(5,14,25,0.76);

      color:white;

      font-size:21px;
      font-weight:bold;

      touch-action:none;
      user-select:none;

      cursor:pointer;

      backdrop-filter:
        blur(5px);
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

  function bindTouchHold(
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
          "rgba(29,145,210,0.90)";

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
        "rgba(5,14,25,0.76)";
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

  bindTouchHold(
    touchUp,
    "up"
  );

  bindTouchHold(
    touchDown,
    "down"
  );

  bindTouchHold(
    touchLeft,
    "left"
  );

  bindTouchHold(
    touchRight,
    "right"
  );

  // =========================================================
  // KEYBOARD + CAMERA MOVEMENT
  // =========================================================

  const keys = {};

  window.addEventListener(
    "keydown",
    event => {
      const key =
        event.key.toLowerCase();

      keys[
        key
      ] = true;

      if (
        key === "r" &&
        buildMode
      ) {
        rotateBuildGhost();
      }

      if (
        key === "escape" &&
        buildMode
      ) {
        cancelBuildMode();
      }
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
          0.78 *
          (
            camera.radius /
            150
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
            -WORLD_LIMIT,
            WORLD_LIMIT
          );

        camera.target.z =
          BABYLON.Scalar.Clamp(
            camera.target.z,
            -WORLD_LIMIT,
            WORLD_LIMIT
          );
      }
    );

  // =========================================================
  // SAVE / LOAD
  // =========================================================

  function saveGame() {
    const data = {
      money,
      iron,
      steel,
      energy,
      population,
      townHallLevel,
      placedBuildings,
      nextBuildingId,
      lastSaved:
        Date.now()
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

      placedBuildings =
        Array.isArray(
          data.placedBuildings
        )
          ? data.placedBuildings
          : [];

      nextBuildingId =
        data.nextBuildingId ??
        (
          placedBuildings.length +
          1
        );

      for (
        const building of placedBuildings
      ) {
        createPlacedBuildingVisual(
          building
        );
      }

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
          12 *
            60 *
            60
        );

      const offlineCash =
        secondsAway *
        (
          2 *
          townHallLevel
        );

      money +=
        offlineCash;

      if (
        offlineCash >
        0
      ) {
        setTimeout(
          () => {
            showToast(
              "Offline earnings: " +
                formatMoney(
                  offlineCash
                ),
              "success"
            );
          },
          450
        );
      }
    } catch {
      console.log(
        "Save data could not be loaded."
      );
    }
  }

  // =========================================================
  // PASSIVE ECONOMY
  // =========================================================

  const productionTimer =
    setInterval(
      () => {
        const playerPowerPlants =
          placedBuildings.filter(
            building =>
              building.type ===
              "powerPlant"
          ).length;

        const playerMines =
          placedBuildings.filter(
            building =>
              building.type ===
              "ironMine"
          ).length;

        const playerMills =
          placedBuildings.filter(
            building =>
              building.type ===
              "steelMill"
          ).length;

        const playerCommercial =
          placedBuildings.filter(
            building =>
              building.type ===
              "commercial"
          ).length;

        const playerResidential =
          placedBuildings.filter(
            building =>
              building.type ===
              "residential"
          ).length;

        energy +=
          8 +
          playerPowerPlants *
          8;

        const mineCount =
          1 +
          playerMines;

        for (
          let i = 0;
          i < mineCount;
          i++
        ) {
          if (
            energy >= 1
          ) {
            energy -= 1;
            iron += 3;
          }
        }

        const millCount =
          1 +
          playerMills;

        for (
          let i = 0;
          i < millCount;
          i++
        ) {
          if (
            iron >= 3 &&
            energy >= 2
          ) {
            iron -= 3;
            energy -= 2;

            steel += 1;
            money += 75;
          }
        }

        money +=
          playerCommercial *
          18;

        population =
          Math.max(
            population,
            3800 +
              playerResidential *
              500
          );

        updateHUD();
      },
      2000
    );


  // =========================================================
  // HOME SCREEN — CENTRAL WORLD
  // =========================================================

  const homeScreen =
    document.createElement(
      "div"
    );

  homeScreen.style.cssText = `
    position:fixed;
    inset:0;

    display:flex;
    align-items:center;
    justify-content:center;

    padding:24px;

    background:
      radial-gradient(
        circle at 50% 35%,
        rgba(16,57,83,0.78),
        rgba(3,9,17,0.96) 64%
      );

    color:white;

    font-family:
      Arial,
      sans-serif;

    z-index:500;
  `;

  homeScreen.innerHTML = `
    <div
      style="
        width:min(880px, 94vw);

        border:
          1px solid
          rgba(92,218,255,0.26);

        border-radius:20px;

        background:
          linear-gradient(
            180deg,
            rgba(7,17,30,0.96),
            rgba(5,12,23,0.96)
          );

        box-shadow:
          0 30px 90px
          rgba(0,0,0,0.45),
          0 0 60px
          rgba(0,160,255,0.08);

        overflow:hidden;
      "
    >
      <div
        style="
          padding:30px 30px 20px 30px;

          border-bottom:
            1px solid
            rgba(255,255,255,0.06);
        "
      >
        <div
          style="
            color:#84eaff;
            font-size:12px;
            font-weight:bold;
            letter-spacing:2px;
          "
        >
          MAP GAME
        </div>

        <div
          style="
            margin-top:7px;

            font-size:
              clamp(
                30px,
                5vw,
                54px
              );

            font-weight:900;

            letter-spacing:-1.5px;
          "
        >
          BUILD A CIVILIZATION.
        </div>

        <div
          style="
            margin-top:8px;
            max-width:650px;
            line-height:1.6;
            font-size:13px;
            opacity:0.64;
          "
        >
          Join the official shared world, build your territory,
          develop industry, and prepare for the future multiplayer
          economy, diplomacy, attack, and defense systems.
        </div>
      </div>

      <div
        style="
          padding:24px 30px 30px 30px;

          display:grid;
          grid-template-columns:
            minmax(0, 1.45fr)
            minmax(240px, 0.75fr);
          gap:16px;
        "
      >
        <div
          style="
            padding:20px;

            border:
              1px solid
              rgba(87,217,255,0.24);

            border-radius:14px;

            background:
              linear-gradient(
                145deg,
                rgba(23,112,164,0.15),
                rgba(255,255,255,0.025)
              );
          "
        >
          <div
            style="
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:12px;
            "
          >
            <div>
              <div
                style="
                  font-size:10px;
                  color:#82eaff;
                  letter-spacing:1px;
                  font-weight:bold;
                "
              >
                OFFICIAL WORLD
              </div>

              <div
                style="
                  margin-top:4px;
                  font-size:25px;
                  font-weight:850;
                "
              >
                Central World
              </div>
            </div>

            <div
              style="
                padding:6px 9px;

                border-radius:999px;

                background:
                  rgba(112,227,157,0.10);

                border:
                  1px solid
                  rgba(112,227,157,0.18);

                color:#8debae;

                font-size:10px;
                font-weight:bold;
              "
            >
              OPEN
            </div>
          </div>

          <div
            style="
              margin-top:14px;
              display:grid;
              grid-template-columns:
                repeat(3, 1fr);
              gap:8px;
            "
          >
            <div
              style="
                padding:9px;
                border-radius:8px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:8px;
                  opacity:0.45;
                "
              >
                RULESET
              </div>

              <b
                style="
                  font-size:11px;
                "
              >
                Official
              </b>
            </div>

            <div
              style="
                padding:9px;
                border-radius:8px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:8px;
                  opacity:0.45;
                "
              >
                MODS
              </div>

              <b
                style="
                  font-size:11px;
                "
              >
                Disabled
              </b>
            </div>

            <div
              style="
                padding:9px;
                border-radius:8px;
                background:
                  rgba(255,255,255,0.035);
              "
            >
              <div
                style="
                  font-size:8px;
                  opacity:0.45;
                "
              >
                ADMISSION
              </div>

              <b
                style="
                  font-size:11px;
                "
              >
                Performance-managed
              </b>
            </div>
          </div>

          <button
            id="joinCentralWorld"
            style="
              width:100%;

              margin-top:15px;

              padding:13px;

              border:
                1px solid
                rgba(99,226,255,0.40);

              border-radius:10px;

              background:
                linear-gradient(
                  180deg,
                  #208fcf,
                  #1168a7
                );

              color:white;

              font-size:13px;
              font-weight:850;

              cursor:pointer;

              box-shadow:
                0 7px 22px
                rgba(0,136,210,0.18);
            "
          >
            JOIN CENTRAL WORLD
          </button>
        </div>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px;
          "
        >
          <div
            style="
              padding:14px;

              border-radius:12px;

              background:
                rgba(255,255,255,0.025);

              border:
                1px solid
                rgba(255,255,255,0.06);
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:bold;
              "
            >
              PRIVATE WORLDS
            </div>

            <div
              style="
                margin-top:5px;
                font-size:10px;
                line-height:1.5;
                opacity:0.52;
              "
            >
              Planned limit:
              <b style="color:#8beaff;">
                ${PRIVATE_WORLD_LIMIT}
              </b>
              created worlds per account to reduce abandoned servers
              and unnecessary server load.
            </div>

            <button
              disabled

              style="
                width:100%;

                margin-top:10px;

                padding:9px;

                border:
                  1px solid
                  rgba(255,255,255,0.06);

                border-radius:8px;

                background:
                  rgba(255,255,255,0.03);

                color:
                  rgba(255,255,255,0.38);
              "
            >
              COMING LATER
            </button>
          </div>

          <div
            style="
              padding:14px;

              border-radius:12px;

              background:
                rgba(255,255,255,0.025);

              border:
                1px solid
                rgba(255,255,255,0.06);
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:bold;
              "
            >
              SINGLEPLAYER
            </div>

            <div
              style="
                margin-top:5px;
                font-size:10px;
                line-height:1.5;
                opacity:0.52;
              "
            >
              Custom rules, mods, custom buildings, and textures
              will live here later without affecting official Worlds.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(
    homeScreen
  );

  canvas.style.pointerEvents =
    "none";

  const joinCentralWorldButton =
    document.getElementById(
      "joinCentralWorld"
    );

  if (
    joinCentralWorldButton instanceof
    HTMLButtonElement
  ) {
    joinCentralWorldButton.onclick =
      () => {
        homeScreen.style.opacity =
          "0";

        homeScreen.style.transition =
          "opacity 0.18s ease";

        setTimeout(
          () => {
            homeScreen.style.display =
              "none";

            canvas.style.pointerEvents =
              "auto";

            canvas.focus();

            showToast(
              "Joined Central World",
              "success"
            );
          },
          190
        );
      };
  }

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
        sideDock.remove();
        inspector.remove();
        bottomBar.remove();
        toastHost.remove();
        shop.remove();
        touchControls.remove();
        buildActionControls.remove();
        homeScreen.remove();
      }
    );

  return scene;
};

// ============================================================
// START ENGINE
// ============================================================

const scene =
  createScene();

engine.runRenderLoop(
  () => {
    scene.render();
  }
);

const loadingScreen =
  document.getElementById(
    "loadingScreen"
  );

if (loadingScreen) {
  loadingScreen.remove();
}

window.addEventListener(
  "resize",
  () => {
    engine.resize();
  }
);
