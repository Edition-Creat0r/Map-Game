// Pure deterministic economy. Exact ledgers; guarded affine-cycle catch-up.
(function (root) {
  "use strict";
  const STEP_MS = 10000,
    LIMIT = 1e12,
    SCHEMA_VERSION = 3;
  const RESOURCES = ["money", "steel", "carbon", "iron", "concrete", "glass"];
  const Registry =
    typeof module !== "undefined"
      ? require("./industrial/registry.js")
      : root.mapGameIndustrialRegistry;
  if (!Registry) throw Error("Material registry must load before the economy");
  const MATERIALS = Registry.materialIds,
    materialSet = new Set(MATERIALS),
    legacySet = new Set(RESOURCES);
  const SCALE = 300000000000n,
    MAX = BigInt(LIMIT) * SCALE;
  const finite = (v, fallback = 0) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(LIMIT, Math.max(0, v))
      : fallback;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const min = (a, b) => (a < b ? a : b),
    max = (a, b) => (a > b ? a : b);
  function units(value) {
    if (!value) return 0n;
    const [mantissa, exp = "0"] = String(value).toLowerCase().split("e");
    const parts = mantissa.split("."),
      digits = BigInt(parts.join("")),
      shift = Number(exp) - (parts[1]?.length || 0);
    return shift >= 0
      ? digits * SCALE * 10n ** BigInt(shift)
      : (digits * SCALE) / 10n ** BigInt(-shift);
  }
  const number = (v) => Number(v / SCALE) + Number(v % SCALE) / Number(SCALE);
  const micro = (v) => (units(finite(v)) + 150000n) / 300000n;
  function balance(state, key) {
    const value =
      key === "population"
        ? state.economy.population
        : legacySet.has(key) || key === "totalEarned"
          ? state[key]
          : state.inventory?.[key];
    const saved = state.economy.precision?.[key];
    if (
      typeof saved === "string" &&
      saved.length <= 32 &&
      /^\d+$/.test(saved)
    ) {
      const exact = BigInt(saved);
      if (exact <= MAX && number(exact) === value) return exact;
    }
    return units(finite(value));
  }
  function write(state, key, value) {
    value = min(MAX, max(0n, value));
    state.economy.precision[key] = String(value);
    if (key === "population") state.economy.population = number(value);
    else if (legacySet.has(key) || key === "totalEarned")
      state[key] = number(value);
    else state.inventory[key] = number(value);
  }
  function normalize(raw = {}, now = 0, legacyBuildings = []) {
    const state = clone(raw),
      defaults = {
        money: 400000,
        steel: 100,
        carbon: 40,
        iron: 200,
        concrete: 500,
        glass: 180,
      };
    for (const key of RESOURCES)
      state[key] = raw[key] === undefined ? defaults[key] : finite(raw[key]);
    state.totalEarned = finite(raw.totalEarned);
    state.inventory = { ...(raw.inventory || {}) };
    for (const key of MATERIALS)
      if (!legacySet.has(key))
        state.inventory[key] = finite(raw.inventory?.[key]);
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
    if (
      old.version !== undefined &&
      (!Number.isInteger(old.version) ||
        old.version < 0 ||
        old.version > SCHEMA_VERSION)
    )
      throw Error("Unsupported economy save version");
    if (
      old.materialRegistryVersion !== undefined &&
      (!Number.isInteger(old.materialRegistryVersion) ||
        old.materialRegistryVersion < 0 ||
        old.materialRegistryVersion > Registry.VERSION)
    )
      throw Error("Unsupported material registry version");
    state.economy = {
      ...old,
      version: SCHEMA_VERSION,
      population: finite(old.population),
      lastTick:
        Number.isSafeInteger(old.lastTick) && old.lastTick >= 0
          ? old.lastTick
          : Number.isSafeInteger(raw.lastEconomyTick) &&
              raw.lastEconomyTick >= 0
            ? raw.lastEconomyTick
            : now,
      pendingMs: Math.min(STEP_MS - 1, Math.trunc(finite(old.pendingMs))),
      pendingBoostMs: Math.trunc(finite(old.pendingBoostMs)),
      revision: finite(old.revision),
      precision: { ...(old.precision || {}) },
      materialRegistryVersion: Registry.VERSION,
      rules: { ...(old.rules || {}) },
    };
    state.economy.pendingBoostMs = Math.min(
      state.economy.pendingMs,
      state.economy.pendingBoostMs,
    );
    for (const key of [...MATERIALS, "population", "totalEarned"])
      write(state, key, balance(state, key));
    state.lastEconomyTick = state.economy.lastTick;
    return state;
  }
  function rawDefinition(row, d) {
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
  function pinContract(state, row, def) {
    if (
      typeof row.economyContract === "string" &&
      Object.hasOwn(state.economy.rules, row.economyContract)
    )
      return;
    const key =
      (def.industrial
        ? `industrial-v${def.recipeVersion || Registry.VERSION}:`
        : row.legacyEconomy
          ? "legacy:"
          : "starter-v1:") + def.id;
    if (!state.economy.rules[key])
      state.economy.rules[key] = clone(rawDefinition(row, def));
    row.economyContract = key;
  }
  function bindContracts(state, catalog, oldVersion = SCHEMA_VERSION) {
    const defs = new Map(catalog.map((d) => [d.id, d]));
    for (const row of state.placedIncomeItems) {
      const d = defs.get(row.type);
      if (!d) continue;
      if (oldVersion < 3 && d.industrial) {
        row.economyUnavailable =
          "Unknown pre-catalog building retained inactive";
        continue;
      }
      pinContract(state, row, d);
    }
  }
  function definition(row, defs, state) {
    const d = defs.get(row.type);
    if (
      !d ||
      row.economyUnavailable ||
      (d.industrial && d.availability !== "playable")
    )
      return null;
    return typeof row.economyContract === "string" &&
      Object.hasOwn(state.economy.rules, row.economyContract)
      ? state.economy.rules[row.economyContract]
      : rawDefinition(row, d);
  }
  function compiled(state, catalog) {
    const defs = new Map(catalog.map((d) => [d.id, d])),
      templates = new Map();
    const entries = state.placedIncomeItems
      .map((row, order) => {
        const def = definition(row, defs, state);
        if (!def) return null;
        const level = row.level;
        const key = JSON.stringify([
          row.type,
          !!row.legacyEconomy,
          level,
          row.economyContract,
        ]);
        if (templates.has(key)) return { row, order, ...templates.get(key) };
        const entry = {
          row,
          order,
          def,
          power: finite(def.energyUse) * level,
          workers: finite(def.workforce) * level,
          supply: finite(def.energySupply) * level,
          housing: units(finite(def.housing) * level),
          growth: micro(finite(def.growth) * level),
          upkeep: micro(finite(def.upkeep) * level),
          inputs: Object.entries(def.inputs || {})
            .filter(([, v]) => v > 0)
            .map(([k, v]) => [k, micro(finite(v) * level)]),
          outputs: Object.entries(def.production || {})
            .filter(([, v]) => v > 0)
            .map(([k, v]) => [k, micro(finite(v) * level)]),
          invalidInput:
            [
              ...Object.entries(def.inputs || {}),
              ...Object.entries(def.production || {}),
            ].some(
              ([k, v]) => !materialSet.has(k) || !Number.isFinite(v) || v < 0,
            ) ||
            [
              "energyUse",
              "workforce",
              "upkeep",
              "growth",
              "housing",
              "energySupply",
            ].some(
              (k) =>
                def[k] !== undefined &&
                (!Number.isFinite(def[k]) || def[k] < 0),
            ),
        };
        const { row: ignoredRow, order: ignoredOrder, ...template } = entry;
        templates.set(key, template);
        return entry;
      })
      .filter(Boolean)
      .sort(
        (a, b) => Number(!!b.supply) - Number(!!a.supply) || a.order - b.order,
      );
    entries.frame = frame(entries);
    return entries;
  }
  function frame(entries) {
    const active = new Set(["money"]);
    for (const v of entries)
      for (const [key] of [...v.inputs, ...v.outputs])
        if (materialSet.has(key)) active.add(key);
    const resources = [
        "money",
        ...MATERIALS.filter((k) => k !== "money" && active.has(k)),
      ],
      keys = [...resources, "population"],
      indices = new Map(resources.map((k, i) => [k, i]));
    const slots = new Map();
    function indexed(list) {
      if (!slots.has(list))
        slots.set(
          list,
          list
            .filter(([k]) => indices.has(k))
            .map(([k, n]) => [indices.get(k), n]),
        );
      return slots.get(list);
    }
    for (const v of entries) {
      v.inputSlots = indexed(v.inputs);
      v.outputSlots = indexed(v.outputs);
    }
    return { resources, keys, pop: resources.length };
  }
  function evaluate(
    state,
    entries,
    duration = STEP_MS,
    boostMs = 0,
    details = true,
    trace = false,
  ) {
    const { keys, resources, pop } = entries.frame;
    const values = keys.map((k) => balance(state, k)),
      lower = keys.map(() => null),
      upper = keys.map(() => null);
    const use = resources.map(() => 0n),
      output = resources.map(() => 0n),
      rate = { money: 0, steel: 0, carbon: 0 },
      buildings = [],
      signature = [];
    const housing = entries.reduce((s, v) => s + v.housing, 0n),
      population = min(housing, values[pop]);
    let energySupply = state.economy.legacyUtilities ? 18 : 0,
      energyUsed = 0,
      workforceUsed = 0,
      growth = 0n;
    const workforce = Number((population * 3n) / (5n * SCALE)),
      elapsed = BigInt(duration) * 5n,
      throughput = elapsed + BigInt(boostMs);
    function guard(index, threshold) {
      const pass = values[index] >= threshold;
      if (trace) {
        if (pass)
          lower[index] =
            lower[index] === null ? threshold : max(lower[index], threshold);
        else
          upper[index] =
            upper[index] === null ? threshold : min(upper[index], threshold);
      }
      return pass;
    }
    for (const v of entries) {
      const costs = v.inputSlots.map(([i, n]) => [i, n * throughput]);
      const moneyCost = v.upkeep * elapsed;
      let finance = guard(0, use[0] + moneyCost),
        material = true;
      const shortages = details ? [] : null;
      for (const [i, n] of costs)
        if (!guard(i, use[i] + n + (i === 0 ? moneyCost : 0n))) {
          if (i === 0) finance = false;
          else {
            material = false;
            if (details)
              shortages.push({
                material: resources[i],
                required: number(n),
                available: number(max(0n, values[i] - use[i])),
              });
          }
        }
      if (v.workers > 0)
        guard(
          pop,
          (BigInt(Math.ceil(workforceUsed + v.workers)) * 5n * SCALE + 2n) / 3n,
        );
      let reason = "Operating";
      if (!finance) reason = "Insufficient money for upkeep";
      else if (v.invalidInput || !material)
        reason = "Insufficient input materials";
      else if (workforceUsed + v.workers > workforce)
        reason = "Insufficient workforce";
      else if (energyUsed + v.power > energySupply + v.supply)
        reason = "Insufficient energy";
      const operating = reason === "Operating";
      signature.push(operating ? "1" : "0");
      if (operating) {
        energySupply += v.supply;
        energyUsed += v.power;
        workforceUsed += v.workers;
        growth += v.growth * elapsed;
        use[0] += moneyCost;
        for (const [i, n] of costs) use[i] += n;
        for (const [i, n] of v.outputSlots) output[i] += n * throughput;
        for (const [key] of v.outputs)
          rate[key] =
            (rate[key] || 0) + finite(v.def.production[key]) * v.row.level;
      }
      if (details)
        buildings.push({
          id: v.row.id,
          type: v.row.type,
          operating,
          reason,
          ...(shortages?.length ? { shortages } : {}),
        });
    }
    const flow = output.map((v, i) => v - use[i]);
    flow.push(growth);
    const caps = [...resources.map(() => MAX), min(MAX, housing)],
      clamped = [];
    for (let i = 0; i < keys.length; i++) {
      const after = values[i] + flow[i];
      if (after >= caps[i]) {
        clamped.push(i);
        if (trace)
          lower[i] =
            lower[i] === null
              ? caps[i] - flow[i]
              : max(lower[i], caps[i] - flow[i]);
      } else if (trace)
        upper[i] =
          upper[i] === null
            ? caps[i] - flow[i]
            : min(upper[i], caps[i] - flow[i]);
    }
    const requestedEnergy = entries.reduce((s, v) => s + v.power, 0),
      requestedWorkforce = entries.reduce((s, v) => s + v.workers, 0);
    return {
      housing: number(housing),
      population: number(population),
      workforce,
      workforceUsed,
      requestedWorkforce,
      energySupply,
      energyUsed,
      requestedEnergy,
      energyDeficit: Math.max(0, requestedEnergy - energySupply),
      workforceDeficit: Math.max(0, requestedWorkforce - workforce),
      upkeep: (number(use[0]) * 60000) / duration,
      growth: (number(growth) * 60000) / duration,
      production: rate,
      buildings,
      keys,
      values,
      flow,
      caps,
      lower,
      upper,
      clamped,
      signature: signature.join(""),
      gross: output[0],
    };
  }
  function summary(state, defs, online = false) {
    const s = evaluate(
      state,
      compiled(state, defs),
      STEP_MS,
      online ? STEP_MS : 0,
    );
    const {
      keys,
      values,
      flow,
      caps,
      lower,
      upper,
      clamped,
      signature,
      gross,
      ...visible
    } = s;
    const known = new Set(visible.buildings.map((b) => b.id)),
      byId = new Map(defs.map((d) => [d.id, d]));
    for (const row of state.placedIncomeItems)
      if (!known.has(row.id))
        visible.buildings.push({
          id: row.id,
          type: row.type,
          operating: false,
          reason:
            row.economyUnavailable ||
            (!byId.has(row.type)
              ? "Unknown building retained inactive"
              : "Future-locked catalog entry"),
        });
    return visible;
  }
  function apply(state, s, count = 1) {
    const n = BigInt(count);
    for (let i = 0; i < s.keys.length; i++)
      write(state, s.keys[i], min(s.caps[i], s.values[i] + s.flow[i] * n));
    write(state, "totalEarned", balance(state, "totalEarned") + s.gross * n);
  }
  function repetitions(history, start, current, limit) {
    const delta = current.map((v, i) => v - history[start].values[i]);
    let count = BigInt(limit);
    for (let j = start; j < history.length; j++) {
      const step = history[j];
      if (step.clamped.some((i) => delta[i] !== 0n)) return { count: 0, delta };
      for (let i = 0; i < current.length; i++) {
        const base = step.values[i],
          d = delta[i],
          first = base + d,
          lo = step.lower[i],
          hi = step.upper[i];
        if ((lo !== null && first < lo) || (hi !== null && first >= hi))
          return { count: 0, delta };
        // Leave one boundary cycle to the exact evaluator, avoiding off-by-one jumps.
        if (d > 0n && hi !== null)
          count = min(count, max(0n, (hi - base) / d - 1n));
        if (d < 0n && lo !== null)
          count = min(count, max(0n, (base - lo) / -d - 1n));
      }
    }
    return { count: Number(count), delta };
  }
  function advance(state, now, online, defs, options = {}) {
    const e = state.economy;
    if (!Number.isSafeInteger(now) || now < 0)
      throw RangeError("Economy clock must be a nonnegative safe integer");
    if (now < e.lastTick)
      return {
        steps: 0,
        evaluations: 0,
        cyclesSkipped: 0,
        earned: 0,
        elapsedMinutes: 0,
        complete: true,
      };
    const elapsed = now - e.lastTick;
    if (e.pendingMs + elapsed < STEP_MS) {
      e.pendingMs += elapsed;
      e.pendingBoostMs += online ? elapsed : 0;
      e.lastTick = now;
      state.lastEconomyTick = now;
      return {
        steps: 0,
        evaluations: 0,
        cyclesSkipped: 0,
        earned: 0,
        elapsedMinutes: elapsed / 60000,
        complete: true,
      };
    }
    const entries = compiled(state, defs),
      before = state.money,
      origin = e.lastTick;
    let pending = e.pendingMs,
      boosted = e.pendingBoostMs,
      remaining = elapsed,
      steps = 0,
      evaluations = 0,
      cyclesSkipped = 0;
    const budget = Math.max(1, Math.trunc(options.maxEvaluations || 64)),
      history = [],
      seen = new Map();
    while (pending + remaining >= STEP_MS && evaluations < budget) {
      const needed = STEP_MS - pending,
        boostMs = boosted + (online ? needed : 0);
      const s = evaluate(state, entries, STEP_MS, boostMs, false, true);
      evaluations++;
      const ticks = Math.floor((pending + remaining) / STEP_MS),
        previous = seen.get(s.signature);
      if (options.accelerate !== false && !pending && previous !== undefined) {
        const period = history.length - previous,
          jump = repetitions(
            history,
            previous,
            s.values,
            Math.floor(ticks / period),
          );
        if (jump.count > 0) {
          const n = BigInt(jump.count);
          for (let i = 0; i < s.keys.length; i++)
            write(state, s.keys[i], s.values[i] + jump.delta[i] * n);
          const gross = history
            .slice(previous)
            .reduce((sum, t) => sum + t.gross, 0n);
          write(
            state,
            "totalEarned",
            balance(state, "totalEarned") + gross * n,
          );
          const skipped = jump.count * period;
          remaining -= skipped * STEP_MS;
          steps += skipped;
          cyclesSkipped += skipped;
          history.length = 0;
          seen.clear();
          continue;
        }
      }
      apply(state, s);
      remaining -= needed;
      pending = 0;
      boosted = 0;
      steps++;
      // The first mixed online/offline tick cannot define the following steady rate.
      if (boostMs === (online ? STEP_MS : 0)) {
        if (history.length >= 64) {
          history.length = 0;
          seen.clear();
        }
        seen.set(s.signature, history.length);
        history.push(s);
      }
    }
    const complete = pending + remaining < STEP_MS;
    if (complete) {
      e.pendingMs = pending + remaining;
      e.pendingBoostMs = boosted + (online ? remaining : 0);
      e.lastTick = now;
    } else {
      e.pendingMs = pending;
      e.pendingBoostMs = boosted;
      e.lastTick = origin + (elapsed - remaining);
    }
    state.lastEconomyTick = e.lastTick;
    return {
      steps,
      evaluations,
      cyclesSkipped,
      earned: state.money - before,
      elapsedMinutes: (e.lastTick - origin) / 60000,
      complete,
    };
  }
  function flushPending(state, defs) {
    const e = state.economy;
    if (e.pendingMs > 0)
      apply(
        state,
        evaluate(
          state,
          compiled(state, defs),
          e.pendingMs,
          e.pendingBoostMs,
          false,
        ),
      );
    e.pendingMs = 0;
    e.pendingBoostMs = 0;
  }
  function costEntries(cost) {
    if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
    const result = new Map();
    for (const [alias, v] of Object.entries(cost)) {
      const key = Registry.resolve(alias);
      if (
        !key ||
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        v > LIMIT
      )
        return null;
      result.set(key, (result.get(key) || 0n) + units(v));
    }
    return [...result];
  }
  function canAfford(state, cost) {
    const list = costEntries(cost);
    return !!list && list.every(([k, n]) => balance(state, k) >= n);
  }
  function spend(state, cost) {
    const list = costEntries(cost);
    if (!list || !list.every(([k, n]) => balance(state, k) >= n)) return false;
    for (const [k, n] of list) write(state, k, balance(state, k) - n);
    return true;
  }
  function credit(state, amount) {
    if (!Number.isFinite(amount) || amount < 0) return false;
    write(state, "money", balance(state, "money") + units(amount));
    write(state, "totalEarned", balance(state, "totalEarned") + units(amount));
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
    SCHEMA_VERSION,
    RESOURCES,
    MATERIALS,
    bindContracts,
    pinContract,
    quantity: (state, id) => {
      const k = Registry.resolve(id);
      return k ? number(balance(state, k)) : 0;
    },
    LIMIT,
    normalize,
    advance,
    flushPending,
    summary,
    canAfford,
    spend,
    credit,
    placement,
    clone,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.mapGameEconomyModel = api;
})(typeof window !== "undefined" ? window : globalThis);
