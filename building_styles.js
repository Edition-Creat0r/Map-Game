// ============================================================
// MAP GAME — building_styles.js
// Alpha 0.2.2C2 — procedural architectural style system
//
// First finished target:
//   MODERN RESIDENTIAL — BASIC + REGULAR
//
// All five style IDs are locked now so zoning/district data can use
// them without future migrations.
// ============================================================

(() => {
  "use strict";

  const STYLE_IDS = Object.freeze([
    "Modern",
    "Traditional",
    "Brick",
    "Steampunk",
    "Cyberpunk"
  ]);

  const STYLE_INFO = Object.freeze({
    Modern: {
      id: "Modern",
      description:
        "Clean interlocking forms, flat roofs, broad glazing and restrained accents."
    },
    Traditional: {
      id: "Traditional",
      description:
        "Pitched roofs, porches, balanced openings, chimneys and domestic proportions."
    },
    Brick: {
      id: "Brick",
      description:
        "Masonry massing, deep openings, parapets, arches and heavier urban forms."
    },
    Steampunk: {
      id: "Steampunk",
      description:
        "Victorian-industrial massing with pipes, tanks, vents, stacks and mechanical details."
    },
    Cyberpunk: {
      id: "Cyberpunk",
      description:
        "Layered asymmetrical forms, exposed services, sign frames, roof machinery and dense vertical detail."
    }
  });

  function seeded(seed, salt = 0) {
    const n =
      Math.sin(
        (Number(seed) + 1) * 93.173 +
        salt * 37.911
      ) * 43758.5453;

    return n - Math.floor(n);
  }

  function box(
    B,
    scene,
    parent,
    name,
    {
      width,
      height,
      depth,
      x = 0,
      y = 0,
      z = 0,
      material = null
    }
  ) {
    const mesh =
      B.MeshBuilder.CreateBox(
        name,
        {
          width,
          height,
          depth
        },
        scene
      );

    mesh.position.set(x, y, z);
    mesh.material = material;
    mesh.parent = parent;
    mesh.isPickable = false;
    return mesh;
  }

  function modernResidential(
    runtime,
    parent,
    {
      width = 18,
      depth = 22,
      seed = 0,
      density = "Low",
      graphicsPreset = null
    } = {}
  ) {
    const B = window.BABYLON;
    const scene = runtime?.scene;

    if (!B || !scene) return null;

    const graphics =
      String(
        graphicsPreset ||
        runtime.graphicsPreset ||
        "BASIC"
      ).toUpperCase();

    const regular =
      graphics === "REGULAR" ||
      graphics === "DEEP";

    const mats =
      window.mapGameMaterials
        ?.createStylePalette?.(
          scene,
          graphics,
          "Modern",
          "Residential"
        );

    if (!mats) return null;

    const root =
      new B.TransformNode(
        "styleModernResidential",
        scene
      );

    root.parent = parent || null;

    const medium =
      String(density).toLowerCase() ===
      "medium";

    const floorHeight = 3.25;
    const floors =
      medium
        ? 3 + Math.floor(seeded(seed, 2) * 2)
        : 2;

    const mainH =
      floors * floorHeight;

    const leftW =
      width * (
        0.58 +
        seeded(seed, 4) * 0.08
      );

    const rightW =
      width - leftW + 1.4;

    // Main clean volume.
    box(
      B,
      scene,
      root,
      "modernMainVolume",
      {
        width: leftW,
        height: mainH,
        depth: depth * 0.84,
        x: -width * 0.16,
        y: mainH / 2,
        z: 0.7,
        material:
          seeded(seed, 6) > 0.52
            ? mats.stucco
            : mats.wall
      }
    );

    // Offset secondary block creates the concept-art silhouette.
    const secondaryH =
      mainH * (
        medium ? 0.72 : 0.60
      );

    box(
      B,
      scene,
      root,
      "modernSecondaryVolume",
      {
        width: rightW,
        height: secondaryH,
        depth: depth * 0.70,
        x: width * 0.25,
        y: secondaryH / 2,
        z: -depth * 0.06,
        material:
          seeded(seed, 7) > 0.5
            ? mats.wall2
            : mats.stucco
      }
    );

    // Recessed darker entrance spine.
    box(
      B,
      scene,
      root,
      "modernEntrySpine",
      {
        width: width * 0.17,
        height: mainH * 0.82,
        depth: 0.42,
        x: width * 0.05,
        y: mainH * 0.43,
        z: -depth * 0.425,
        material: mats.dark
      }
    );

    // Broad front glazing.
    const glassRows =
      regular
        ? Math.max(2, floors)
        : 2;

    for (
      let row = 0;
      row < glassRows;
      row++
    ) {
      const y =
        2.15 +
        row * floorHeight;

      box(
        B,
        scene,
        root,
        "modernFrontGlass",
        {
          width: leftW * 0.56,
          height:
            regular ? 2.15 : 1.95,
          depth: 0.18,
          x: -width * 0.18,
          y,
          z: -depth * 0.425 - 0.12,
          material: mats.glass
        }
      );
    }

    // Side picture window.
    box(
      B,
      scene,
      root,
      "modernSideGlass",
      {
        width: 0.18,
        height: secondaryH * 0.42,
        depth: depth * 0.34,
        x:
          width * 0.25 +
          rightW / 2 +
          0.11,
        y: secondaryH * 0.54,
        z: -depth * 0.04,
        material: mats.glass
      }
    );

    // Wood/metal-like accent panel. Texture comes later; geometry stays.
    box(
      B,
      scene,
      root,
      "modernAccentPanel",
      {
        width: width * 0.23,
        height: mainH * 0.55,
        depth: 0.22,
        x: width * 0.28,
        y: mainH * 0.42,
        z: -depth * 0.425 - 0.14,
        material: mats.accent
      }
    );

    // Flat roof caps.
    box(
      B,
      scene,
      root,
      "modernRoofCapA",
      {
        width: leftW + 0.55,
        height: 0.36,
        depth: depth * 0.84 + 0.55,
        x: -width * 0.16,
        y: mainH + 0.15,
        z: 0.7,
        material: mats.roofSurface
      }
    );

    box(
      B,
      scene,
      root,
      "modernRoofCapB",
      {
        width: rightW + 0.45,
        height: 0.32,
        depth: depth * 0.70 + 0.45,
        x: width * 0.25,
        y: secondaryH + 0.13,
        z: -depth * 0.06,
        material: mats.roofSurface
      }
    );

    // BASIC stops around here: strong silhouette, broad glass, major accents.
    if (!regular) {
      root.metadata = {
        architecturalStyle: "Modern",
        buildingUse: "Residential",
        density,
        detailTier: "Basic"
      };

      return root;
    }

    // REGULAR: balcony slab.
    const balconyW =
      width * (
        0.34 +
        seeded(seed, 11) * 0.09
      );

    box(
      B,
      scene,
      root,
      "modernBalconySlab",
      {
        width: balconyW,
        height: 0.22,
        depth: 2.2,
        x: -width * 0.17,
        y: floorHeight + 0.16,
        z: -depth * 0.425 - 1.0,
        material: mats.dark
      }
    );

    // Balcony glass rail.
    box(
      B,
      scene,
      root,
      "modernBalconyRail",
      {
        width: balconyW * 0.95,
        height: 1.05,
        depth: 0.10,
        x: -width * 0.17,
        y: floorHeight + 0.79,
        z: -depth * 0.425 - 2.04,
        material: mats.glass
      }
    );

    // Window mullions / vertical framing.
    for (let i = -2; i <= 2; i++) {
      box(
        B,
        scene,
        root,
        "modernWindowMullion",
        {
          width: 0.12,
          height:
            Math.max(
              2.3,
              mainH * 0.62
            ),
          depth: 0.22,
          x:
            -width * 0.18 +
            i * (leftW * 0.10),
          y: mainH * 0.50,
          z:
            -depth * 0.425 -
            0.23,
          material: mats.dark
        }
      );
    }

    // Roof mechanical unit.
    box(
      B,
      scene,
      root,
      "modernRoofHVAC",
      {
        width: width * 0.19,
        height: 1.55,
        depth: depth * 0.16,
        x:
          -width * 0.20 +
          seeded(seed, 18) *
          width * 0.12,
        y: mainH + 0.95,
        z: depth * 0.07,
        material: mats.metal
      }
    );

    // Entrance canopy.
    box(
      B,
      scene,
      root,
      "modernEntryCanopy",
      {
        width: width * 0.26,
        height: 0.22,
        depth: 2.25,
        x: width * 0.08,
        y: 3.05,
        z: -depth * 0.425 - 1.05,
        material: mats.dark
      }
    );

    // Small planter volumes: architectural detail without expensive foliage.
    for (const side of [-1, 1]) {
      box(
        B,
        scene,
        root,
        "modernPlanter",
        {
          width: width * 0.15,
          height: 0.55,
          depth: 1.2,
          x: side * width * 0.29,
          y: 0.30,
          z: -depth * 0.49,
          material: mats.wall2
        }
      );
    }

    root.metadata = {
      architecturalStyle: "Modern",
      buildingUse: "Residential",
      density,
      detailTier: "Regular"
    };

    return root;
  }

  function createResidential(
    runtime,
    parent,
    options = {}
  ) {
    const style =
      STYLE_IDS.includes(options.style)
        ? options.style
        : "Modern";

    // C2 begins with Modern fully modeled. The remaining four style IDs
    // are already stable for saves/zones and will get their own geometry
    // without changing the data format.
    if (style === "Modern") {
      return modernResidential(
        runtime,
        parent,
        options
      );
    }

    return modernResidential(
      runtime,
      parent,
      {
        ...options,
        style: "Modern"
      }
    );
  }

  window.mapGameBuildingStyles = {
    VERSION: "0.2.2C2",
    STYLE_IDS,
    STYLE_INFO,
    createResidential,
    modernResidential
  };

  console.log(
    "Map Game building styles 0.2.2C2 ready — Modern Residential Basic/Regular."
  );
})();
