// Pure singleplayer simulation. No renderer, DOM, wall clock or storage access.
(function (root) {
  "use strict";
  const STEP_MS = 10000,
    CAP_MS = 12 * 60 * 60 * 1000,
    LIMIT = 1e12;
  const RESOURCES = ["money", "steel", "carbon", "iron", "concrete", "glass"];
  const finite = (v, fallback = 0) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(LIMIT, Math.max(0, v))
      : fallback;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function normalize(raw = {}, now = 0, legacyBuildings = []) {
    const state = clone(raw);
    for (const key of RESOURCES)
      state[key] =
        raw[key] === undefined
          ? {
              money: 400000,
              steel: 100,
              carbon: 40,
              iron: 200,
              concrete: 500,
              glass: 180,
            }[key]
          : finite(raw[key]);
    state.totalEarned = finite(raw.totalEarned);
    const seen = new Set();
    state.placedIncomeItems = [
      ...(Array.isArray(raw.placedIncomeItems) ? raw.placedIncomeItems : []),
      ...legacyBuildings,
    ]
      .filter(
        (v) =>
          v &&
          typeof v.id === "string" &&
          typeof v.type === "string" &&
          !seen.has(v.id) &&
          seen.add(v.id),
      )
      .map((v) => ({
        ...v,
        level: Math.max(1, Math.min(100, finite(v.level, 1))),
      }));
    const old = raw.economy || {};
    state.economy = {
      ...old,
      version: 1,
      population: finite(old.population),
      lastTick:
        Number.isFinite(old.lastTick) && old.lastTick >= 0
          ? old.lastTick
          : Number.isFinite(raw.lastEconomyTick) && raw.lastEconomyTick >= 0
            ? raw.lastEconomyTick
            : now,
      pendingMs: Math.min(STEP_MS - 1, finite(old.pendingMs)),
      pendingBoostMs: finite(old.pendingBoostMs),
      revision: finite(old.revision),
    };
    state.economy.pendingBoostMs = Math.min(
      state.economy.pendingMs,
      state.economy.pendingBoostMs,
    );
    state.lastEconomyTick = state.economy.lastTick;
    return state;
  }
  function definition(row, defs) {
    const d = defs.find((d) => d.id === row.type);
    if (!d) return null;
    return (
      (row.legacyEconomy ? d.legacyEconomy : d.economy) || {
        production: { money: finite(d.incomePerMin) },
        energyUse: finite(d.powerUse),
        energySupply: finite(d.powerSupply),
        housing: finite(d.population),
        workforce: 0,
        upkeep: 0,
        growth: finite(d.population) ? 2 : 0,
      }
    );
  }
  function compiled(state, defs) {
    return state.placedIncomeItems
      .map((row, order) => ({ row, order, def: definition(row, defs) }))
      .filter((v) => v.def)
      .sort(
        (a, b) =>
          Number(!!b.def.energySupply) - Number(!!a.def.energySupply) ||
          a.order - b.order,
      );
  }
  function evaluate(state, entries, minutes = 1 / 6, details = true) {
    const housing = entries.reduce(
      (s, v) => s + finite(v.def.housing) * v.row.level,
      0,
    );
    const population = Math.min(housing, state.economy.population);
    const workforce = Math.floor(population * 0.6 + 1e-9);
    let energySupply = 0,
      energyUsed = 0,
      workforceUsed = 0,
      upkeep = 0,
      growth = 0;
    const production = { money: 0, steel: 0, carbon: 0 },
      buildings = [];
    // Legacy saves retain their old starter utility allowance; new worlds build power.
    if (state.economy.legacyUtilities) energySupply = 18;
    const requestedEnergy = entries.reduce(
      (s, v) => s + finite(v.def.energyUse) * v.row.level,
      0,
    );
    const requestedWorkforce = entries.reduce(
      (s, v) => s + finite(v.def.workforce) * v.row.level,
      0,
    );
    for (const { row, def: d } of entries) {
      const level = row.level,
        power = finite(d.energyUse) * level,
        workers = finite(d.workforce) * level,
        expense = finite(d.upkeep) * level;
      let reason = "Operating";
      if ((upkeep + expense) * minutes > state.money + 1e-9)
        reason = "Insufficient money for upkeep";
      else if (workforceUsed + workers > workforce)
        reason = "Insufficient workforce";
      else if (
        energyUsed + power >
        energySupply + finite(d.energySupply) * level
      )
        reason = "Insufficient energy";
      const operating = reason === "Operating";
      if (operating) {
        energySupply += finite(d.energySupply) * level;
        energyUsed += power;
        workforceUsed += workers;
        upkeep += expense;
        growth += finite(d.growth) * level;
        for (const key of Object.keys(production))
          production[key] += finite(d.production?.[key]) * level;
      }
      if (details)
        buildings.push({ id: row.id, type: row.type, operating, reason });
    }
    return {
      housing,
      population,
      workforce,
      workforceUsed,
      requestedWorkforce,
      energySupply,
      energyUsed,
      requestedEnergy,
      energyDeficit: Math.max(0, requestedEnergy - energySupply),
      workforceDeficit: Math.max(0, requestedWorkforce - workforce),
      upkeep,
      growth,
      production,
      buildings,
    };
  }
  function summary(state, defs) {
    return evaluate(state, compiled(state, defs));
  }
  function advance(state, now, online, defs) {
    const e = state.economy,
      elapsed = Math.max(0, Math.min(CAP_MS, now - e.lastTick));
    if (!Number.isFinite(now) || now < e.lastTick)
      return { steps: 0, earned: 0, elapsedMinutes: 0 };
    const entries = compiled(state, defs),
      before = state.money;
    let pending = e.pendingMs,
      boosted = e.pendingBoostMs,
      remaining = elapsed,
      steps = 0;
    while (pending + remaining >= STEP_MS) {
      const needed = STEP_MS - pending;
      const boost = (boosted + (online ? needed : 0)) / STEP_MS;
      remaining -= needed;
      simulateStep(state, entries, STEP_MS, boost);
      pending = 0;
      boosted = 0;
      steps++;
    }
    e.pendingMs = pending + remaining;
    e.pendingBoostMs = boosted + (online ? remaining : 0);
    e.lastTick = now;
    state.lastEconomyTick = now;
    return {
      steps,
      earned: state.money - before,
      elapsedMinutes: elapsed / 60000,
    };
  }
  function simulateStep(state, entries, duration, boost) {
    const minutes = duration / 60000,
      s = evaluate(state, entries, minutes, false);
    state.money = Math.max(0, state.money - s.upkeep * minutes);
    for (const key of Object.keys(s.production))
      state[key] = finite(
        state[key] + s.production[key] * minutes * (1 + 0.2 * boost),
      );
    state.totalEarned = finite(
      state.totalEarned + s.production.money * minutes * (1 + 0.2 * boost),
    );
    const nextPopulation = finite(s.population + s.growth * minutes);
    state.economy.population =
      nextPopulation >= s.housing - 1e-9 ? s.housing : nextPopulation;
  }
  // Settle pre-event partial time using the old buildings/balances. New purchases
  // must never produce for time accrued before construction.
  function flushPending(state, defs) {
    const e = state.economy;
    if (e.pendingMs > 0)
      simulateStep(
        state,
        compiled(state, defs),
        e.pendingMs,
        e.pendingBoostMs / e.pendingMs,
      );
    e.pendingMs = 0;
    e.pendingBoostMs = 0;
  }
  function validCost(cost) {
    return (
      cost &&
      typeof cost === "object" &&
      Object.entries(cost).every(
        ([k, v]) =>
          RESOURCES.includes(k) &&
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= 0 &&
          v <= LIMIT,
      )
    );
  }
  function canAfford(state, cost) {
    return (
      !!validCost(cost) && Object.entries(cost).every(([k, v]) => state[k] >= v)
    );
  }
  function spend(state, cost) {
    if (!canAfford(state, cost)) return false;
    for (const [k, v] of Object.entries(cost)) state[k] -= v;
    return true;
  }
  function placement(state, def, data, terrain, exclusions = []) {
    const reasons = [];
    if (
      !data ||
      ![data.x, data.z, data.rotation ?? 0].every(Number.isFinite) ||
      !/^T_\d+_\d+$/.test(data.territoryId || "")
    )
      return { allowed: false, reasons: ["Invalid world coordinates"] };
    const [, tx, ty] = data.territoryId.split("_").map(Number);
    if (tx < 0 || tx >= 316 || ty < 0 || ty >= 316)
      reasons.push("Outside world");
    const angle = data.rotation || 0,
      c = Math.abs(Math.cos(angle)),
      s = Math.abs(Math.sin(angle));
    const [w, d] = def.footprint,
      width = w * c + d * s,
      depth = w * s + d * c;
    if (
      data.x - width / 2 < 0 ||
      data.x + width / 2 > 32768 ||
      data.z - depth / 2 < 0 ||
      data.z + depth / 2 > 32768
    )
      reasons.push("Footprint crosses territory border");
    for (const row of [...state.placedIncomeItems, ...exclusions]) {
      if (
        row.territoryId !== data.territoryId ||
        !Number.isFinite(row.x) ||
        !Number.isFinite(row.z)
      )
        continue;
      const fp = row.footprint || [40, 40],
        rc = Math.abs(Math.cos(row.rotation || 0)),
        rs = Math.abs(Math.sin(row.rotation || 0));
      if (
        Math.abs(row.x - data.x) * 2 < width + fp[0] * rc + fp[1] * rs + 4 &&
        Math.abs(row.z - data.z) * 2 < depth + fp[0] * rs + fp[1] * rc + 4
      ) {
        reasons.push(
          row.reserved
            ? "Existing capital reserves this site"
            : "Another building occupies this site",
        );
        break;
      }
    }
    if (!terrain) reasons.push("Authoritative terrain unavailable");
    else {
      const nx = Math.ceil(width / 16),
        nz = Math.ceil(depth / 16);
      for (let iz = 0; iz <= nz; iz++)
        for (let ix = 0; ix <= nx; ix++) {
          const sample = terrain.local(
            tx,
            ty,
            data.x - width / 2 + (ix * width) / nx,
            data.z - depth / 2 + (iz * depth) / nz,
          );
          if (sample.water || sample.buildability === "BLOCKED")
            reasons.push("Authoritative water blocks this footprint");
          if (sample.steepness > 0.54)
            reasons.push("Terrain too steep for starter construction");
        }
    }
    if (!canAfford(state, def.cost))
      reasons.push("Insufficient construction resources");
    return {
      allowed: !reasons.length,
      reasons: [...new Set(reasons)],
      width,
      depth,
    };
  }
  const api = {
    STEP_MS,
    CAP_MS,
    RESOURCES,
    LIMIT,
    normalize,
    advance,
    flushPending,
    summary,
    canAfford,
    spend,
    placement,
    clone,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.mapGameEconomyModel = api;
})(typeof window !== "undefined" ? window : globalThis);
