// Validate once at load. No registry work belongs in rendering loops.
(function (root) {
  "use strict";
  const data =
    typeof module !== "undefined"
      ? require("./catalog-data.js")
      : root.mapGameIndustrialData;
  const SECTORS = {
    mining: 18,
    refining: 18,
    construction: 14,
    chemicals: 16,
    electronics: 14,
    machinery: 15,
    vehicles: 13,
    aerospace: 10,
    consumer: 12,
    defense: 10,
  };
  const CLASSES = ["bulk", "liquid", "general", "precision", "hazardous"],
    STYLES = ["Production", "Efficiency", "Automation", "Logistics"];
  const ID = /^[a-z][A-Za-z0-9_]*$/;
  function validate(d, options = {}) {
    const errors = [],
      fail = (s) => errors.push(s),
      unique = (items, label) => {
        const ids = new Set();
        for (const item of items || []) {
          if (!item || typeof item.id !== "string" || !ID.test(item.id))
            fail(`${label}: invalid ID`);
          else if (ids.has(item.id)) fail(`${label}: duplicate ${item.id}`);
          ids.add(item?.id);
        }
        return ids;
      };
    if (!d || typeof d !== "object")
      return { valid: false, errors: ["Registry object required"] };
    if (d.version !== 1) fail("Unsupported registry version");
    if (
      !Array.isArray(d.materials) ||
      !Array.isArray(d.buildings) ||
      !Array.isArray(d.technologies) ||
      !Array.isArray(d.models)
    )
      return { valid: false, errors: ["Registry arrays are required"] };
    if (
      [...d.materials, ...d.buildings, ...d.technologies].some(
        (v) => !v || typeof v !== "object" || Array.isArray(v),
      )
    )
      return { valid: false, errors: ["Registry records must be objects"] };
    const materials = unique(d.materials, "material"),
      buildings = unique(d.buildings, "building"),
      tech = unique(d.technologies, "technology"),
      recipeIds = new Set(),
      aliases = new Map(),
      models = new Set(options.models || d.models);
    if (new Set(d.models).size !== d.models.length) fail("Duplicate model IDs");
    for (const model of d.models)
      if (!models.has(model)) fail(`Unknown model ${model}`);
    for (const m of d.materials) {
      if (!m || typeof m !== "object") {
        fail("Invalid material record");
        continue;
      }
      if (
        typeof m.name !== "string" ||
        !m.name ||
        typeof m.unit !== "string" ||
        !m.unit ||
        !CLASSES.includes(m.storageClass)
      )
        fail(`Invalid material metadata ${m.id}`);
      if (m.aliases !== undefined && !Array.isArray(m.aliases)) {
        fail(`Invalid aliases ${m.id}`);
        continue;
      }
      for (const name of [m.id, ...(m.aliases || [])]) {
        if (
          typeof name !== "string" ||
          (aliases.has(name) && aliases.get(name) !== m.id)
        )
          fail(`Ambiguous alias ${name}`);
        aliases.set(name, m.id);
      }
    }
    const amount = (v) =>
      typeof v === "number" &&
      Number.isFinite(v) &&
      v >= 0 &&
      v <= 1e12 &&
      Number.isInteger(v * 1e6);
    function amounts(values, label, positive = false) {
      if (!values || Array.isArray(values) || typeof values !== "object") {
        fail(`Invalid amounts ${label}`);
        return;
      }
      if (positive && !Object.values(values).some((v) => v > 0))
        fail(`Empty output ${label}`);
      for (const [k, v] of Object.entries(values)) {
        if (!materials.has(k)) fail(`Undefined material ${k} in ${label}`);
        if (!amount(v)) fail(`Invalid amount ${k} in ${label}`);
      }
    }
    const graph = new Map([...materials].map((k) => [k, new Set()])),
      producer = new Map();
    for (const b of d.buildings) {
      if (!b || typeof b !== "object") {
        fail("Invalid building record");
        continue;
      }
      if (!SECTORS[b.sector]) fail(`Unknown sector ${b.id}`);
      if (
        typeof b.name !== "string" ||
        !b.name ||
        !Number.isInteger(b.era) ||
        b.era < 1 ||
        b.era > 6
      )
        fail(`Invalid building metadata ${b.id}`);
      if (
        !Array.isArray(b.footprint) ||
        b.footprint.length !== 2 ||
        b.footprint.some((v) => !amount(v) || v <= 0 || v > 32768)
      )
        fail(`Invalid footprint ${b.id}`);
      amounts(b.cost, `${b.id} cost`);
      if (!(b.cost?.money > 0)) fail(`Purchase must cost money ${b.id}`);
      if (
        !models.has(b.visual?.existingModelId) ||
        !d.models.includes(b.visual?.existingModelId)
      )
        fail(`Unknown model in ${b.id}`);
      if (
        !Array.isArray(b.visual?.styles) ||
        !b.visual.styles.length ||
        b.visual.styles.some((s) => typeof s !== "string" || !s)
      )
        fail(`Invalid styles ${b.id}`);
      if (
        b.maxLevel !== 10 ||
        !Array.isArray(b.specializations) ||
        b.specializations.length !== 4 ||
        new Set(b.specializations).size !== 4 ||
        b.specializations.some((v) => !STYLES.includes(v))
      )
        fail(`Invalid future upgrade metadata ${b.id}`);
      if (!tech.has(b.technology)) fail(`Unknown technology in ${b.id}`);
      if (b.researchRequirements !== undefined &&
        (!Array.isArray(b.researchRequirements) ||
          new Set(b.researchRequirements).size !== b.researchRequirements.length ||
          b.researchRequirements.some(id => typeof id !== 'string' || !ID.test(id))))
        fail(`Invalid research requirements ${b.id}`);
      if (
        !CLASSES.includes(b.logistics?.storageClass) ||
        !amount(b.logistics?.capacity) ||
        !amount(b.logistics?.throughputPerMinute) ||
        typeof b.logistics?.districtRequired !== "boolean"
      )
        fail(`Invalid logistics ${b.id}`);
      if (
        !["playable", "futureLocked", "definitionsOnly"].includes(
          b.availability,
        )
      )
        fail(`Invalid availability ${b.id}`);
      const op = b.operating;
      if (
        !op ||
        !amount(op.energy) ||
        op.energy <= 0 ||
        !Number.isInteger(op.workers) ||
        op.workers <= 0 ||
        !amount(op.upkeep) ||
        op.upkeep <= 0
      )
        fail(`Operation must require power, workers and upkeep ${b.id}`);
      if (
        !Array.isArray(b.recipes) ||
        b.recipes.length !== 1 ||
        !b.recipes[0] ||
        typeof b.recipes[0] !== "object" ||
        Array.isArray(b.recipes[0])
      ) {
        fail(`Exactly one fixed recipe is supported ${b.id}`);
        continue;
      }
      for (const r of b.recipes) {
        if(!Number.isSafeInteger(r.version)||r.version<1)fail(`Invalid recipe version ${b.id}`);
        if (!ID.test(r.id || "") || recipeIds.has(r.id))
          fail(`Duplicate or invalid recipe ${r.id}`);
        recipeIds.add(r.id);
        amounts(r.inputsPerMinute, `${b.id} inputs`);
        amounts(r.outputsPerMinute, `${b.id} outputs`, true);
        if (!tech.has(r.technology) || r.technology !== b.technology)
          fail(`Unknown or inconsistent recipe technology ${b.id}`);
        const inputs = Object.entries(r.inputsPerMinute || {})
            .filter(([, v]) => v > 0)
            .map(([k]) => k),
          outputs = Object.entries(r.outputsPerMinute || {})
            .filter(([, v]) => v > 0)
            .map(([k]) => k);
        if (!inputs.length && b.sector !== "mining")
          fail(`Only paid extraction may have no inputs ${b.id}`);
        if (outputs.includes("money"))
          fail(`Industrial recipes may not mint currency ${b.id}`);
        for (const k of outputs) {
          if (!producer.has(k)) producer.set(k, []);
          producer.get(k).push(b);
          if (
            d.materials.find((m) => m.id === k)?.storageClass !==
            b.logistics?.storageClass
          )
            fail(`Storage class mismatch ${b.id}`);
          for (const input of inputs) graph.get(input)?.add(k);
        }
      }
    }
    function acyclic(nodes, edges, label) {
      const done = new Set(),
        visiting = new Set(),
        order = [];
      function visit(id) {
        if (visiting.has(id)) {
          fail(`${label} cycle at ${id}`);
          return;
        }
        if (done.has(id)) return;
        visiting.add(id);
        for (const next of edges(id)) if (nodes.has(next)) visit(next);
        visiting.delete(id);
        done.add(id);
        order.push(id);
      }
      for (const id of nodes) visit(id);
      return order.reverse();
    }
    const topological = acyclic(
      materials,
      (id) => graph.get(id) || [],
      "Material dependency",
    );
    const byTech = new Map(d.technologies.map((t) => [t.id, t]));
    for (const t of d.technologies) {
      if (
        !Number.isInteger(t.era) ||
        t.era < 1 ||
        t.era > 6 ||
        typeof t.available !== "boolean" ||
        !Array.isArray(t.prerequisites)
      )
        fail(`Invalid technology ${t.id}`);
      for (const p of Array.isArray(t.prerequisites) ? t.prerequisites : []) {
        if (!tech.has(p)) fail(`Undefined technology prerequisite ${p}`);
        if (byTech.get(p)?.era > t.era)
          fail(`Backwards era prerequisite ${t.id}`);
      }
    }
    acyclic(
      tech,
      (id) =>
        Array.isArray(byTech.get(id)?.prerequisites)
          ? byTech.get(id).prerequisites
          : [],
      "Technology dependency",
    );
    for (const b of d.buildings) {
      if (byTech.get(b.technology)?.era !== b.era)
        fail(`Technology era mismatch ${b.id}`);
      if (b.availability === "playable") {
        if (
          b.sector === "defense" ||
          b.era > 2 ||
          !byTech.get(b.technology)?.available
        )
          fail(`Unavailable technology marked playable ${b.id}`);
        for (const k of [
          ...Object.keys(b.recipes?.[0]?.inputsPerMinute || {}),
          ...Object.keys(b.cost || {}).filter((k) => k !== "money"),
        ])
          if (
            !(producer.get(k) || []).some((p) => p.availability === "playable")
          )
            fail(`Unreachable playable input ${k} for ${b.id}`);
      }
    }
    for (const [s, count] of Object.entries(SECTORS))
      if (d.buildings.filter((b) => b.sector === s).length !== count)
        fail(`Wrong sector count ${s}`);
    if (d.buildings.length !== 140)
      fail("Exactly 140 industrial definitions are required for 0.4.2A");
    for (const id of ["money", "steel", "carbon", "iron", "concrete", "glass"])
      if (!materials.has(id)) fail(`Missing legacy resource ${id}`);
    return { valid: !errors.length, errors, topological };
  }
  const checked = validate(data);
  if (!checked.valid)
    throw Error("Invalid industrial catalog: " + checked.errors.join("; "));
  function freeze(v) {
    if (v && typeof v === "object") {
      Object.freeze(v);
      for (const x of Object.values(v)) freeze(x);
    }
    return v;
  }
  freeze(data);
  const materialById = new Map(data.materials.map((m) => [m.id, m])),
    buildingById = new Map(data.buildings.map((b) => [b.id, b])),
    aliases = new Map();
  for (const m of data.materials)
    for (const a of [m.id, ...(m.aliases || [])]) aliases.set(a, m.id);
  const api = {
    VERSION: 1,
    data,
    SECTORS,
    validate,
    materialIds: Object.freeze(data.materials.map((m) => m.id)),
    material: (id) => materialById.get(aliases.get(id) || id),
    building: (id) => buildingById.get(id),
    resolve: (id) => aliases.get(id) || null,
    topological: Object.freeze(checked.topological),
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.mapGameIndustrialRegistry = api;
})(typeof window !== "undefined" ? window : globalThis);
