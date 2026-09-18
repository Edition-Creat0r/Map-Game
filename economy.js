// ============================================================
// MAP GAME — economy.js
// Alpha 0.2.1E
//
// Singleplayer/local economy foundation.
// Offline $/min == online $/min exactly.
// Offline time is capped at 12 hours to keep saves balanced.
//
// Central World economy must later be server authoritative.
// ============================================================

(() => {
  "use strict";

  const SAVE_KEY = "mapgame_economy_021e";
  const OFFLINE_CAP_MINUTES = 12 * 60;

  const DEFAULT = {
    money: 400000,
    iron: 200,
    steel: 100,
    concrete: 500,
    glass: 180,
    placedIncomeItems: [],
    lastEconomyTick: Date.now(),
    totalEarned: 0
  };

  let state = load();
  let lastTick = Date.now();
  let tickTimer = null;
  let listeners = new Set();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return {
        ...DEFAULT,
        ...raw,
        placedIncomeItems: Array.isArray(raw.placedIncomeItems)
          ? raw.placedIncomeItems
          : []
      };
    } catch (_) {
      return { ...DEFAULT };
    }
  }

  function save() {
    state.lastEconomyTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function catalog() {
    return window.mapGameBuildings?.CATALOG || [];
  }

  function utilitySummary() {
    const defs = catalog();
    let powerSupply = 18;
    let waterSupply = 16;
    let cleanAirSupply = 28;
    let powerDemand = 0;
    let waterDemand = 0;
    let pollution = 0;

    for (const placed of state.placedIncomeItems) {
      const def = defs.find(v => v.id === placed.type);
      if (!def) continue;
      const level = Number(placed.level || 1);

      powerSupply += Number(def.powerSupply || 0) * level;
      waterSupply += Number(def.waterSupply || 0) * level;
      cleanAirSupply += Number(def.cleanAirSupply || 0) * level;

      powerDemand += Number(def.powerUse || 0) * level;
      waterDemand += Number(def.waterUse || 0) * level;
      pollution += Number(def.pollution || 0) * level;
    }

    const cleanAirDemand = Math.max(0, pollution);
    const powerRatio = powerDemand <= 0 ? 1 : Math.min(1, powerSupply / powerDemand);
    const waterRatio = waterDemand <= 0 ? 1 : Math.min(1, waterSupply / waterDemand);
    const airRatio = cleanAirDemand <= 0 ? 1 : Math.min(1, cleanAirSupply / cleanAirDemand);

    return {
      powerSupply,
      waterSupply,
      cleanAirSupply,
      powerDemand,
      waterDemand,
      pollution,
      cleanAirDemand,
      powerRatio,
      waterRatio,
      airRatio,
      operationalRatio: Math.min(powerRatio, waterRatio, airRatio)
    };
  }

  function buildingOperationalRatio(def, summary) {
    if (!def) return 0;
    let ratio = 1;
    if (Number(def.powerUse || 0) > 0) ratio = Math.min(ratio, summary.powerRatio);
    if (Number(def.waterUse || 0) > 0) ratio = Math.min(ratio, summary.waterRatio);
    if (Number(def.pollution || 0) > 0) ratio = Math.min(ratio, summary.airRatio);
    return Math.max(0, Math.min(1, ratio));
  }

  function incomePerMinute() {
    const defs = catalog();
    const summary = utilitySummary();
    let total = 0;

    for (const placed of state.placedIncomeItems) {
      const def = defs.find(v => v.id === placed.type);
      if (!def) continue;

      const level = Number(placed.level || 1);
      total +=
        Number(def.incomePerMin || 0) *
        level *
        buildingOperationalRatio(def, summary);
    }

    return total;
  }

  function emit() {
    const snap = snapshot();
    listeners.forEach(fn => {
      try { fn(snap); } catch (_) {}
    });
    window.dispatchEvent(
      new CustomEvent("mapgame:economy", { detail: snap })
    );
  }

  function snapshot() {
    return {
      ...state,
      incomePerMin: incomePerMinute(),
      utilities: utilitySummary()
    };
  }

  function credit(amount) {
    const v = Math.max(0, Number(amount) || 0);
    state.money += v;
    state.totalEarned += v;
  }

  function debit(amount) {
    const v = Math.max(0, Number(amount) || 0);
    if (state.money < v) return false;
    state.money -= v;
    return true;
  }

  function applyOfflineIncome() {
    const now = Date.now();
    const last = Number(state.lastEconomyTick || now);
    const elapsedMinutes = Math.max(
      0,
      Math.min(
        OFFLINE_CAP_MINUTES,
        (now - last) / 60000
      )
    );

    const rate = incomePerMinute();
    const earned = rate * elapsedMinutes;

    if (earned > 0) {
      credit(earned);
    }

    state.lastEconomyTick = now;
    save();
    emit();

    return {
      elapsedMinutes,
      rate,
      earned
    };
  }

  function tick() {
    const now = Date.now();
    const elapsedMinutes = Math.max(0, (now - lastTick) / 60000);
    lastTick = now;

    const rate = incomePerMinute();
    if (rate > 0 && elapsedMinutes > 0) {
      // Exact same formula used offline:
      // $/min * elapsed minutes.
      credit(rate * elapsedMinutes);
    }

    save();
    emit();
  }

  function start() {
    if (tickTimer) return;
    lastTick = Date.now();
    tickTimer = setInterval(tick, 1000);
  }

  function stop() {
    if (!tickTimer) return;
    clearInterval(tickTimer);
    tickTimer = null;
    save();
  }

  function registerPlacedBuilding(type, id, level = 1) {
    const def = catalog().find(v => v.id === type);
    if (!def) return false;
    if (state.placedIncomeItems.some(v => v.id === id)) return true;

    state.placedIncomeItems.push({
      id,
      type,
      level,
      createdAt: Date.now()
    });

    save();
    emit();
    return true;
  }

  function removePlacedBuilding(id) {
    const before = state.placedIncomeItems.length;
    state.placedIncomeItems =
      state.placedIncomeItems.filter(v => v.id !== id);
    if (state.placedIncomeItems.length !== before) {
      save();
      emit();
      return true;
    }
    return false;
  }

  function canAfford(cost = {}) {
    for (const [key, value] of Object.entries(cost)) {
      if ((state[key] || 0) < Number(value || 0)) return false;
    }
    return true;
  }

  function spend(cost = {}) {
    if (!canAfford(cost)) return false;
    for (const [key, value] of Object.entries(cost)) {
      state[key] = Math.max(
        0,
        Number(state[key] || 0) - Number(value || 0)
      );
    }
    save();
    emit();
    return true;
  }

  function purchaseAndRegisterBuilding(def, buildingData) {
    if (!def || !buildingData?.id) return false;
    if (!spend(def.cost || {})) return false;

    state.placedIncomeItems.push({
      id: buildingData.id,
      type: def.id,
      level: Number(buildingData.level || 1),
      territoryId: buildingData.territoryId || null,
      x: Number(buildingData.x || 0),
      z: Number(buildingData.z || 0),
      rotation: Number(buildingData.rotation || 0),
      variant: Number(buildingData.variant || 0),
      createdAt: Date.now()
    });

    save();
    emit();
    return true;
  }

  function listPlacedBuildings(territoryId = null) {
    return state.placedIncomeItems.filter(v =>
      !territoryId || v.territoryId === territoryId
    );
  }

  function subscribe(fn) {
    listeners.add(fn);
    fn(snapshot());
    return () => listeners.delete(fn);
  }

  window.mapGameEconomy = {
    VERSION: "0.2.1F",
    OFFLINE_CAP_MINUTES,
    snapshot,
    incomePerMinute,
    applyOfflineIncome,
    start,
    stop,
    registerPlacedBuilding,
    removePlacedBuilding,
    purchaseAndRegisterBuilding,
    listPlacedBuildings,
    utilitySummary,
    canAfford,
    spend,
    credit,
    debit,
    subscribe,
    save
  };

  window.addEventListener("beforeunload", save);
  console.log("Map Game economy 0.2.1F ready.");
})();
