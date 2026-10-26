// Singleplayer economy adapter. One canonical, versioned localStorage transaction.
(() => {
  "use strict";
  const Model = window.mapGameEconomyModel,
    SAVE_KEY = "mapgame_economy_021e",
    WORLD_KEY = "mapGame_alpha021_firstPlayable";
  let requested = false,
    releaseWriter = null;
  let state,
    stored,
    timer = null,
    enabled = false,
    error = "",
    online = false,
    offlineResult = { earned: 0, elapsedMinutes: 0, rate: 0 };
  const listeners = new Set(),
    catalog = () => window.mapGameBuildings?.CATALOG || [];
  function readState() {
    try {
      stored = localStorage.getItem(SAVE_KEY);
      const raw = JSON.parse(stored || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw Error("Invalid economy save");
      if (raw.economy?.version > 1)
        throw Error("Economy save is from a newer version");
      let legacy = [];
      try {
        legacy =
          JSON.parse(localStorage.getItem(WORLD_KEY) || "{}").buildings || [];
      } catch (_) {}
      if (!Array.isArray(legacy) || raw.economy) legacy = [];
      state = Model.normalize(raw, Date.now(), legacy);
      // Keep inherited utility support only for populated legacy saves.
      if (!raw.economy && state.placedIncomeItems.length) {
        state.economy.legacyUtilities = true;
        for (const row of state.placedIncomeItems) row.legacyEconomy = true;
        state.economy.population = state.placedIncomeItems.reduce(
          (sum, row) =>
            sum +
            (catalog().find((d) => d.id === row.type)?.population || 0) *
              row.level,
          0,
        );
      }
      error = "";
      for (const row of state.placedIncomeItems)
        if (!row.footprint)
          row.footprint = (
            catalog().find((v) => v.id === row.type)?.footprint || [40, 40]
          ).slice();
    } catch (e) {
      error = `Economy save cannot be opened: ${e.message}. Original data has been retained.`;
      state = Model.normalize({}, Date.now());
    }
  }
  readState();
  function snapshot() {
    const snap = Model.clone(state),
      s = Model.summary(state, catalog());
    return {
      ...snap,
      enabled: enabled && !error,
      error,
      incomePerMin:
        enabled && !error ? s.production.money * (online ? 1.2 : 1) : 0,
      summary: s,
      utilities: {
        powerSupply: s.energySupply,
        powerDemand: s.requestedEnergy,
        waterSupply: 0,
        waterDemand: 0,
        cleanAirSupply: 0,
        cleanAirDemand: 0,
      },
    };
  }
  function emit() {
    const snap = snapshot();
    for (const fn of listeners) {
      try {
        fn(snap);
      } catch (e) {
        console.error("Economy UI:", e);
      }
    }
    window.dispatchEvent(new CustomEvent("mapgame:economy", { detail: snap }));
  }
  function transaction(change) {
    if (!enabled || error) return false;
    const previous = state;
    state = Model.clone(state);
    try {
      if (localStorage.getItem(SAVE_KEY) !== stored)
        throw Error(
          "Another tab changed this economy. Reload before continuing",
        );
      const result = change(state);
      if (result === false) {
        state = previous;
        return false;
      }
      state.economy.revision++;
      const serialized = JSON.stringify(state);
      localStorage.setItem(SAVE_KEY, serialized);
      stored = serialized;
      return result ?? true;
    } catch (e) {
      state = previous;
      error = `Economy paused: ${e.message}`;
      return false;
    }
  }
  function activeOnline() {
    return enabled && !document.hidden;
  }
  function settle() {
    if (!enabled || error) return false;
    const now = Date.now();
    const result = transaction((s) =>
      Model.advance(
        s,
        now,
        online && now - s.economy.lastTick <= 60000,
        catalog(),
      ),
    );
    online = activeOnline();
    return result;
  }
  function setEnabled(value) {
    if (requested === !!value) return;
    requested = !!value;
    if (!requested) {
      if (enabled) settle();
      enabled = false;
      online = false;
      clearInterval(timer);
      timer = null;
      if (releaseWriter) {
        releaseWriter();
        releaseWriter = null;
      }
      emit();
      return;
    }
    if (error) {
      emit();
      return;
    }
    if (!navigator.locks) {
      error =
        "Economy paused: this browser needs Web Locks on a secure origin to protect local saves.";
      emit();
      return;
    }
    navigator.locks
      .request(
        "mapgame-singleplayer-economy-writer",
        { ifAvailable: true },
        async (lock) => {
          if (!requested) return;
          if (!lock) {
            error =
              "Economy is open in another tab. Close that tab and reload here.";
            emit();
            return;
          }
          // The tab may have sat on Home while the previous writer finished.
          // Read the latest canonical record only after acquiring the lease.
          readState();
          if (error) {
            emit();
            return;
          }
          enabled = true;
          const result = transaction((s) =>
            Model.advance(s, Date.now(), false, catalog()),
          );
          offlineResult = {
            ...(result || {}),
            rate: Model.summary(state, catalog()).production.money,
          };
          online = activeOnline();
          timer = setInterval(() => {
            settle();
            emit();
          }, 1000);
          emit();
          await new Promise((resolve) => {
            releaseWriter = resolve;
          });
        },
      )
      .catch((e) => {
        error = `Economy paused: ${e.message}`;
        enabled = false;
        emit();
      });
  }
  function purchaseAndRegisterBuilding(def, data) {
    if (!enabled || error || !def || typeof data?.id !== "string" || !data.id)
      return false;
    // IDs are transaction identities: replays never charge or create twice.
    const prior = state.placedIncomeItems.find((v) => v.id === data.id);
    if (prior)
      return (
        prior.type === def.id &&
        prior.territoryId === data.territoryId &&
        prior.x === data.x &&
        prior.z === data.z &&
        (prior.rotation || 0) === (data.rotation || 0)
      );
    const actual = catalog().find((v) => v.id === def.id && v.economy);
    if (!actual) return false;
    settle();
    const result = transaction((s) => {
      Model.flushPending(s, catalog());
      if (
        !Model.placement(
          s,
          actual,
          data,
          window.mapGameSharedTerrain,
          reservedSites(),
        ).allowed
      )
        return false;
      if (!Model.spend(s, actual.cost)) return false;
      s.placedIncomeItems.push({
        ...data,
        type: actual.id,
        footprint: actual.footprint.slice(),
        level: 1,
        createdAt: Date.now(),
      });
      return true;
    });
    emit();
    return !!result;
  }
  function listPlacedBuildings(id = null) {
    return Model.clone(
      state.placedIncomeItems.filter((v) => !id || v.territoryId === id),
    );
  }
  let worldRecord,
    exclusions = [];
  function reservedSites() {
    const record = localStorage.getItem(WORLD_KEY);
    if (record !== worldRecord) {
      worldRecord = record;
      exclusions = [];
      try {
        const capital = JSON.parse(record || "{}").capital;
        if (capital && Number.isFinite(capital.x) && Number.isFinite(capital.z))
          exclusions = [
            {
              ...capital,
              territoryId: capital.territoryId || capital.territory_id,
              footprint: [150, 150],
              rotation: 0,
              reserved: true,
            },
          ];
      } catch (_) {}
    }
    return exclusions;
  }
  function checkPlacement(def, data) {
    if (!enabled || error)
      return {
        allowed: false,
        reasons: [error || "Economy construction is Singleplayer only"],
      };
    return Model.placement(
      state,
      def,
      data,
      window.mapGameSharedTerrain,
      reservedSites(),
    );
  }
  function spend(cost) {
    settle();
    const result = transaction((s) => {
      Model.flushPending(s, catalog());
      return Model.spend(s, cost);
    });
    emit();
    return !!result;
  }
  function credit(amount, legacyAmount) {
    // The road tool historically calls credit("money", amount).
    if (amount === "money") amount = legacyAmount;
    if (!Number.isFinite(amount) || amount < 0) return false;
    settle();
    const result = transaction((s) => {
      Model.flushPending(s, catalog());
      s.money = Math.min(Model.LIMIT, s.money + amount);
      s.totalEarned = Math.min(Model.LIMIT, s.totalEarned + amount);
    });
    emit();
    return !!result;
  }
  window.mapGameEconomy = {
    VERSION: "0.3.3D",
    SAVE_KEY,
    OFFLINE_CAP_MINUTES: 720,
    snapshot,
    setEnabled,
    incomePerMinute: () => snapshot().incomePerMin,
    utilitySummary: () => snapshot().utilities,
    applyOfflineIncome: () => ({ ...offlineResult }),
    start: () => setEnabled(true),
    stop: () => setEnabled(false),
    canAfford: (cost) => enabled && !error && Model.canAfford(state, cost),
    spend,
    credit,
    debit: (amount) =>
      Number.isFinite(amount) && amount >= 0 && spend({ money: amount }),
    purchaseAndRegisterBuilding,
    listPlacedBuildings,
    checkPlacement,
    // Legacy callers may query registered IDs, but cannot bypass construction payment.
    registerPlacedBuilding: (type, id) =>
      state.placedIncomeItems.some((v) => v.id === id && v.type === type),
    removePlacedBuilding: () => false,
    subscribe: (fn) => {
      listeners.add(fn);
      fn(snapshot());
      return () => listeners.delete(fn);
    },
    save: () => {
      const result = settle();
      emit();
      return !!result;
    },
  };
  document.addEventListener("visibilitychange", () => {
    settle();
    emit();
  });
  let resumeOnShow = false;
  window.addEventListener("pagehide", () => {
    resumeOnShow = requested;
    setEnabled(false);
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && resumeOnShow) setEnabled(true);
  });
  window.addEventListener("beforeunload", () => {
    settle();
  });
  window.addEventListener("storage", (e) => {
    if (e.key !== SAVE_KEY && e.key !== null) return;
    // Late events from an old document are harmless if the canonical value
    // already matches. A Home/read-only tab can refresh without awarding time.
    if (localStorage.getItem(SAVE_KEY) === stored) return;
    if (enabled)
      error =
        "Economy paused: storage changed in another tab. Reload before continuing.";
    else readState();
    emit();
  });
})();
