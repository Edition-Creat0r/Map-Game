// Review artifacts derived from the exact runtime data. No economy state writes.
const fs = require("node:fs"),
  path = require("node:path"),
  R = require("./registry.js");
const { data } = R,
  quote = (v) => '"' + String(v).replaceAll('"', '""') + '"';
const columns = [
  "id",
  "name",
  "sector",
  "availability",
  "era",
  "technology",
  "recipeId",
  "recipeVersion",
  "model",
  "footprint",
  "cost",
  "workers",
  "energy",
  "upkeepPerMinute",
  "inputsPerMinute",
  "outputsPerMinute",
  "storageClass",
  "maxLevel",
  "specializations",
];
const rows = data.buildings.map((b) => [
  b.id,
  b.name,
  b.sector,
  b.availability,
  b.era,
  b.technology,
  b.recipes[0].id,
  b.recipes[0].version,
  b.visual.existingModelId,
  b.footprint.join("x"),
  JSON.stringify(b.cost),
  b.operating.workers,
  b.operating.energy,
  b.operating.upkeep,
  JSON.stringify(b.recipes[0].inputsPerMinute),
  JSON.stringify(b.recipes[0].outputsPerMinute),
  b.logistics.storageClass,
  b.maxLevel,
  b.specializations.join(" / "),
]);
fs.writeFileSync(
  path.join(__dirname, "balance.csv"),
  [columns, ...rows].map((r) => r.map(quote).join(",")).join("\n") + "\n",
);
const edges = [];
for (const b of data.buildings)
  for (const [from, inputRate] of Object.entries(b.recipes[0].inputsPerMinute))
    for (const [to, outputRate] of Object.entries(
      b.recipes[0].outputsPerMinute,
    ))
      edges.push({
        from,
        to,
        building: b.id,
        recipe: b.recipes[0].id,
        recipeVersion: b.recipes[0].version,
        inputPerMinute: inputRate,
        outputPerMinute: outputRate,
        availability: b.availability,
      });
fs.writeFileSync(
  path.join(__dirname, "dependency-graph.json"),
  JSON.stringify(
    {
      version: 1,
      nodes: data.materials,
      edges,
      topologicalOrder: R.topological,
    },
    null,
    2,
  ) + "\n",
);
const graph = [
  "# Material dependency graph",
  "",
  "Generated from the validated registry. Extractors are source nodes; money is not an industrial recipe output. Locked definitions remain marked in the catalog.",
  "",
  "```mermaid",
  "flowchart LR",
  ...data.materials
    .filter((m) => m.id !== "money")
    .map((m) => `  ${m.id}["${m.name}"]`),
  ...edges.map((e) => `  ${e.from} -->|${e.building}| ${e.to}`),
  "```",
  "",
];
fs.writeFileSync(path.join(__dirname, "PRODUCTION_GRAPH.md"), graph.join("\n"));
const availability = [
  "# Phase B availability",
  "",
  "Generated from catalog.json. These are industrial entries only; the five starter contracts remain playable separately.",
  "",
  "| Sector | Defined | Playable | Future-locked | Definitions only |",
  "| --- | ---: | ---: | ---: | ---: |",
];
for (const sector of Object.keys(R.SECTORS)) {
  const list = data.buildings.filter((b) => b.sector === sector);
  availability.push(
    `| ${sector} | ${list.length} | ${list.filter((b) => b.availability === "playable").length} | ${list.filter((b) => b.availability === "futureLocked").length} | ${list.filter((b) => b.availability === "definitionsOnly").length} |`,
  );
}
availability.push(
  "",
  "Era 1–2 foundational technologies are licensed by this release policy. No research actions, era progression or upgrade effects are implemented. Later-era entries are locked; defense entries are definitions only and do not operate.",
  "",
);
for (const status of ["playable", "futureLocked", "definitionsOnly"]) {
  availability.push(`## ${status}`, "");
  for (const sector of Object.keys(R.SECTORS)) {
    const list = data.buildings.filter(
      (b) => b.availability === status && b.sector === sector,
    );
    if (list.length)
      availability.push(
        `- **${sector}:** ${list.map((b) => "`" + b.id + "`").join(", ")}`,
      );
  }
  availability.push("");
}
fs.writeFileSync(
  path.join(__dirname, "AVAILABILITY.md"),
  availability.join("\n"),
);
