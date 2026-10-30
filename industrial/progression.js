// Pure Singleplayer progression policy. Never runs in terrain/forest loops.
(function (root) {
  "use strict";
  const node = typeof module !== "undefined",
    R = node ? require("./registry.js") : root.mapGameIndustrialRegistry,
    baseManifest = node
      ? require("./player-materials-data.js")
      : root.mapGamePlayerMaterials,
    extensions = node
      ? [require('./player-materials-042-data.js'), require('./player-materials-042a-data.js')]
      : [root.mapGamePlayerMaterials042, root.mapGamePlayerMaterials042A],
    research = node ? require("./research-data.js") : root.mapGameResearchData;
  function composeManifests(base, additions) {
    if (base?.version !== 1 || base.registryVersion !== 1 || base.materials?.length !== 100 || base.excluded?.length !== 21 || additions?.length !== 2)
      throw Error('Unsupported base/extension manifest');
    const ids = new Set([...base.materials, ...base.excluded].map(m => m.id));
    if (ids.size !== 121) throw Error('Duplicate base manifest ID');
    const all = [...base.materials];
    for (const [i, ext] of additions.entries()) {
      if (ext?.version !== 1 || ext.baseManifestVersion !== 1 || ext.id !== ['industrial-042','industrial-042a'][i] || ext.materials?.length !== [6,12][i])
        throw Error('Unsupported or out-of-order extension manifest');
      for (const m of ext.materials) {
        if (!m || typeof m.id !== 'string' || ids.has(m.id)) throw Error('Duplicate/invalid extension ID');
        ids.add(m.id); all.push(m);
      }
    }
    return {...base, version:2, materials:all, extensions:additions.map(e => e.id)};
  }
  const manifest = composeManifests(baseManifest, extensions);
  const priorResearchIds = new Set(['basicIndustry','miningRefining','constructionTechnology','electricity','urbanDevelopment','electronicsFoundations','industrialMachinery','advancedMetallurgy','precisionFabrication','industrialAutomation']);
  const eras = [
    "Settlement",
    "Industrialization",
    "Electrification",
    "Mass Production",
    "Information Age",
    "Global Superpower",
  ];
  const sectorResearch = {
    mining: "miningRefining",
    refining: "miningRefining",
    construction: "constructionTechnology",
    chemicals: "basicIndustry",
    electronics: "electronicsFoundations",
    machinery: "industrialMachinery",
    vehicles: "industrialMachinery",
    consumer: "urbanDevelopment",
    aerospace: "industrialMachinery",
  };
  const milestones = [
    { population: 0, factories: 0, research: null },
    { population: 10, factories: 2, research: "basicIndustry" },
    { population: 20, factories: 4, research: "electricity" },
    { population: 30, factories: 6, research: "industrialMachinery" },
    { population: 40, factories: 8, research: "electronicsFoundations" },
    { population: 50, factories: 10, research: "urbanDevelopment" },
  ];
  const byMaterial = new Map(manifest.materials.map((m) => [m.id, m])),
    byResearch = new Map(research.nodes.map((n) => [n.id, n]));
  function requiredResearch(d) {
    return [...new Set([sectorResearch[d.sector], ...(d.researchRequirements || [])].filter(Boolean))];
  }
  function requiredMaterials(d) {
    return [
      ...new Set([
        ...Object.keys(d.cost || {}),
        ...Object.keys(
          d.economy?.inputs || d.recipes?.[0].inputsPerMinute || {},
        ),
        ...Object.keys(
          d.economy?.production || d.recipes?.[0].outputsPerMinute || {},
        ),
      ]),
    ];
  }
  function validate(m = manifest, t = research, factoryCatalog = R.data.buildings) {
    const errors = [],
      factories = new Map(factoryCatalog.map(b => [b.id,b])),
      ids = new Set(),
      selected = new Map((m.materials || []).map((x) => [x.id, x]));
    if (
      t.version !== 1 ||
      m.version !== 2 ||
      m.registryVersion !== 1 ||
      m.materials?.length !== 118 ||
      m.excluded?.length !== 21
    )
      errors.push("Manifest counts/version");
    for (const x of [...(m.materials || []), ...(m.excluded || [])]) {
      if (!R.material(x.id) || ids.has(x.id))
        errors.push("Duplicate/undefined material " + x.id);
      ids.add(x.id);
    }
    if (ids.size !== R.materialIds.length) errors.push("Internal registry coverage");
    const starts = [
      "money",
      "steel",
      "carbon",
      "ironOre",
      "coal",
      "concrete",
      "glass",
      "silica",
      "copperOre",
      "limestone",
    ];
    const buckets = [10, 15, 28, 27, 23, 15];
    for (let i = 1; i <= 6; i++)
      if (
        m.materials.filter((x) => x.unlockEra === i).length !== buckets[i - 1]
      )
        errors.push("Era quota " + i);
    const tech = new Map(),
      done = new Set(),
      visiting = new Set();
    for (const n of t.nodes || []) {
      if (
        tech.has(n.id) ||
        !n.id ||
        !n.name ||
        !n.cost ||
        !Object.values(n.cost).every((x) => Number.isFinite(x) && x >= 0 && x <= 1e12 && Number.isInteger(x * 1e6)) ||
        Object.keys(n.cost).some((k) => !R.material(k)) ||
        (n.minimumEra !== undefined && (!Number.isInteger(n.minimumEra) || n.minimumEra < 1 || n.minimumEra > 6))
      )
        errors.push("Research definition " + n.id);
      tech.set(n.id, n);
    }
    function visit(id) {
      if (done.has(id)) return;
      if (visiting.has(id) || !tech.has(id)) {
        errors.push("Research DAG " + id);
        return;
      }
      visiting.add(id);
      for (const p of tech.get(id).prerequisites || []) visit(p);
      visiting.delete(id);
      done.add(id);
    }
    for (const n of t.nodes || []) {
      visit(n.id);
      if (n.minimumEra && Object.keys(n.cost || {}).some(id => (selected.get(id)?.unlockEra || 1) > n.minimumEra))
        errors.push('Later research cost ' + n.id);
      if ((n.prerequisites || []).some(id => (tech.get(id)?.minimumEra || 1) > (n.minimumEra || 1)))
        errors.push('Later research prerequisite ' + n.id);
      for (const id of n.effects?.buildings || []) {
        const b = factories.get(id);
        if (
          !b ||
          !requiredResearch(b).includes(n.id) ||
          !Object.keys(b.recipes[0].outputsPerMinute).every((id) =>
            selected.has(id),
          )
        )
          errors.push("Research factory effect " + id);
      }
      for (const id of n.effects?.materials || [])
        if (
          !selected.has(id) ||
          !selected.get(id).unlockRequirements.includes(n.id)
        )
          errors.push("Research effect " + id);
    }
    for (const x of m.materials || []) {
      if (
        x.visibility !== "progression" ||
        (x.unlockEra === 1) !== starts.includes(x.id) ||
        !Array.isArray(x.unlockRequirements) ||
        x.unlockRequirements.some((id) => !tech.has(id)) ||
        x.unlockRequirements.some((id) => (tech.get(id)?.minimumEra || 1) > x.unlockEra) ||
        (x.unlockEra === 1 && x.unlockRequirements.length)
      )
        errors.push("Unlock " + x.id);
      const b = factories.get(x.acquisition?.building);
      if (x.id === "money") {
        if (x.acquisition?.building !== "cornerStore")
          errors.push("Money acquisition");
        continue;
      }
      if (
        !b ||
        !Object.hasOwn(b.recipes[0].outputsPerMinute, x.id) ||
        b.availability === "definitionsOnly"
      )
        errors.push("Acquisition " + x.id);
      else
        for (const id of [
          ...Object.keys(b.cost),
          ...Object.keys(b.recipes[0].inputsPerMinute),
        ]) {
          if (!selected.has(id))
            errors.push("Missing acquisition dependency " + x.id + " → " + id);
          else if (
            selected.get(id).unlockEra > x.unlockEra &&
            x.unlockEra !== 1
          )
            errors.push("Later dependency " + x.id + " → " + id);
        }
    }
    for (const b of factoryCatalog)
      if (requiredResearch(b).some(id => !tech.has(id)) && b.availability !== 'definitionsOnly')
        errors.push('Undefined factory research ' + b.id);
    // Symbolic availability, not free stock grants. Include both research prices
    // and construction inputs so acyclic recipes alone cannot hide a deadlock.
    if (!errors.length) {
      const acquired = new Set(['money','steel','carbon','concrete','glass']), licensed = new Set();
      let changed = true;
      while (changed) {
        const previous = acquired.size + licensed.size;
        for (const n of t.nodes)
          if (n.prerequisites.every(id => licensed.has(id)) && Object.keys(n.cost).every(id => acquired.has(id))) licensed.add(n.id);
        for (const entry of m.materials) {
          const b = factories.get(entry.acquisition.building);
          if (!b || acquired.has(entry.id)) continue;
          if (entry.unlockRequirements.every(id => licensed.has(id)) && requiredResearch(b).every(id => licensed.has(id)) &&
            [...Object.keys(b.cost),...Object.keys(b.recipes[0].inputsPerMinute)].every(id => acquired.has(id))) acquired.add(entry.id);
        }
        changed = previous !== acquired.size + licensed.size;
      }
      if (acquired.size !== m.materials.length || licensed.size !== t.nodes.length)
        errors.push('Unreachable acquisition/research bootstrap');
    }
    return { valid: !errors.length, errors };
  }
  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const v of Object.values(value)) freeze(v);
      Object.freeze(value);
    }
    return value;
  }
  freeze(manifest);
  freeze(baseManifest);
  freeze(extensions);
  freeze(research);
  const checked = validate();
  if (!checked.valid) throw Error(checked.errors.join("; "));
  function checkSaved(p) {
    if (
      p &&
      (p.version !== 1 ||
        ![1,2].includes(p.manifestVersion) ||
        !Array.isArray(p.completed) ||
        p.completed.some(
          (id) =>
            !byResearch.has(id) || (p.manifestVersion === 1 && !priorResearchIds.has(id)) ||
            byResearch
              .get(id)
              .prerequisites.some((pre) => !p.completed.includes(pre)),
        ) ||
        new Set(p.completed).size !== p.completed.length ||
        !Array.isArray(p.legacyBuildings) ||
        p.legacyBuildings.some((id) => typeof id !== "string") ||
        !Array.isArray(p.legacyMaterials) ||
        p.legacyMaterials.some((id) => !R.material(id)) ||
        !Number.isInteger(p.era) ||
        p.era < 1 ||
        p.era > 6 ||
        !p.priorities ||
        !["manual", "automatic"].includes(p.priorities.mode) ||
        !Array.isArray(p.priorities.order) ||
        p.priorities.order.some((id) => typeof id !== "string"))
    )
      throw Error("Unsupported or invalid progression save; original retained");
  }
  function init(state, defs, { legacy = false } = {}) {
    if (state.economy.progression) {
      checkSaved(state.economy.progression);
      // Detach saved arrays/unknown JSON fields before later research mutates
      // completed. normalize() deliberately preserves the caller's input.
      state.economy.progression = JSON.parse(JSON.stringify({...state.economy.progression, manifestVersion:2}));
      return;
    }
    const capabilities = new Set(),
      legacyBuildings = new Set();
    if (legacy) {
      for (const id of R.materialIds) {
        const n = state[id] ?? state.inventory?.[id] ?? 0;
        if (n > 0) capabilities.add(id);
      }
      const lookup = new Map(defs.map((d) => [d.id, d]));
      for (const row of state.placedIncomeItems) {
        const d = lookup.get(row.type);
        if (
          d &&
          !row.economyUnavailable &&
          (!d.industrial || d.availability === "playable") &&
          !legacyBuildings.has(d.id)
        ) {
          legacyBuildings.add(d.id);
          for (const id of requiredMaterials(d)) capabilities.add(id);
        }
      }
    }
    state.economy.progression = {
      version: 1,
      manifestVersion: 2,
      era: 1,
      completed: [],
      legacyMaterials: [...capabilities].sort(),
      legacyBuildings: [...legacyBuildings].sort(),
      priorities: { mode: "manual", order: [] },
    };
  }
  function refresh(state) {
    const p = state.economy.progression;
    if (!p) return;
    const count = state.placedIncomeItems.filter(
      (r) => !r.economyUnavailable,
    ).length;
    while (p.era < 6) {
      const m = milestones[p.era];
      if (
        state.economy.population < m.population ||
        count < m.factories ||
        !p.completed.includes(m.research)
      )
        break;
      p.era++;
    }
  }
  function unlocked(state, id) {
    const p = state.economy.progression;
    if (!p) return true;
    const m = byMaterial.get(id);
    return (
      p.legacyMaterials.includes(id) ||
      !!(
        m &&
        m.unlockEra <= p.era &&
        m.unlockRequirements.every((id) => p.completed.includes(id))
      )
    );
  }
  function reason(state, d) {
    if (!d?.economy) return "Not an economy building";
    const p = state.economy.progression;
    if (!p)
      return d.industrial && d.availability !== "playable"
        ? "Future content"
        : "";
    if (!d.industrial) return "";
    if (d.availability === "definitionsOnly" || d.sector === "defense")
      return "Future defense content — not purchasable";
    if (p.legacyBuildings?.includes(d.id)) return "";
    if (
      !Object.keys(d.economy.production || {}).every((id) => byMaterial.has(id))
    )
      return "Future specialized content — preserved internally";
    const locked = requiredMaterials(d).filter((id) => !unlocked(state, id));
    if (locked.length)
      return (
        "Unlock materials: " +
        locked.map((id) => R.material(id).name).join(", ")
      );
    const tech = requiredResearch(d).find(id => !p.completed.includes(id));
    if (tech) return "Research " + byResearch.get(tech).name;
    return "";
  }
  function researchReason(state, id) {
    const p = state.economy.progression,
      n = byResearch.get(id);
    if (!p || !n) return "Unknown research";
    if (p.completed.includes(id)) return "Completed";
    if (p.era < (n.minimumEra || 1)) return 'Requires era: ' + eras[n.minimumEra - 1];
    const missing = n.prerequisites.filter((id) => !p.completed.includes(id));
    return missing.length
      ? "Requires " + missing.map((id) => byResearch.get(id).name).join(", ")
      : "";
  }
  function complete(state, id, model) {
    const p = state.economy.progression,
      n = byResearch.get(id);
    if (!p || !n) return false;
    if (p.completed.includes(id)) return true;
    if (researchReason(state, id) || !model.spend(state, n.cost)) return false;
    p.completed.push(id);
    refresh(state);
    return true;
  }
  function priorities(state, defs, mode, model) {
    if (!["manual", "automatic"].includes(mode) || !state.economy.progression)
      return false;
    const p = state.economy.progression,
      lookup = new Map(defs.map((d) => [d.id, d])),
      rows = state.placedIncomeItems;
    const ranked = rows
      .map((row, i) => {
        const d = lookup.get(row.type),
          r = state.economy.rules[row.economyContract] || d?.economy || {};
        const inputs = Object.entries(r.inputs || {});
        const ready = inputs.every(
          ([k, n]) => model.quantity(state, k) >= n / 5,
        );
        const utility = r.energySupply
          ? 0
          : r.housing
            ? 1
            : r.production?.money
              ? 2
              : ready
                ? 3
                : 4;
        return {
          id: row.id,
          i,
          utility,
          burden: (r.workforce || 0) + (r.energyUse || 0) + (r.upkeep || 0),
          inputs: inputs.length,
        };
      })
      .sort(
        (a, b) =>
          a.utility - b.utility ||
          a.inputs - b.inputs ||
          a.burden - b.burden ||
          a.i - b.i,
      );
    p.priorities = {
      ...p.priorities,
      mode,
      order: mode === "automatic" ? ranked.map((r) => r.id) : [],
    };
    return true;
  }
  function nextGoal(state) {
    const built = new Set(state.placedIncomeItems.map((r) => r.type));
    if (!built.has("smallHouse"))
      return "Build Residential housing — needs 1 electricity; provides 20 housing";
    if (!built.has("powerPlant"))
      return "Build a Small Power Plant — supplies 40 electricity";
    if (!built.has("cornerStore"))
      return "Build Commercial income — needs 4 workers and 3 electricity";
    const p = state.economy.progression;
    if (!p) return "Start Singleplayer";
    const next = research.nodes.find(
      (n) => !p.completed.includes(n.id) && !researchReason(state, n.id),
    );
    if (next) return "Research " + next.name + " — " + costLabel(next.cost);
    const m = milestones[p.era];
    if (m) {
      if (state.economy.population < m.population)
        return "Grow to " + m.population + " residents — build powered housing";
      if (state.placedIncomeItems.length < m.factories)
        return (
          "Construct " + m.factories + " buildings, including housing and power"
        );
    }
    return "Expand industry — keep workers, power and recipe inputs available";
  }
  // Reserved interface only. No economy write or reward callback exists.
  const officialMinigames = Object.freeze({
    version: 1,
    enabled: false,
    authority: "future server-validated official events only",
    playerCreatedRewards: false,
  });
  function costLabel(cost) {
    return Object.entries(cost).map(([id,n]) => id === 'money' ? '$'+n : n+' '+R.material(id).name).join(' + ');
  }
  const effectByResearch = new Map(research.nodes.map(n => [n.id, freeze({
    materials: manifest.materials.filter(m => m.unlockRequirements.includes(n.id)).map(m => m.id),
    buildings: R.data.buildings.filter(b => b.availability !== 'definitionsOnly' && requiredResearch(b).includes(n.id) && Object.keys(b.recipes[0].outputsPerMinute).every(id => byMaterial.has(id))).map(b => b.id),
    eras: n.effects?.eras || []
  })]));
  const api = {
    VERSION: 1,
    manifest,
    baseManifest,
    extensions,
    composeManifests,
    costLabel,
    effects: id => effectByResearch.get(id),
    research,
    eras,
    milestones,
    validate,
    checkSaved,
    init,
    refresh,
    unlocked,
    reason,
    researchReason,
    complete,
    priorities,
    nextGoal,
    officialMinigames,
  };
  if (node) module.exports = api;
  else root.mapGameProgression = api;
})(globalThis);
