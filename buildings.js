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
      footprint: [122, 104],
      variants: ["Utility", "Modern", "Clean", "Carbon", "Future"],
      produces: ["Electricity"]
    },
    {
      id: "governmentHall",
      category: "Government",
      icon: "◇",
      name: "Government Hall",
      description: "Administrative center for laws, services and future government systems.",
      cost: { money: 750000, steel: 600, glass: 400, concrete: 1000 },
      incomePerMin: 0,
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
      footprint: [190, 170],
      variants: ["Classic", "Boardwalk", "Adventure", "Modern", "Future"]
    }
  ];

  function item(id) {
    return CATALOG.find(v => v.id === id) || CATALOG[0];
  }

  function createMaterials(B, scene, regular) {
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

    return { wall, wall2, roof, dark, storefront, warm, accent };
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
    const regular = runtime.graphicsPreset === "REGULAR";
    const mats = createMaterials(B, scene, regular);

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
        house(B, scene, root, streetX, z, 0, mats, n++);
        house(B, scene, root, streetX - 60, z, Math.PI, mats, n++);
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

  window.mapGameBuildings = {
    VERSION: "0.2.1E",
    CATALOG,
    item,
    buildNeighborhoodDemo,
    addFoundation
  };

  console.log("Map Game buildings 0.2.1E ready.");
})();
