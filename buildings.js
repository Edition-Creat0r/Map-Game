// ============================================================
// MAP GAME — buildings.js
// Alpha 0.2.1E
// Shared building catalog + neutral-city neighborhood renderers.
//
// Design rule:
// gameplay identity is separate from visual model/style.
// ============================================================

(() => {
  "use strict";

  const CATALOG = [
    {
      id: "smallHouse",
      category: "Residential",
      icon: "⌂",
      name: "Single-Family Home",
      description: "Low-density housing for suburban neighborhoods.",
      cost: { money: 42000, concrete: 45, glass: 16 },
      incomePerMin: 18,
      population: 4,
      powerUse: 1,
      waterUse: 1,
      pollution: 0,
      footprint: [18, 22],
      variants: ["Contemporary", "Craftsman", "Stucco", "Town", "Future"]
    },
    {
      id: "townhomes",
      category: "Residential",
      icon: "▥",
      name: "Townhome Row",
      description: "Compact attached homes that add population without requiring a tower.",
      cost: { money: 110000, concrete: 120, glass: 45, steel: 25 },
      incomePerMin: 48,
      population: 28,
      powerUse: 3,
      waterUse: 3,
      pollution: 0,
      footprint: [46, 24],
      variants: ["Modern", "Brick", "Bay Area", "Garden", "Future"]
    },
    {
      id: "apartmentLow",
      category: "Residential",
      icon: "▤",
      name: "Courtyard Apartments",
      description: "A realistic medium-density apartment complex with a landscaped courtyard.",
      cost: { money: 260000, concrete: 260, glass: 120, steel: 80 },
      incomePerMin: 120,
      population: 130,
      powerUse: 8,
      waterUse: 10,
      pollution: 0,
      footprint: [66, 58],
      variants: ["Modern", "Stucco", "Brick", "Urban", "Future"]
    },
    {
      id: "apartmentTower",
      category: "Residential",
      icon: "▥",
      name: "Apartment Tower",
      description: "High-density housing for developed city centers.",
      cost: { money: 680000, concrete: 560, glass: 420, steel: 310 },
      incomePerMin: 270,
      population: 420,
      powerUse: 18,
      waterUse: 22,
      pollution: 0,
      footprint: [46, 46],
      variants: ["Glass", "Concrete", "Balcony", "Luxury", "Future"]
    },
    {
      id: "cornerStore",
      category: "Commercial",
      icon: "▱",
      name: "Corner Store",
      description: "Small neighborhood retail with reliable but modest income.",
      cost: { money: 58000, concrete: 50, glass: 25 },
      incomePerMin: 30,
      powerUse: 2,
      waterUse: 1,
      pollution: 0,
      footprint: [24, 20],
      variants: ["Modern", "Classic", "Brick", "Market", "Future"]
    },
    {
      id: "cafe",
      category: "Commercial",
      icon: "◫",
      name: "Cafe",
      description: "A small destination business that earns money and improves future district appeal.",
      cost: { money: 82000, concrete: 55, glass: 40 },
      incomePerMin: 44,
      powerUse: 3,
      waterUse: 2,
      pollution: 0,
      footprint: [26, 22],
      variants: ["Glass", "Warm", "Industrial", "Garden", "Future"]
    },
    {
      id: "retailStrip",
      category: "Commercial",
      icon: "▰",
      name: "Retail Row",
      description: "Several shops in a single connected commercial building.",
      cost: { money: 240000, concrete: 190, glass: 130, steel: 70 },
      incomePerMin: 135,
      powerUse: 7,
      waterUse: 4,
      pollution: 0,
      footprint: [74, 30],
      variants: ["Modern", "Bay Area", "Brick", "Lifestyle", "Future"]
    },
    {
      id: "grocery",
      category: "Commercial",
      icon: "▭",
      name: "Neighborhood Market",
      description: "A larger store serving residential districts and generating steady revenue.",
      cost: { money: 360000, concrete: 300, glass: 110, steel: 110 },
      incomePerMin: 180,
      powerUse: 10,
      waterUse: 8,
      pollution: 0,
      footprint: [82, 58],
      variants: ["Modern", "Urban", "Warehouse", "Natural", "Future"]
    },
    {
      id: "officeLow",
      category: "Commercial",
      icon: "▦",
      name: "Office Campus",
      description: "Low-rise office buildings suited to a suburban technology corridor.",
      cost: { money: 520000, concrete: 360, glass: 300, steel: 190 },
      incomePerMin: 250,
      powerUse: 16,
      waterUse: 7,
      pollution: 0,
      footprint: [86, 72],
      variants: ["Tech", "Glass", "Campus", "Classic", "Future"]
    },
    {
      id: "officeTower",
      category: "Commercial",
      icon: "▥",
      name: "Office Tower",
      description: "High-value commercial office space for a developed downtown.",
      cost: { money: 980000, concrete: 690, glass: 720, steel: 520 },
      incomePerMin: 460,
      powerUse: 28,
      waterUse: 10,
      pollution: 0,
      footprint: [50, 50],
      variants: ["Modern", "Glass", "Art Deco", "Classic", "Future"]
    },
    {
      id: "hotel",
      category: "Commercial",
      icon: "▧",
      name: "Hotel",
      description: "Tourism and business lodging with high operating revenue.",
      cost: { money: 1250000, concrete: 850, glass: 650, steel: 460 },
      incomePerMin: 560,
      powerUse: 32,
      waterUse: 26,
      pollution: 0,
      footprint: [60, 62],
      variants: ["Business", "Luxury", "Resort", "Urban", "Future"]
    },
    {
      id: "mall",
      category: "Commercial",
      icon: "▣",
      name: "Lifestyle Center",
      description: "Large shopping and dining complex. Expensive, but a major revenue generator.",
      cost: { money: 2400000, concrete: 1500, glass: 750, steel: 820 },
      incomePerMin: 980,
      powerUse: 58,
      waterUse: 34,
      pollution: 1,
      footprint: [132, 110],
      variants: ["Open Air", "Glass", "Urban", "Classic", "Future"]
    },
    {
      id: "warehouse",
      category: "Industrial",
      icon: "▱",
      name: "Warehouse",
      description: "Logistics building that supports future industrial supply chains.",
      cost: { money: 290000, concrete: 320, steel: 150 },
      incomePerMin: 95,
      powerUse: 12,
      waterUse: 3,
      pollution: 8,
      footprint: [92, 62],
      variants: ["Logistics", "Clean", "Heavy", "Carbon", "Future"]
    },
    {
      id: "steelMill",
      category: "Industrial",
      icon: "⚙",
      name: "Steel Mill",
      description: "Processes iron into steel. Later versions require road and power access.",
      cost: { money: 950000, iron: 900, concrete: 600, steel: 120 },
      incomePerMin: 180,
      powerUse: 42,
      waterUse: 16,
      pollution: 28,
      footprint: [118, 92],
      variants: ["Industrial", "Modern", "Carbon", "Heavy", "Future"],
      produces: ["Steel"]
    },
    {
      id: "carbonPlant",
      category: "Industrial",
      icon: "⬢",
      name: "Carbon Works",
      description: "Advanced materials plant for later technology and aerospace progression.",
      cost: { money: 1850000, steel: 900, concrete: 1100 },
      incomePerMin: 330,
      powerUse: 54,
      waterUse: 18,
      pollution: 18,
      footprint: [126, 96],
      variants: ["Industrial", "Clean", "Carbon", "Research", "Future"],
      produces: ["Carbon"]
    },
    {
      id: "powerPlant",
      category: "Infrastructure",
      icon: "⚡",
      name: "Power Plant",
      description: "Major power infrastructure. Its main value is future electricity capacity.",
      cost: { money: 900000, steel: 750, concrete: 900 },
      incomePerMin: 0,
      powerUse: 2,
      waterUse: 8,
      pollution: 16,
      powerSupply: 160,
      footprint: [122, 104],
      variants: ["Utility", "Modern", "Clean", "Carbon", "Future"],
      produces: ["Electricity"]
    },
    {
      id: "solarFarm",
      category: "Infrastructure",
      icon: "☀",
      name: "Solar Farm",
      description: "Clean starter electricity. Low pollution, but it occupies a large site.",
      cost: { money: 145000, steel: 45, glass: 35, concrete: 35 },
      incomePerMin: 0,
      powerUse: 0,
      waterUse: 0,
      pollution: 0,
      powerSupply: 65,
      footprint: [88, 62],
      variants: ["Standard", "Dense", "Landscape", "Tech", "Future"]
    },
    {
      id: "waterPlant",
      category: "Infrastructure",
      icon: "◒",
      name: "Water Treatment Plant",
      description: "Provides treated water capacity to homes, shops and industry.",
      cost: { money: 175000, steel: 55, concrete: 110 },
      incomePerMin: 0,
      powerUse: 8,
      waterUse: 0,
      pollution: 2,
      waterSupply: 85,
      footprint: [78, 64],
      variants: ["Utility", "Modern", "Compact", "Green", "Future"]
    },
    {
      id: "airQualityCenter",
      category: "Infrastructure",
      icon: "◌",
      name: "Air Quality Center",
      description: "Filters industrial emissions and expands clean-air capacity.",
      cost: { money: 210000, steel: 70, glass: 20, concrete: 95 },
      incomePerMin: 0,
      powerUse: 14,
      waterUse: 3,
      pollution: -18,
      cleanAirSupply: 45,
      footprint: [66, 56],
      variants: ["Civic", "Green", "Industrial", "Research", "Future"]
    },
    {
      id: "governmentHall",
      category: "Government",
      icon: "◇",
      name: "Government Hall",
      description: "Administrative center for laws, services and future government systems.",
      cost: { money: 750000, steel: 600, glass: 400, concrete: 1000 },
      incomePerMin: 0,
      powerUse: 8,
      waterUse: 6,
      pollution: 0,
      footprint: [86, 72],
      variants: ["Civic", "Modern", "Classical", "Monumental", "Future"]
    },
    {
      id: "trainingCamp",
      category: "Government",
      icon: "△",
      name: "Training Campus",
      description: "Future military and emergency-services training complex.",
      cost: { money: 680000, steel: 280, concrete: 720 },
      incomePerMin: 0,
      powerUse: 10,
      waterUse: 8,
      pollution: 1,
      footprint: [130, 110],
      variants: ["Standard", "Urban", "Field", "Secure", "Future"]
    },
    {
      id: "cityPark",
      category: "Parks",
      icon: "✦",
      name: "City Park",
      description: "Landscaped public space for recreation, city appeal and future tourism.",
      cost: { money: 90000, concrete: 80 },
      incomePerMin: 0,
      powerUse: 2,
      waterUse: 6,
      pollution: -8,
      cleanAirSupply: 18,
      footprint: [86, 76],
      variants: ["Urban", "Natural", "Formal", "Waterfront", "Future"]
    },
    {
      id: "amusementPark",
      category: "Parks",
      icon: "◉",
      name: "Amusement Park",
      description: "Large recreation destination with future tourism and ticket revenue.",
      cost: { money: 2800000, steel: 1100, concrete: 1300 },
      incomePerMin: 720,
      powerUse: 46,
      waterUse: 30,
      pollution: 3,
      footprint: [190, 170],
      variants: ["Classic", "Boardwalk", "Adventure", "Modern", "Future"]
    }
  ];

  function item(id) {
    return CATALOG.find(v => v.id === id) || CATALOG[0];
  }

  function createMaterials(B, scene, regular, preset = null, category = "General") {
    const graphics =
      preset ||
      (regular ? "REGULAR" : "BASIC");

    if (window.mapGameMaterials?.createBuildingPalette) {
      const palette =
        window.mapGameMaterials.createBuildingPalette(
          scene,
          graphics,
          category
        );
      palette.__regular =
        graphics === "REGULAR" || graphics === "DEEP";
      return palette;
    }

    const mat = (name, color, spec = 0.1) => {
      const m = new B.StandardMaterial(name, scene);
      m.diffuseColor = B.Color3.FromHexString(color);
      m.specularColor = new B.Color3(spec, spec, spec);
      m.specularPower = regular ? 72 : 28;
      return m;
    };

    const wall = mat("mgNeighborhoodWall", "#c7c2b7", 0.10);
    const wall2 = mat("mgNeighborhoodWall2", "#8a9397", 0.12);
    const roof = mat("mgNeighborhoodRoof", "#303942", 0.08);
    const dark = mat("mgNeighborhoodDark", "#18242c", 0.18);
    const storefront = mat("mgNeighborhoodStorefront", "#1b5369", 0.35);
    storefront.alpha = regular ? 0.78 : 0.92;
    const warm = mat("mgNeighborhoodWarm", "#d7c5a5", 0.08);
    const accent = mat("mgNeighborhoodAccent", "#6d7f83", 0.12);

    return {
      wall,
      wall2,
      roof,
      dark,
      storefront,
      warm,
      accent,
      pavement: accent
    };
  }

  function addFoundation(B, scene, root, w, d, material, depth = 2.6) {
    const f = B.MeshBuilder.CreateBox("buildingFoundation", {
      width: w * 1.04,
      height: depth,
      depth: d * 1.04
    }, scene);
    // Intentionally sunk into terrain so buildings do not hover on small slopes.
    f.position.y = -depth * 0.34;
    f.material = material;
    f.parent = root;
    f.receiveShadows = true;
    f.isPickable = false;
    return f;
  }

  function seededVariation(seed, salt = 0) {
    const n = Math.sin((seed + 1) * 91.733 + salt * 43.17) * 43758.5453;
    return n - Math.floor(n);
  }

  function addRegularHouseDetails(B, scene, node, w, d, mats, variant) {
    // Porch / entry canopy
    const porch =
      B.MeshBuilder.CreateBox(
        "housePorch",
        {
          width: w * 0.42,
          height: 0.38,
          depth: 3.8
        },
        scene
      );
    porch.position.set(-w * 0.15, 0.28, -d / 2 - 1.6);
    porch.material = mats.pavement || mats.accent;
    porch.parent = node;

    const canopy =
      B.MeshBuilder.CreateBox(
        "houseEntryCanopy",
        {
          width: w * 0.32,
          height: 0.28,
          depth: 2.6
        },
        scene
      );
    canopy.position.set(-w * 0.18, 5.3, -d / 2 - 1.0);
    canopy.material = mats.roof;
    canopy.parent = node;

    // Chimney or roof vent moves between variants.
    const chimney =
      B.MeshBuilder.CreateBox(
        "houseChimney",
        {
          width: 1.5,
          height: 4.0,
          depth: 1.5
        },
        scene
      );
    chimney.position.set(
      variant % 2 ? -w * 0.28 : w * 0.25,
      10.1,
      variant % 3 === 0 ? 2.0 : -1.2
    );
    chimney.material = mats.dark;
    chimney.parent = node;

    // Two smaller windows break the "one blue rectangle" look.
    for (let i = 0; i < 2; i++) {
      const sideWindow =
        B.MeshBuilder.CreateBox(
          "houseDetailWindow",
          {
            width: 2.3,
            height: 1.7,
            depth: 0.13
          },
          scene
        );
      sideWindow.position.set(
        -w * 0.24 + i * w * 0.46,
        5.0,
        -d / 2 - 0.13
      );
      sideWindow.material = mats.storefront;
      sideWindow.parent = node;
    }
  }

  function addTowerSetbacks(B, scene, root, w, h, d, mats, variant) {
    const podium =
      B.MeshBuilder.CreateBox(
        "towerPodium",
        {
          width: w * 1.16,
          height: 7.2,
          depth: d * 1.16
        },
        scene
      );
    podium.position.y = 3.2;
    podium.material = variant % 2 ? mats.warm : mats.wall;
    podium.parent = root;

    const crown =
      B.MeshBuilder.CreateBox(
        "towerCrown",
        {
          width: w * 0.64,
          height: 4.6,
          depth: d * 0.60
        },
        scene
      );
    crown.position.y = h + 2.3;
    crown.material = mats.dark;
    crown.parent = root;

    // Offset mechanical volume creates controlled asymmetry.
    const mech =
      B.MeshBuilder.CreateBox(
        "towerMechanicalPenthouse",
        {
          width: w * 0.24,
          height: 5.2,
          depth: d * 0.28
        },
        scene
      );
    mech.position.set(
      variant % 2 ? w * 0.24 : -w * 0.22,
      h + 6.8,
      variant % 3 === 0 ? d * 0.12 : -d * 0.10
    );
    mech.material = mats.dark;
    mech.parent = root;
  }

  function house(B, scene, root, x, z, rot, mats, variant = 0) {
    const node = new B.TransformNode("cityHouse", scene);
    node.parent = root;
    node.position.set(x, 0, z);
    node.rotation.y = rot || 0;

    const w = 15 + (variant % 3) * 2.5;
    const d = 20 + ((variant + 1) % 3) * 2;
    addFoundation(B, scene, node, w, d, mats.dark, 2.4);

    const body = B.MeshBuilder.CreateBox("houseBody", {
      width: w,
      height: 7.5,
      depth: d
    }, scene);
    body.position.y = 3.4;
    body.material = variant % 2 ? mats.warm : mats.wall;
    body.parent = node;

    const roof = B.MeshBuilder.CreateCylinder("houseRoof", {
      diameter: 1,
      height: d + 1.4,
      tessellation: 4
    }, scene);
    roof.scaling.set(w * 0.78, 1, 5.2);
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 8.5;
    roof.material = mats.roof;
    roof.parent = node;

    const garage = B.MeshBuilder.CreateBox("garageDoor", {
      width: w * 0.42,
      height: 3.0,
      depth: 0.18
    }, scene);
    garage.position.set(w * 0.22, 2.0, -d / 2 - 0.10);
    garage.material = mats.accent;
    garage.parent = node;

    const window = B.MeshBuilder.CreateBox("houseWindow", {
      width: w * 0.28,
      height: 2.0,
      depth: 0.16
    }, scene);
    window.position.set(-w * 0.22, 4.2, -d / 2 - 0.12);
    window.material = mats.storefront;
    window.parent = node;

    if (mats.__regular || node.getScene()?.metadata?.mapGameRegularPreview) {
      addRegularHouseDetails(B, scene, node, w, d, mats, variant);
    }

    return node;
  }

  function apartment(B, scene, root, x, z, w, h, d, mats, variant = 0) {
    const node = new B.TransformNode("cityApartment", scene);
    node.parent = root;
    node.position.set(x, 0, z);

    addFoundation(B, scene, node, w, d, mats.dark, 3.2);

    const body = B.MeshBuilder.CreateBox("apartmentBody", { width:w, height:h, depth:d }, scene);
    body.position.y = h / 2 - 0.5;
    body.material = variant % 2 ? mats.wall2 : mats.warm;
    body.parent = node;

    const floors = Math.max(3, Math.floor(h / 4.2));
    for (let f = 1; f < floors; f++) {
      const band = B.MeshBuilder.CreateBox("apartmentBand", {
        width: w + 0.18,
        height: 0.24,
        depth: d + 0.18
      }, scene);
      band.position.y = f * 4.2;
      band.material = mats.dark;
      band.parent = node;
    }

    for (let i = -2; i <= 2; i++) {
      const win = B.MeshBuilder.CreateBox("apartmentWindows", {
        width: Math.max(2.3, w / 7.2),
        height: h * 0.72,
        depth: 0.12
      }, scene);
      win.position.set(i * w / 5.8, h * 0.51, -d/2 - 0.08);
      win.material = mats.storefront;
      win.parent = node;
    }

    if (mats.__regular) {
      const balconyRows = Math.max(2, Math.floor(h / 11));
      for (let r = 0; r < balconyRows; r++) {
        const balcony =
          B.MeshBuilder.CreateBox(
            "apartmentBalcony",
            {
              width: w * 0.72,
              height: 0.28,
              depth: 2.4
            },
            scene
          );
        balcony.position.set(
          variant % 2 ? w * 0.04 : -w * 0.04,
          7 + r * 8.2,
          d / 2 + 1.0
        );
        balcony.material = mats.dark;
        balcony.parent = node;
      }

      for (const side of [-1, 1]) {
        const sideGlass =
          B.MeshBuilder.CreateBox(
            "apartmentSideGlass",
            {
              width: 0.13,
              height: h * 0.58,
              depth: d * 0.38
            },
            scene
          );
        sideGlass.position.set(
          side * (w / 2 + 0.08),
          h * 0.55,
          variant % 2 ? d * 0.12 : -d * 0.08
        );
        sideGlass.material = mats.storefront;
        sideGlass.parent = node;
      }
    }

    const roof = B.MeshBuilder.CreateBox("apartmentRoof", {
      width:w * .72, height:1.8, depth:d * .64
    }, scene);
    roof.position.y = h + 0.4;
    roof.material = mats.dark;
    roof.parent = node;

    return node;
  }

  function retail(B, scene, root, x, z, w, d, mats, variant = 0) {
    const node = new B.TransformNode("cityRetail", scene);
    node.parent = root;
    node.position.set(x, 0, z);

    addFoundation(B, scene, node, w, d, mats.dark, 2.4);

    const body = B.MeshBuilder.CreateBox("retailBody", { width:w, height:8.5, depth:d }, scene);
    body.position.y = 3.8;
    body.material = variant % 2 ? mats.wall : mats.warm;
    body.parent = node;

    const glass = B.MeshBuilder.CreateBox("retailGlass", {
      width:w * .82, height:4.2, depth:.16
    }, scene);
    glass.position.set(0, 3.5, -d/2 - .10);
    glass.material = mats.storefront;
    glass.parent = node;

    const canopy = B.MeshBuilder.CreateBox("retailCanopy", {
      width:w * .92, height:.45, depth:3.0
    }, scene);
    canopy.position.set(0, 6.4, -d/2 - 1.1);
    canopy.material = mats.dark;
    canopy.parent = node;

    if (mats.__regular) {
      const sign =
        B.MeshBuilder.CreateBox(
          "retailSignBand",
          {
            width: w * 0.54,
            height: 1.15,
            depth: 0.22
          },
          scene
        );
      sign.position.set(
        variant % 2 ? w * 0.08 : -w * 0.08,
        7.2,
        -d / 2 - 0.18
      );
      sign.material = mats.accent;
      sign.parent = node;

      const roofUnit =
        B.MeshBuilder.CreateBox(
          "retailRoofUnit",
          {
            width: w * 0.20,
            height: 1.6,
            depth: d * 0.22
          },
          scene
        );
      roofUnit.position.set(w * 0.22, 9.0, d * 0.08);
      roofUnit.material = mats.dark;
      roofUnit.parent = node;
    }

    return node;
  }

  function warehouse(B, scene, root, x, z, w, d, mats, variant = 0) {
    const node = new B.TransformNode("cityWarehouse", scene);
    node.parent = root;
    node.position.set(x, 0, z);

    addFoundation(B, scene, node, w, d, mats.dark, 3.4);

    const body = B.MeshBuilder.CreateBox("warehouseBody", {
      width:w, height:13, depth:d
    }, scene);
    body.position.y = 5.8;
    body.material = variant % 2 ? mats.wall2 : mats.accent;
    body.parent = node;

    for (let i=-1;i<=1;i++) {
      const bay = B.MeshBuilder.CreateBox("loadingBay", {
        width:w*.18, height:5.0, depth:.20
      }, scene);
      bay.position.set(i*w*.25, 3.0, -d/2-.12);
      bay.material = mats.dark;
      bay.parent = node;
    }

    return node;
  }

  function buildNeighborhoodDemo(runtime, parent) {
    if (!runtime?.scene || !window.BABYLON) return null;

    const B = window.BABYLON;
    const scene = runtime.scene;
    const regular =
      runtime.graphicsPreset === "REGULAR" ||
      runtime.graphicsPreset === "DEEP";
    const mats =
      createMaterials(
        B,
        scene,
        regular,
        runtime.graphicsPreset || "BASIC",
        "Residential"
      );

    const root = new B.TransformNode("neutralNeighborhoodDemo", scene);
    root.parent = parent || null;

    // Four suburban streets.
    const createRoad = runtime.createRoad;
    if (typeof createRoad === "function") {
      createRoad(root, -520, -210, 20, 360, 0);
      createRoad(root, -400, -210, 20, 360, 0);
      createRoad(root, -280, -210, 20, 360, 0);
      createRoad(root, -400, -390, 260, 18, 0);
      createRoad(root, -400, -30, 260, 18, 0);
    }

    // 24 varied houses.
    let n = 0;
    for (const streetX of [-460, -340]) {
      for (let row = 0; row < 6; row++) {
        const z = -340 + row * 58;
        const a = n++;
        const b = n++;

        const jitterA =
          regular
            ? (seededVariation(a, 3) - 0.5) * 5.5
            : 0;
        const jitterB =
          regular
            ? (seededVariation(b, 7) - 0.5) * 5.5
            : 0;

        house(
          B,
          scene,
          root,
          streetX + jitterA,
          z + (regular ? (seededVariation(a, 9) - 0.5) * 5 : 0),
          regular ? (seededVariation(a, 11) - 0.5) * 0.05 : 0,
          mats,
          a
        );

        house(
          B,
          scene,
          root,
          streetX - 60 + jitterB,
          z + (regular ? (seededVariation(b, 13) - 0.5) * 5 : 0),
          Math.PI + (regular ? (seededVariation(b, 15) - 0.5) * 0.05 : 0),
          mats,
          b
        );
      }
    }

    // Mixed-density transition district.
    apartment(B, scene, root, -650, 40, 48, 28, 42, mats, 0);
    apartment(B, scene, root, -590, 45, 42, 38, 38, mats, 1);
    apartment(B, scene, root, -530, 48, 52, 48, 42, mats, 2);

    // Retail corridor.
    retail(B, scene, root, -390, 80, 46, 28, mats, 0);
    retail(B, scene, root, -330, 80, 52, 28, mats, 1);
    retail(B, scene, root, -265, 80, 58, 30, mats, 2);

    // South-east light industrial / warehouse district.
    warehouse(B, scene, root, 500, 330, 82, 54, mats, 0);
    warehouse(B, scene, root, 610, 330, 96, 58, mats, 1);
    warehouse(B, scene, root, 505, 420, 88, 60, mats, 2);

    return root;
  }


  function addRegularFacadeDetail(B, scene, root, w, h, d, mats, kind = "generic") {
    const floors = Math.max(2, Math.floor(h / 4.1));

    for (let f = 1; f < floors; f++) {
      const y = f * (h / floors);
      const band = B.MeshBuilder.CreateBox("regularFloorBand", {
        width: w + 0.18,
        height: 0.18,
        depth: d + 0.18
      }, scene);
      band.position.y = y;
      band.material = mats.dark;
      band.parent = root;
      band.isPickable = false;
    }

    const cols = Math.max(3, Math.floor(w / 6));
    for (let c = 0; c < cols; c++) {
      const win = B.MeshBuilder.CreateBox("regularWindowColumn", {
        width: Math.max(1.7, w / (cols * 1.8)),
        height: h * 0.66,
        depth: 0.14
      }, scene);
      win.position.set(
        -w * 0.40 + (c + 0.5) * (w * 0.80 / cols),
        h * 0.52,
        -d / 2 - 0.10
      );
      win.material = mats.storefront;
      win.parent = root;
      win.isPickable = false;
    }

    if (kind !== "house") {
      const hvac = B.MeshBuilder.CreateBox("roofHVAC", {
        width: Math.max(4, w * 0.24),
        height: 2.1,
        depth: Math.max(4, d * 0.22)
      }, scene);
      hvac.position.set(w * 0.18, h + 1.05, 0);
      hvac.material = mats.dark;
      hvac.parent = root;
      hvac.isPickable = false;
    }
  }

  function renderPlacedBuilding(runtime, data, parent) {
    if (!runtime?.scene || !window.BABYLON) return null;

    const B = window.BABYLON;
    const scene = runtime.scene;
    const def = item(data.type);
    const regular =
      runtime.graphicsPreset === "REGULAR" ||
      runtime.graphicsPreset === "DEEP";

    const mats =
      createMaterials(
        B,
        scene,
        regular,
        runtime.graphicsPreset || "BASIC",
        data.category ||
          def.category ||
          "General"
      );
    const fp = def.footprint || [40, 40];
    const w = fp[0];
    const d = fp[1];

    const root = new B.TransformNode(`placed_${data.id}`, scene);
    root.parent = parent || null;
    root.position.set(data.x || 0, data.y || 0, data.z || 0);
    root.rotation.y = data.rotation || 0;
    root.metadata = {
      placedBuilding: true,
      placedBuildingId: data.id,
      buildingType: data.type,
      footprint: fp.slice(),
      ownerId: data.ownerId || "local",
      architecturalStyle:
        data.style || null
    };

    const foundationDepth = data.foundationDepth || 3.2;
    addFoundation(B, scene, root, w, d, mats.dark, foundationDepth);

    let visual;

    const zoneStyles =
      window.mapGameBuildingStyles
        ?.STYLE_IDS || [
          "Modern",
          "Traditional",
          "Brick",
          "Steampunk",
          "Cyberpunk"
        ];

    const resolvedStyle =
      data.style ||
      (
        typeof data.variant === "string" &&
        zoneStyles.includes(data.variant)
          ? data.variant
          : zoneStyles[
              Math.abs(
                Number(data.variant || 0)
              ) % zoneStyles.length
            ]
      ) ||
      "Modern";

    if (
      def.category === "Residential" &&
      data.type === "smallHouse" &&
      window.mapGameBuildingStyles
        ?.createResidential
    ) {
      visual =
        window.mapGameBuildingStyles
          .createResidential(
            {
              ...runtime,
              graphicsPreset:
                runtime.graphicsPreset ||
                "BASIC"
            },
            root,
            {
              width: w * 0.88,
              depth: d * 0.86,
              seed:
                Number(data.variant || 0),
              density: "Low",
              style: resolvedStyle,
              graphicsPreset:
                runtime.graphicsPreset ||
                "BASIC"
            }
          );
    } else if (data.type === "smallHouse") {
      visual = house(B, scene, root, 0, 0, 0, mats, data.variant || 0);
    } else if (data.type === "townhomes") {
      visual = new B.TransformNode("townhomesVisual", scene);
      visual.parent = root;
      for (let i = -1; i <= 1; i++) {
        house(B, scene, visual, i * 15.5, 0, 0, mats, (data.variant || 0) + i + 2);
      }
    } else if (def.category === "Residential") {
      const h = data.type === "apartmentTower" ? 72 : 28;
      visual = apartment(B, scene, root, 0, 0, w * 0.86, h, d * 0.82, mats, data.variant || 0);
      if (regular) addRegularFacadeDetail(B, scene, visual, w * 0.86, h, d * 0.82, mats, "apartment");
    } else if (def.category === "Commercial") {
      if (["officeTower","hotel"].includes(data.type)) {
        const h = data.type === "officeTower" ? 96 : 72;
        visual = apartment(B, scene, root, 0, 0, w * 0.78, h, d * 0.76, mats, data.variant || 0);
        if (regular) {
          addRegularFacadeDetail(
            B,
            scene,
            visual,
            w * 0.78,
            h,
            d * 0.76,
            mats,
            "tower"
          );
          addTowerSetbacks(
            B,
            scene,
            visual,
            w * 0.78,
            h,
            d * 0.76,
            mats,
            data.variant || 0
          );
        }
      } else {
        visual = retail(B, scene, root, 0, 0, w * 0.90, d * 0.82, mats, data.variant || 0);
        if (regular && data.type === "officeLow") {
          addRegularFacadeDetail(B, scene, visual, w * 0.90, 18, d * 0.82, mats, "office");
        }
      }
    } else if (def.category === "Industrial") {
      visual = warehouse(B, scene, root, 0, 0, w * 0.92, d * 0.86, mats, data.variant || 0);
      if (["steelMill", "carbonPlant"].includes(data.type)) {
        const stacks = regular ? 3 : 2;
        for (let i = 0; i < stacks; i++) {
          const stack = B.MeshBuilder.CreateCylinder("factoryStack", {
            diameter: 3.6,
            height: 25 + i * 3,
            tessellation: regular ? 18 : 10
          }, scene);
          stack.position.set(-w * 0.25 + i * 10, 16, d * 0.18);
          stack.material = mats.dark;
          stack.parent = root;
          stack.isPickable = false;
        }
      }
    } else if (data.type === "solarFarm") {
      visual = new B.TransformNode("solarFarmVisual", scene);
      visual.parent = root;
      const rows = regular ? 5 : 3;
      const cols = regular ? 7 : 5;
      for (let rz = 0; rz < rows; rz++) {
        for (let cx = 0; cx < cols; cx++) {
          const panel = B.MeshBuilder.CreateBox("solarPanel", {
            width: 8.5,
            height: 0.35,
            depth: 5.2
          }, scene);
          panel.position.set(
            -w * 0.34 + cx * (w * 0.68 / Math.max(1, cols - 1)),
            2.3,
            -d * 0.30 + rz * (d * 0.60 / Math.max(1, rows - 1))
          );
          panel.rotation.x = -0.22;
          panel.material = mats.storefront;
          panel.parent = visual;
        }
      }
    } else if (["waterPlant", "airQualityCenter", "powerPlant"].includes(data.type)) {
      visual = warehouse(B, scene, root, 0, 0, w * 0.88, d * 0.82, mats, data.variant || 0);
      if (regular) addRegularFacadeDetail(B, scene, visual, w * 0.88, 18, d * 0.82, mats, "utility");
    } else if (def.category === "Parks") {
      visual = new B.TransformNode("parkVisual", scene);
      visual.parent = root;

      const lawn = B.MeshBuilder.CreateBox("parkLawn", {
        width: w * 0.92,
        height: 0.3,
        depth: d * 0.90
      }, scene);
      lawn.position.y = 0.1;
      lawn.material = mats.accent;
      lawn.parent = visual;

      const trees = regular ? 12 : 6;
      for (let i = 0; i < trees; i++) {
        const trunk = B.MeshBuilder.CreateCylinder("parkTreeTrunk", {
          diameter: 0.8,
          height: 4.5,
          tessellation: 8
        }, scene);
        trunk.position.set(
          -w * 0.36 + (i % 4) * w * 0.24,
          2.3,
          -d * 0.30 + Math.floor(i / 4) * d * 0.28
        );
        trunk.material = mats.dark;
        trunk.parent = visual;

        const crown = B.MeshBuilder.CreateIcoSphere("parkTreeCrown", {
          radius: 2.7,
          subdivisions: regular ? 2 : 1
        }, scene);
        crown.position.copyFrom(trunk.position);
        crown.position.y += 4.0;
        crown.material = mats.warm;
        crown.parent = visual;
      }
    } else {
      visual = apartment(B, scene, root, 0, 0, w * 0.84, 24, d * 0.80, mats, data.variant || 0);
      if (regular) addRegularFacadeDetail(B, scene, visual, w * 0.84, 24, d * 0.80, mats, "civic");
    }

    return root;
  }

  window.mapGameBuildings = {
    VERSION: "0.2.2C2",
    CATALOG,
    item,
    buildNeighborhoodDemo,
    renderPlacedBuilding,
    addFoundation
  };

  console.log("Map Game buildings 0.2.2C2 procedural style foundation ready.");
})();
