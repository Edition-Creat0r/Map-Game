// Reuse the existing building identities/renderers; register industrial adapters once.
(() => {
  "use strict";
  const R = window.mapGameIndustrialRegistry,
    B = window.mapGameBuildings;
  const checked = R.validate(R.data, { models: B.CATALOG.map((d) => d.id) });
  if (!checked.valid) throw Error(checked.errors.join("; "));
  const occupied = new Set(B.CATALOG.map((d) => d.id));
  for (const d of R.data.buildings)
    if (occupied.has(d.id))
      throw Error(`Industrial building ID collides: ${d.id}`);
  for (const d of R.data.buildings) {
    B.CATALOG.push({
      ...d,
      industrial: true,
      category: "Industrial",
      sectorLabel: {
        mining: "Mining",
        refining: "Refining",
        construction: "Construction Materials",
        chemicals: "Chemicals",
        electronics: "Electronics",
        machinery: "Machinery",
        vehicles: "Vehicles",
        aerospace: "Aerospace",
        consumer: "Consumer Goods",
        defense: "Defense Manufacturing",
      }[d.sector],
      description: `${d.name} · ${d.researchRequirements ? "Singleplayer expansion — research and era requirements apply" : d.availability === "playable" ? "Foundation technology available" : "Future content — not unlocked"}`,
      variants: d.visual.styles.slice(),
      economy: {
        inputs: d.recipes[0].inputsPerMinute,
        production: d.recipes[0].outputsPerMinute,
        energyUse: d.operating.energy,
        workforce: d.operating.workers,
        upkeep: d.operating.upkeep,
      },
      recipeId: d.recipes[0].id,
      recipeVersion: d.recipes[0].version,
    });
  }
})();
