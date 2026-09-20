// ============================================================
// MAP GAME — materials.js
// Alpha 0.2.1G FINAL VISUAL PASS
//
// Real external asset paths:
// buildings/concrete_01/
// roads/pavement_01/
// roads/asphalt_01/
//
// BASIC deliberately stays inexpensive.
// REGULAR uses the full diffuse + normal + roughness PBR sets.
// DEEP hooks are included for later without changing gameplay.
// ============================================================

(() => {
  "use strict";

  const ASSETS = {
    concrete: {
      diffuse: "assets/textures/buildings/concrete_01/concrete-diffuse.jpg",
      normal: "assets/textures/buildings/concrete_01/concrete-normal.jpg",
      roughness: "assets/textures/buildings/concrete_01/concrete-roughness.jpg"
    },
    pavement: {
      diffuse: "assets/textures/roads/pavement_01/pavement-diffuse.jpg",
      normal: "assets/textures/roads/pavement_01/pavement-normal.jpg",
      roughness: "assets/textures/roads/pavement_01/pavement-roughness.jpg"
    },
    asphalt: {
      diffuse: "assets/textures/roads/asphalt_01/asphalt-diffuse.jpg",
      normal: "assets/textures/roads/asphalt_01/asphalt-normal.jpg",
      roughness: "assets/textures/roads/asphalt_01/asphalt-roughness.jpg"
    },
    brick: {
      diffuse: "assets/textures/buildings/brick_01/brick-diffuse.jpg",
      normal: "assets/textures/buildings/brick_01/brick-normal.jpg",
      roughness: "assets/textures/buildings/brick_01/brick-roughness.jpg"
    },
    stucco: {
      diffuse: "assets/textures/buildings/stucco_01/stucco-diffuse.jpg",
      normal: "assets/textures/buildings/stucco_01/stucco-normal.jpg",
      roughness: "assets/textures/buildings/stucco_01/stucco-roughness.jpg"
    },
    corrugatedMetal: {
      diffuse: "assets/textures/buildings/corrugated_metal_01/metal-diffuse.jpg",
      normal: "assets/textures/buildings/corrugated_metal_01/metal-normal.jpg",
      roughness: "assets/textures/buildings/corrugated_metal_01/metal-roughness.jpg"
    },
    roof: {
      diffuse: "assets/textures/buildings/roof_01/roof-diffuse.jpg",
      normal: "assets/textures/buildings/roof_01/roof-normal.jpg",
      roughness: "assets/textures/buildings/roof_01/roof-roughness.jpg"
    }
  };

  const cache = new WeakMap();

  function sceneCache(scene) {
    if (!cache.has(scene)) cache.set(scene, new Map());
    return cache.get(scene);
  }

  function simpleMaterial(B, scene, name, hex, specular = 0.08) {
    const key = `simple:${name}`;
    const c = sceneCache(scene);
    if (c.has(key)) return c.get(key);

    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.specularColor = new B.Color3(specular, specular, specular);
    m.specularPower = 28;
    c.set(key, m);
    return m;
  }

  function texture(B, scene, path, uScale = 1, vScale = 1, gammaSpace = true) {
    const key = `texture:${path}:${uScale}:${vScale}:${gammaSpace}`;
    const c = sceneCache(scene);
    if (c.has(key)) return c.get(key);

    const t = new B.Texture(
      path,
      scene,
      true,
      false,
      B.Texture.TRILINEAR_SAMPLINGMODE
    );

    t.uScale = uScale;
    t.vScale = vScale;
    t.gammaSpace = gammaSpace;
    t.anisotropicFilteringLevel = 8;
    t.onError = (_message, exception) => {
      console.warn("Map Game texture failed to load:", path, exception || "");
    };

    c.set(key, t);
    return t;
  }

  function pbrSurface(
    B,
    scene,
    name,
    set,
    {
      baseColor = "#ffffff",
      roughness = 0.82,
      uScale = 1,
      vScale = 1,
      bumpLevel = 0.70
    } = {}
  ) {
    const key =
      `pbr:${name}:${set.diffuse}:${uScale}:${vScale}:${roughness}:${bumpLevel}`;

    const c = sceneCache(scene);
    if (c.has(key)) return c.get(key);

    const m = new B.PBRMaterial(name, scene);
    m.albedoColor = B.Color3.FromHexString(baseColor);
    m.metallic = 0.0;
    m.roughness = roughness;
    m.environmentIntensity = 0.72;
    m.directIntensity = 0.90;
    m.specularIntensity = 0.48;

    m.albedoTexture = texture(
      B, scene, set.diffuse, uScale, vScale, true
    );

    m.bumpTexture = texture(
      B, scene, set.normal, uScale, vScale, false
    );
    m.bumpTexture.level = bumpLevel;

    // A standalone grayscale roughness image can be read from its green
    // channel by Babylon's PBR material. Because it is grayscale, RGB
    // channels carry the same roughness information.
    m.metallicTexture = texture(
      B, scene, set.roughness, uScale, vScale, false
    );
    m.useRoughnessFromMetallicTextureGreen = true;
    m.useRoughnessFromMetallicTextureAlpha = false;
    m.useMetallnessFromMetallicTextureBlue = false;

    c.set(key, m);
    return m;
  }

  function glassMaterial(B, scene, regular, deep = false) {
    const key = `glass:${regular}:${deep}`;
    const c = sceneCache(scene);
    if (c.has(key)) return c.get(key);

    if (!regular) {
      const m = new B.StandardMaterial("mgGlassBasic", scene);
      m.diffuseColor = new B.Color3(0.08, 0.27, 0.36);
      m.emissiveColor = new B.Color3(0.015, 0.045, 0.060);
      m.specularColor = new B.Color3(0.32, 0.42, 0.48);
      m.specularPower = 72;
      m.alpha = 0.91;
      c.set(key, m);
      return m;
    }

    const m = new B.PBRMaterial(
      deep ? "mgGlassDeep" : "mgGlassRegular",
      scene
    );
    m.albedoColor = new B.Color3(0.045, 0.22, 0.31);
    m.metallic = 0.06;
    m.roughness = deep ? 0.12 : 0.20;
    m.alpha = deep ? 0.68 : 0.78;
    m.indexOfRefraction = 1.47;
    m.environmentIntensity = deep ? 1.10 : 0.85;
    m.directIntensity = 0.85;
    m.specularIntensity = 0.92;
    c.set(key, m);
    return m;
  }

  function getRoadSet(scene, preset = "BASIC") {
    const B = window.BABYLON;
    const regular = preset === "REGULAR" || preset === "DEEP";
    const deep = preset === "DEEP";

    if (!regular) {
      return {
        asphalt: simpleMaterial(B, scene, "mgAsphaltBasic", "#242a2e", 0.05),
        pavement: simpleMaterial(B, scene, "mgPavementBasic", "#8b8c88", 0.06),
        curb: simpleMaterial(B, scene, "mgCurbBasic", "#5d6264", 0.06)
      };
    }

    return {
      asphalt: pbrSurface(
        B,
        scene,
        deep ? "mgAsphaltDeep" : "mgAsphaltRegular",
        ASSETS.asphalt,
        {
          baseColor: "#d8d8d8",
          roughness: 0.91,
          uScale: deep ? 5.5 : 4.0,
          vScale: deep ? 5.5 : 4.0,
          bumpLevel: deep ? 0.90 : 0.64
        }
      ),
      pavement: pbrSurface(
        B,
        scene,
        deep ? "mgPavementDeep" : "mgPavementRegular",
        ASSETS.pavement,
        {
          baseColor: "#e1ded8",
          roughness: 0.88,
          uScale: deep ? 4.4 : 3.2,
          vScale: deep ? 4.4 : 3.2,
          bumpLevel: deep ? 0.78 : 0.55
        }
      ),
      curb: pbrSurface(
        B,
        scene,
        "mgCurbRegular",
        ASSETS.pavement,
        {
          baseColor: "#b9b9b4",
          roughness: 0.90,
          uScale: 5.0,
          vScale: 5.0,
          bumpLevel: 0.38
        }
      )
    };
  }

  function createBuildingPalette(scene, preset = "BASIC", category = "General") {
    const B = window.BABYLON;
    const regular = preset === "REGULAR" || preset === "DEEP";
    const deep = preset === "DEEP";

    const categoryKey =
      String(category || "General").toLowerCase();

    const categoryStyle =
      categoryKey === "residential"
        ? { primary: "#d6c7b1", secondary: "#8e7e6d", accent: "#66584d" }
      : categoryKey === "commercial"
        ? { primary: "#c7d0d2", secondary: "#71848b", accent: "#355d6a" }
      : categoryKey === "industrial"
        ? { primary: "#a9aaa3", secondary: "#6d716c", accent: "#665844" }
      : categoryKey === "government"
        ? { primary: "#d8d5cc", secondary: "#8a9195", accent: "#546776" }
      : categoryKey === "infrastructure"
        ? { primary: "#b9c0bc", secondary: "#66716f", accent: "#496f70" }
      : categoryKey === "parks"
        ? { primary: "#c9c4ad", secondary: "#7e806d", accent: "#52674f" }
      : { primary: "#c7c2b7", secondary: "#8a9397", accent: "#6d7f83" };

    if (!regular) {
      return {
        wall: simpleMaterial(B, scene, `mgWallBasic_${categoryKey}`, categoryStyle.primary, 0.08),
        wall2: simpleMaterial(B, scene, `mgWall2Basic_${categoryKey}`, categoryStyle.secondary, 0.08),
        roof: simpleMaterial(B, scene, "mgRoofBasic", "#303942", 0.06),
        dark: simpleMaterial(B, scene, "mgDarkBasic", "#18242c", 0.12),
        storefront: glassMaterial(B, scene, false),
        warm: simpleMaterial(B, scene, "mgWarmBasic", "#d7c5a5", 0.06),
        accent: simpleMaterial(B, scene, `mgAccentBasic_${categoryKey}`, categoryStyle.accent, 0.08),
        pavement: getRoadSet(scene, preset).pavement
      };
    }

    return {
      wall: pbrSurface(
        B,
        scene,
        `mgConcretePrimary_${categoryKey}`,
        ASSETS.concrete,
        {
          baseColor: categoryStyle.primary,
          roughness: 0.84,
          uScale: deep ? 3.4 : 2.4,
          vScale: deep ? 3.4 : 2.4,
          bumpLevel: deep ? 0.84 : 0.58
        }
      ),
      wall2: pbrSurface(
        B,
        scene,
        `mgConcreteSecondary_${categoryKey}`,
        ASSETS.concrete,
        {
          baseColor: categoryStyle.secondary,
          roughness: 0.86,
          uScale: deep ? 3.0 : 2.0,
          vScale: deep ? 3.0 : 2.0,
          bumpLevel: deep ? 0.78 : 0.54
        }
      ),
      roof: simpleMaterial(B, scene, "mgRoofRegular", "#222b31", 0.18),
      dark: simpleMaterial(B, scene, "mgDarkRegular", "#131e25", 0.24),
      storefront: glassMaterial(B, scene, true, deep),
      warm: pbrSurface(
        B,
        scene,
        "mgConcreteWarm",
        ASSETS.concrete,
        {
          baseColor: "#d9c7aa",
          roughness: 0.82,
          uScale: 2.1,
          vScale: 2.1,
          bumpLevel: 0.50
        }
      ),
      accent: simpleMaterial(B, scene, `mgAccentRegular_${categoryKey}`, categoryStyle.accent, 0.20),
      pavement: getRoadSet(scene, preset).pavement
    };
  }

  const BUILDING_STYLES = Object.freeze([
    "Modern",
    "Traditional",
    "Brick",
    "Steampunk",
    "Cyberpunk"
  ]);

  function createStylePalette(
    scene,
    preset = "BASIC",
    style = "Modern",
    category = "Residential"
  ) {
    const B = window.BABYLON;
    const graphics = String(preset || "BASIC").toUpperCase();
    const regular = graphics === "REGULAR" || graphics === "DEEP";
    const deep = graphics === "DEEP";
    const styleName =
      BUILDING_STYLES.includes(style)
        ? style
        : "Modern";

    const base =
      createBuildingPalette(
        scene,
        graphics,
        category
      );

    if (!regular) {
      const basic = {
        ...base,
        style: styleName,
        brick:
          simpleMaterial(
            B, scene,
            "mgBrickBasic",
            "#925e4f",
            0.05
          ),
        stucco:
          simpleMaterial(
            B, scene,
            "mgStuccoBasic",
            "#d9d3c4",
            0.05
          ),
        metal:
          simpleMaterial(
            B, scene,
            "mgMetalBasic",
            "#68747a",
            0.16
          ),
        roofSurface:
          simpleMaterial(
            B, scene,
            "mgRoofSurfaceBasic",
            "#343b41",
            0.06
          ),
        glass:
          glassMaterial(
            B,
            scene,
            false,
            false
          )
      };

      return basic;
    }

    return {
      ...base,
      style: styleName,

      brick:
        pbrSurface(
          B,
          scene,
          "mgBrickRegular",
          ASSETS.brick,
          {
            baseColor: "#b48775",
            roughness: 0.88,
            uScale: deep ? 3.6 : 2.7,
            vScale: deep ? 3.6 : 2.7,
            bumpLevel: deep ? 0.82 : 0.64
          }
        ),

      stucco:
        pbrSurface(
          B,
          scene,
          "mgStuccoRegular",
          ASSETS.stucco,
          {
            baseColor: "#e2ddd0",
            roughness: 0.91,
            uScale: deep ? 3.0 : 2.2,
            vScale: deep ? 3.0 : 2.2,
            bumpLevel: deep ? 0.60 : 0.42
          }
        ),

      metal:
        pbrSurface(
          B,
          scene,
          "mgCorrugatedMetalRegular",
          ASSETS.corrugatedMetal,
          {
            baseColor: "#9da6a8",
            roughness: 0.62,
            uScale: deep ? 2.8 : 2.0,
            vScale: deep ? 2.8 : 2.0,
            bumpLevel: deep ? 0.88 : 0.68
          }
        ),

      roofSurface:
        pbrSurface(
          B,
          scene,
          "mgRoofSurfaceRegular",
          ASSETS.roof,
          {
            baseColor: "#4b5053",
            roughness: 0.90,
            uScale: deep ? 3.5 : 2.5,
            vScale: deep ? 3.5 : 2.5,
            bumpLevel: deep ? 0.72 : 0.54
          }
        ),

      glass:
        glassMaterial(
          B,
          scene,
          true,
          deep
        )
    };
  }

  function assetReport() {
    return JSON.parse(JSON.stringify(ASSETS));
  }

  window.mapGameMaterials = {
    VERSION: "0.2.2C2",
    ASSETS,
    getRoadSet,
    createBuildingPalette,
    createStylePalette,
    BUILDING_STYLES,
    glassMaterial,
    assetReport
  };

  console.log("Map Game materials 0.2.2C2 style texture foundation ready.");
})();
