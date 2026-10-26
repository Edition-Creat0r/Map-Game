// Pure deterministic economy. Exact ledgers; guarded affine-cycle catch-up.
(function (root) {
  "use strict";
  const STEP_MS = 10000,
    LIMIT = 1e12,
    SCHEMA_VERSION = 2;
  const RESOURCES = ["money", "steel", "carbon", "iron", "concrete", "glass"];
  const KEYS = [...RESOURCES, "population"];
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
    const value = key === "population" ? state.economy.population : state[key];
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
    else state[key] = number(value);
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
    };
    state.economy.pendingBoostMs = Math.min(
      state.economy.pendingMs,
      state.economy.pendingBoostMs,
    );
    for (const key of [...KEYS, "totalEarned"])
      write(state, key, balance(state, key));
    state.lastEconomyTick = state.economy.lastTick;
    return state;
  }
  function definition(row, defs) {
    const d = defs.get(row.type);
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
  function compiled(state, catalog) {
    const defs = new Map(catalog.map((d) => [d.id, d])),
      templates = new Map();
    return state.placedIncomeItems
      .map((row, order) => {
        const def = definition(row, defs);
        if (!def) return null;
        const level = row.level;
        const key = JSON.stringify([row.type, !!row.legacyEconomy, level]);
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
          inputs: RESOURCES.map((k) => micro(finite(def.inputs?.[k]) * level)),
          outputs: RESOURCES.map((k) =>
            micro(finite(def.production?.[k]) * level),
          ),
          invalidInput: Object.keys(def.inputs || {}).some(
            (k) => !RESOURCES.includes(k),
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
  }
  function evaluate(
    state,
    entries,
    duration = STEP_MS,
    boostMs = 0,
    details = true,
    trace = false,
  ) {
    const values = KEYS.map((k) => balance(state, k)),
      lower = KEYS.map(() => null),
      upper = KEYS.map(() => null);
    const use = RESOURCES.map(() => 0n),
      output = RESOURCES.map(() => 0n),
      rate = { money: 0, steel: 0, carbon: 0 },
      buildings = [],
      signature = [];
    const housing = entries.reduce((s, v) => s + v.housing, 0n),
      population = min(housing, values[6]);
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
      const costs = v.inputs.map((n) => n * throughput);
      costs[0] += v.upkeep * elapsed;
      let finance = true,
        material = true;
      for (let i = 0; i < 6; i++)
        if (costs[i] > 0n) {
          const ok = guard(i, use[i] + costs[i]);
          if (!ok) {
            if (i === 0) finance = false;
            else material = false;
          }
        }
      if (v.workers > 0)
        guard(
          6,
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
        for (let i = 0; i < 6; i++) {
          use[i] += costs[i];
          output[i] += v.outputs[i] * throughput;
        }
        for (const k of Object.keys(rate))
          rate[k] += finite(v.def.production?.[k]) * v.row.level;
      }
      if (details)
        buildings.push({ id: v.row.id, type: v.row.type, operating, reason });
    }
    const flow = output.map((v, i) => v - use[i]);
    flow.push(growth);
    const caps = [...RESOURCES.map(() => MAX), min(MAX, housing)],
      clamped = [];
    for (let i = 0; i < 7; i++) {
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
    return visible;
  }
  function apply(state, s, count = 1) {
    const n = BigInt(count);
    for (let i = 0; i < 7; i++)
      write(state, KEYS[i], min(s.caps[i], s.values[i] + s.flow[i] * n));
    write(state, "totalEarned", balance(state, "totalEarned") + s.gross * n);
  }
  function repetitions(history, start, current, limit) {
    const delta = current.map((v, i) => v - history[start].values[i]);
    let count = BigInt(limit);
    for (let j = start; j < history.length; j++) {
      const step = history[j];
      if (step.clamped.some((i) => delta[i] !== 0n)) return { count: 0, delta };
      for (let i = 0; i < 7; i++) {
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
          for (let i = 0; i < 7; i++)
            write(state, KEYS[i], s.values[i] + jump.delta[i] * n);
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
      !!validCost(cost) &&
      Object.entries(cost).every(([k, v]) => balance(state, k) >= units(v))
    );
  }
  function spend(state, cost) {
    if (!canAfford(state, cost)) return false;
    for (const [k, v] of Object.entries(cost))
      write(state, k, balance(state, k) - units(v));
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
