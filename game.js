const canvas = document.getElementById("gameCanvas");

const engine = new BABYLON.Engine(
  canvas,
  true,
  {
    preserveDrawingBuffer: true,
    stencil: true
  }
);

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(
    0.68,
    0.82,
    0.93,
    1
  );

  // =========================================================
  // FOG
  // =========================================================

  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0028;
  scene.fogColor = new BABYLON.Color3(
    0.68,
    0.82,
    0.93
  );

  // =========================================================
  // CAMERA
  // =========================================================

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.0,
    120,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );

  camera.attachControl(canvas, true);

  camera.lowerRadiusLimit = 25;
  camera.upperRadiusLimit = 250;

  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = 1.35;

  camera.wheelPrecision = 35;
  camera.inertia = 0.82;
  camera.panningInertia = 0.85;

  // =========================================================
  // LIGHTING
  // =========================================================

  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );

  hemi.intensity = 0.55;

  const sun = new BABYLON.DirectionalLight(
    "sun",
    new BABYLON.Vector3(-0.45, -1, -0.35),
    scene
  );

  sun.position = new BABYLON.Vector3(
    120,
    180,
    80
  );

  sun.intensity = 1.1;

  // =========================================================
  // SHADOWS
  // =========================================================

  const shadowGenerator =
    new BABYLON.ShadowGenerator(
      1024,
      sun
    );

  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 16;

  // =========================================================
  // MATERIAL HELPERS
  // =========================================================

  function makeMat(
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
    makeMat(
      "grassMat",
      0.22,
      0.48,
      0.18
    );

  const grassAltMat =
    makeMat(
      "grassAltMat",
      0.28,
      0.55,
      0.22
    );

  const roadMat =
    makeMat(
      "roadMat",
      0.09,
      0.10,
      0.12
    );

  const concreteMat =
    makeMat(
      "concreteMat",
      0.55,
      0.60,
      0.64
    );

  const darkMat =
    makeMat(
      "darkMat",
      0.035,
      0.045,
      0.055
    );

  const mineMat =
    makeMat(
      "mineMat",
      0.20,
      0.22,
      0.25
    );

  const industrialMat =
    makeMat(
      "industrialMat",
      0.36,
      0.42,
      0.48
    );

  const powerMat =
    makeMat(
      "powerMat",
      0.50,
      0.40,
      0.12
    );

  const treeTrunkMat =
    makeMat(
      "treeTrunkMat",
      0.28,
      0.14,
      0.055
    );

  const treeLeafMat =
    makeMat(
      "treeLeafMat",
      0.10,
      0.34,
      0.11
    );

  const rockMat =
    makeMat(
      "rockMat",
      0.28,
      0.30,
      0.32
    );

  const glassMat =
    new BABYLON.StandardMaterial(
      "glassMat",
      scene
    );

  glassMat.diffuseColor =
    new BABYLON.Color3(
      0.14,
      0.45,
      0.68
    );

  glassMat.alpha = 0.62;
  glassMat.specularColor =
    new BABYLON.Color3(
      0.8,
      0.9,
      1.0
    );

  // =========================================================
  // TERRAIN
  // =========================================================

  const MAP_SIZE = 420;

  const ground =
    BABYLON.MeshBuilder.CreateGround(
      "ground",
      {
        width: MAP_SIZE,
        height: MAP_SIZE,
        subdivisions: 70
      },
      scene
    );

  ground.material = grassMat;
  ground.receiveShadows = true;

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

      const hill1 =
        Math.sin(x * 0.022) * 2.2;

      const hill2 =
        Math.cos(z * 0.018) * 2.0;

      const hill3 =
        Math.sin((x + z) * 0.012) * 1.4;

      let height =
        hill1 +
        hill2 +
        hill3;

      // keep city center flatter
      const centerDistance =
        Math.sqrt(
          x * x +
          z * z
        );

      if (centerDistance < 80) {
        height *= 0.18;
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

  const water =
    BABYLON.MeshBuilder.CreateGround(
      "river",
      {
        width: 260,
        height: 28,
        subdivisions: 1
      },
      scene
    );

  water.position =
    new BABYLON.Vector3(
      20,
      -0.2,
      105
    );

  water.rotation.y =
    Math.PI / 18;

  const waterMat =
    new BABYLON.StandardMaterial(
      "waterMat",
      scene
    );

  waterMat.diffuseColor =
    new BABYLON.Color3(
      0.08,
      0.34,
      0.55
    );

  waterMat.alpha = 0.82;
  waterMat.specularColor =
    new BABYLON.Color3(
      0.7,
      0.9,
      1.0
    );

  water.material = waterMat;

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
        0.08,
        z
      );

    road.rotation.y = rotation;
    road.material = roadMat;
    road.receiveShadows = true;

    return road;
  }

  createRoad(
    0,
    -20,
    12,
    210
  );

  createRoad(
    0,
    -18,
    190,
    12
  );

  createRoad(
    65,
    -55,
    10,
    110
  );

  createRoad(
    -72,
    -45,
    10,
    100
  );

  // road markings
  function createRoadLine(
    x,
    z,
    width,
    depth,
    rotation = 0
  ) {
    const line =
      BABYLON.MeshBuilder.CreateBox(
        "roadLine",
        {
          width,
          height: 0.03,
          depth
        },
        scene
      );

    line.position =
      new BABYLON.Vector3(
        x,
        0.16,
        z
      );

    line.rotation.y = rotation;

    const mat =
      makeMat(
        "lineMat" + Math.random(),
        0.85,
        0.80,
        0.35
      );

    line.material = mat;

    return line;
  }

  for (
    let z = -110;
    z <= 70;
    z += 14
  ) {
    createRoadLine(
      0,
      z,
      0.7,
      6
    );
  }

  // =========================================================
  // MODERN BUILDING CREATOR
  // =========================================================

  function createModernBuilding(
    x,
    z,
    w,
    h,
    d,
    glassAmount = 0.65
  ) {
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

    body.material = concreteMat;

    shadowGenerator.addShadowCaster(
      body
    );

    const glassFront =
      BABYLON.MeshBuilder.CreateBox(
        "glassFront",
        {
          width:
            w * glassAmount,
          height:
            h * 0.58,
          depth: 0.3
        },
        scene
      );

    glassFront.position =
      new BABYLON.Vector3(
        x,
        h * 0.52,
        z - d / 2 - 0.16
      );

    glassFront.material = glassMat;

    const top =
      BABYLON.MeshBuilder.CreateBox(
        "buildingTop",
        {
          width: w + 0.8,
          height: 0.7,
          depth: d + 0.8
        },
        scene
      );

    top.position =
      new BABYLON.Vector3(
        x,
        h + 0.35,
        z
      );

    top.material = darkMat;

    const sideStrip =
      BABYLON.MeshBuilder.CreateBox(
        "sideStrip",
        {
          width: 0.8,
          height: h,
          depth: d + 0.2
        },
        scene
      );

    sideStrip.position =
      new BABYLON.Vector3(
        x - w / 2 + 0.4,
        h / 2,
        z
      );

    sideStrip.material = darkMat;

    return body;
  }

  // =========================================================
  // CITY CENTER
  // =========================================================

  const townHall =
    createModernBuilding(
      0,
      -30,
      18,
      10,
      16,
      0.75
    );

  const tower =
    createModernBuilding(
      25,
      -34,
      10,
      18,
      10,
      0.78
    );

  createModernBuilding(
    -24,
    -34,
    11,
    12,
    11,
    0.7
  );

  createModernBuilding(
    25,
    -12,
    11,
    11,
    11,
    0.66
  );

  createModernBuilding(
    -24,
    -12,
    10,
    9,
    10,
    0.66
  );

  // =========================================================
  // RESIDENTIAL
  // =========================================================

  const housePositions = [
    [-42, 15],
    [-25, 15],
    [-8, 15],
    [12, 15],
    [30, 15],

    [-42, 33],
    [-25, 33],
    [-8, 33],
    [12, 33],
    [30, 33]
  ];

  housePositions.forEach(
    ([x, z]) => {
      createModernBuilding(
        x,
        z,
        9,
        6,
        9,
        0.58
      );
    }
  );

  // =========================================================
  // IRON MINE
  // =========================================================

  const mineBase =
    BABYLON.MeshBuilder.CreateBox(
      "mineBase",
      {
        width: 18,
        height: 5,
        depth: 16
      },
      scene
    );

  mineBase.position =
    new BABYLON.Vector3(
      -78,
      2.5,
      -64
    );

  mineBase.material = mineMat;

  shadowGenerator.addShadowCaster(
    mineBase
  );

  const mineTower =
    BABYLON.MeshBuilder.CreateCylinder(
      "mineTower",
      {
        diameter: 8,
        height: 12,
        tessellation: 8
      },
      scene
    );

  mineTower.position =
    new BABYLON.Vector3(
      -78,
      8,
      -64
    );

  mineTower.material = darkMat;

  shadowGenerator.addShadowCaster(
    mineTower
  );

  // =========================================================
  // STEEL MILL
  // =========================================================

  const steelMill =
    BABYLON.MeshBuilder.CreateBox(
      "steelMill",
      {
        width: 24,
        height: 8,
        depth: 18
      },
      scene
    );

  steelMill.position =
    new BABYLON.Vector3(
      76,
      4,
      -62
    );

  steelMill.material =
    industrialMat;

  shadowGenerator.addShadowCaster(
    steelMill
  );

  for (
    let i = 0;
    i < 3;
    i++
  ) {
    const chimney =
      BABYLON.MeshBuilder.CreateCylinder(
        "chimney" + i,
        {
          diameter: 3,
          height: 18,
          tessellation: 16
        },
        scene
      );

    chimney.position =
      new BABYLON.Vector3(
        68 + i * 7,
        10,
        -66
      );

    chimney.material = darkMat;

    shadowGenerator.addShadowCaster(
      chimney
    );
  }

  // =========================================================
  // POWER PLANT
  // =========================================================

  const powerPlant =
    BABYLON.MeshBuilder.CreateBox(
      "powerPlant",
      {
        width: 22,
        height: 8,
        depth: 18
      },
      scene
    );

  powerPlant.position =
    new BABYLON.Vector3(
      -74,
      4,
      62
    );

  powerPlant.material = powerMat;

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
          diameterTop: 7,
          diameterBottom: 10,
          height: 16,
          tessellation: 20
        },
        scene
      );

    coolingTower.position =
      new BABYLON.Vector3(
        -80 + i * 13,
        10,
        62
      );

    coolingTower.material =
      concreteMat;

    shadowGenerator.addShadowCaster(
      coolingTower
    );
  }

  // =========================================================
  // TREES
  // =========================================================

  function createTree(
    x,
    z,
    scale = 1
  ) {
    const trunk =
      BABYLON.MeshBuilder.CreateCylinder(
        "treeTrunk",
        {
          diameter:
            0.9 * scale,
          height:
            4 * scale,
          tessellation: 8
        },
        scene
      );

    trunk.position =
      new BABYLON.Vector3(
        x,
        2 * scale,
        z
      );

    trunk.material =
      treeTrunkMat;

    const crown =
      BABYLON.MeshBuilder.CreateSphere(
        "treeCrown",
        {
          diameter:
            5.5 * scale,
          segments: 8
        },
        scene
      );

    crown.position =
      new BABYLON.Vector3(
        x,
        5 * scale,
        z
      );

    crown.material =
      treeLeafMat;
  }

  for (
    let i = 0;
    i < 70;
    i++
  ) {
    const x =
      Math.random() * 340 -
      170;

    const z =
      Math.random() * 340 -
      170;

    const cityDist =
      Math.sqrt(
        x * x +
        z * z
      );

    if (
      cityDist > 85 &&
      Math.abs(z - 105) > 20
    ) {
      createTree(
        x,
        z,
        0.8 +
        Math.random() * 0.6
      );
    }
  }

  // =========================================================
  // ROCKS
  // =========================================================

  for (
    let i = 0;
    i < 28;
    i++
  ) {
    const rock =
      BABYLON.MeshBuilder.CreateSphere(
        "rock",
        {
          diameter:
            2 +
            Math.random() * 3,
          segments: 6
        },
        scene
      );

    rock.scaling.y =
      0.5 +
      Math.random() * 0.4;

    rock.position =
      new BABYLON.Vector3(
        Math.random() * 360 - 180,
        1,
        Math.random() * 360 - 180
      );

    rock.material = rockMat;
  }

  // =========================================================
  // GAME STATE
  // =========================================================

  let money = 15000;
  let iron = 20;
  let steel = 10;
  let energy = 100;
  let population = 1200;

  const SAVE_KEY =
    "mapGameVisualBuild1";

  // =========================================================
  // TOP HUD
  // =========================================================

  const topBar =
    document.createElement(
      "div"
    );

  topBar.style.cssText = `
    position:absolute;
    left:0;
    right:0;
    top:0;

    height:62px;

    background:
      linear-gradient(
        180deg,
        rgba(5,10,18,0.98),
        rgba(7,16,28,0.92)
      );

    border-bottom:
      1px solid
      rgba(80,220,255,0.35);

    box-shadow:
      0 4px 20px
      rgba(0,0,0,0.35);

    display:flex;
    align-items:center;
    justify-content:space-between;

    padding:
      0 20px;

    color:white;

    font-family:
      Arial,
      sans-serif;

    z-index:50;
  `;

  document.body.appendChild(
    topBar
  );

  const title =
    document.createElement(
      "div"
    );

  title.innerHTML = `
    <div
      style="
        font-size:18px;
        font-weight:700;
        letter-spacing:1px;
        color:#8be8ff;
      "
    >
      MAP GAME
    </div>

    <div
      style="
        font-size:10px;
        opacity:0.5;
        margin-top:2px;
      "
    >
      ALPHA 0.0.4 — VISUAL FOUNDATION
    </div>
  `;

  topBar.appendChild(title);

  const resources =
    document.createElement(
      "div"
    );

  resources.style.cssText = `
    display:flex;
    gap:20px;
    align-items:center;

    font-size:14px;
    font-weight:600;
  `;

  topBar.appendChild(
    resources
  );

  function updateHUD() {
    resources.innerHTML = `
      <span>
        💰
        $${Math.floor(
          money
        ).toLocaleString()}
      </span>

      <span>
        ⛏️
        ${Math.floor(
          iron
        )}
      </span>

      <span>
        🏗️
        ${Math.floor(
          steel
        )}
      </span>

      <span>
        ⚡
        ${Math.floor(
          energy
        )}
      </span>

      <span>
        👥
        ${population.toLocaleString()}
      </span>
    `;
  }

  updateHUD();

  // =========================================================
  // LEFT UI
  // =========================================================

  const sideBar =
    document.createElement(
      "div"
    );

  sideBar.style.cssText = `
    position:absolute;

    left:14px;
    top:80px;

    width:56px;

    padding:8px;

    display:flex;
    flex-direction:column;
    gap:8px;

    background:
      rgba(6,13,23,0.92);

    border:
      1px solid
      rgba(80,210,255,0.25);

    border-radius:10px;

    z-index:45;
  `;

  document.body.appendChild(
    sideBar
  );

  function createSideButton(
    text,
    label
  ) {
    const btn =
      document.createElement(
        "button"
      );

    btn.innerHTML = text;
    btn.title = label;

    btn.style.cssText = `
      width:40px;
      height:40px;

      border:
        1px solid
        rgba(255,255,255,0.09);

      border-radius:7px;

      background:
        rgba(255,255,255,0.04);

      color:white;

      font-size:18px;

      cursor:pointer;
    `;

    btn.onmouseenter =
      () => {
        btn.style.background =
          "rgba(40,170,255,0.18)";
      };

    btn.onmouseleave =
      () => {
        btn.style.background =
          "rgba(255,255,255,0.04)";
      };

    sideBar.appendChild(btn);

    return btn;
  }

  const buildButton =
    createSideButton(
      "🏗️",
      "Construction"
    );

  createSideButton(
    "🌍",
    "World"
  );

  createSideButton(
    "📊",
    "Economy"
  );

  createSideButton(
    "⚙️",
    "Settings"
  );

  // =========================================================
  // TECHY CONSTRUCTION PANEL
  // =========================================================

  const shop =
    document.createElement(
      "div"
    );

  shop.style.cssText = `
    position:absolute;

    left:82px;
    top:80px;

    width:390px;

    max-height:
      calc(100vh - 110px);

    overflow-y:auto;

    padding:18px;

    background:
      linear-gradient(
        180deg,
        rgba(7,15,27,0.98),
        rgba(8,19,32,0.96)
      );

    border:
      1px solid
      rgba(70,215,255,0.5);

    border-radius:14px;

    box-shadow:
      0 0 30px
      rgba(0,160,255,0.15);

    color:white;

    font-family:
      Arial,
      sans-serif;

    display:none;

    z-index:44;
  `;

  document.body.appendChild(
    shop
  );

  function createShopCard(
    title,
    category,
    cost,
    description,
    accent
  ) {
    return `
      <div
        style="
          padding:13px;

          margin-bottom:10px;

          background:
            rgba(
              255,
              255,
              255,
              0.035
            );

          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );

          border-radius:9px;
        "
      >

        <div
          style="
            color:${accent};
            font-size:16px;
            font-weight:bold;
          "
        >
          ${title}
        </div>

        <div
          style="
            margin-top:3px;
            font-size:10px;
            opacity:0.45;
          "
        >
          ${category}
        </div>

        <div
          style="
            margin-top:9px;
            font-size:12px;
            line-height:1.5;
            opacity:0.8;
          "
        >
          ${description}
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
            $${cost.toLocaleString()}
          </b>

          <button
            style="
              padding:
                7px 13px;

              border:
                1px solid
                rgba(
                  100,
                  220,
                  255,
                  0.4
                );

              border-radius:6px;

              background:
                rgba(
                  20,
                  130,
                  200,
                  0.8
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

  function updateShop() {
    shop.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:
            space-between;
          align-items:center;
          margin-bottom:14px;
        "
      >

        <div>
          <div
            style="
              color:#83e8ff;
              font-size:21px;
              font-weight:bold;
            "
          >
            CONSTRUCTION NETWORK
          </div>

          <div
            style="
              font-size:10px;
              opacity:0.45;
              margin-top:2px;
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
        style="
          display:flex;
          gap:6px;
          margin-bottom:14px;
        "
      >
        <span
          style="
            padding:5px 9px;
            background:
              rgba(
                60,
                180,
                255,
                0.13
              );
            border-radius:5px;
            font-size:10px;
          "
        >
          INDUSTRY
        </span>

        <span
          style="
            padding:5px 9px;
            background:
              rgba(
                255,
                255,
                255,
                0.04
              );
            border-radius:5px;
            font-size:10px;
          "
        >
          CIVIL
        </span>

        <span
          style="
            padding:5px 9px;
            background:
              rgba(
                255,
                255,
                255,
                0.04
              );
            border-radius:5px;
            font-size:10px;
          "
        >
          POWER
        </span>
      </div>

      ${createShopCard(
        "Iron Mine",
        "RESOURCE EXTRACTION",
        750,
        "Extracts iron ore for industrial production.",
        "#b9c6cf"
      )}

      ${createShopCard(
        "Steel Mill",
        "HEAVY INDUSTRY",
        1200,
        "Converts iron into steel for advanced construction.",
        "#8fb9d6"
      )}

      ${createShopCard(
        "Power Plant",
        "ENERGY",
        950,
        "Generates energy for mines and industrial buildings.",
        "#ffd768"
      )}

      ${createShopCard(
        "Residential Block",
        "CIVIL",
        500,
        "Expands population capacity and future tax income.",
        "#9cecc0"
      )}
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
  }

  buildButton.onclick = () => {
    const isOpen =
      shop.style.display ===
      "block";

    shop.style.display =
      isOpen
        ? "none"
        : "block";

    if (!isOpen) {
      updateShop();
    }
  };

  // =========================================================
  // SAVE + OFFLINE MONEY
  // =========================================================

  function saveGame() {
    const data = {
      money,
      iron,
      steel,
      energy,
      population,
      lastSaved: Date.now()
    };

    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(data)
    );
  }

  function loadGame() {
    const raw =
      localStorage.getItem(
        SAVE_KEY
      );

    if (!raw) return;

    try {
      const data =
        JSON.parse(raw);

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

      money +=
        secondsAway *
        2;
    } catch {
      console.log(
        "Could not load save."
      );
    }
  }

  // =========================================================
  // PASSIVE PRODUCTION
  // =========================================================

  const productionTimer =
    setInterval(
      () => {
        energy += 8;

        if (energy >= 1) {
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
  // CAMERA MOVEMENT
  // =========================================================

  const keys = {};

  window.addEventListener(
    "keydown",
    (event) => {
      keys[
        event.key.toLowerCase()
      ] = true;
    }
  );

  window.addEventListener(
    "keyup",
    (event) => {
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
          0.55 *
          (
            camera.radius /
            100
          );

        if (
          keys["w"] ||
          keys["arrowup"]
        ) {
          camera.target.z +=
            speed;
        }

        if (
          keys["s"] ||
          keys["arrowdown"]
        ) {
          camera.target.z -=
            speed;
        }

        if (
          keys["a"] ||
          keys["arrowleft"]
        ) {
          camera.target.x -=
            speed;
        }

        if (
          keys["d"] ||
          keys["arrowright"]
        ) {
          camera.target.x +=
            speed;
        }

        camera.target.x =
          BABYLON.Scalar.Clamp(
            camera.target.x,
            -185,
            185
          );

        camera.target.z =
          BABYLON.Scalar.Clamp(
            camera.target.z,
            -185,
            185
          );
      }
    );

  // =========================================================
  // START / CLEANUP
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
        shop.remove();
      }
    );

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener(
  "resize",
  () => {
    engine.resize();
  }
);