// Singleplayer economy adapter. One canonical, versioned localStorage transaction.
(() => {
  "use strict";
  const Progression = window.mapGameProgression;
  const Model = window.mapGameEconomyModel,
    SAVE_KEY = "mapgame_economy_021e",
    WORLD_KEY = "mapGame_alpha021_firstPlayable";
  let catchup = null,
    catchupTimer = null,
    sessionClock = null;
  let summaryCache = null,
    catchupWorker = null,
    catchupEngine = "cooperative";
  function currentSummary() {
    if (!summaryCache || summaryCache.online !== online)
      summaryCache = { online, value: Model.summary(state, catalog(), online) };
    return summaryCache.value;
  }
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
    summaryCache = null;
    try {
      stored = localStorage.getItem(SAVE_KEY);
      const raw = JSON.parse(stored || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw Error("Invalid economy save");
      if (raw.economy?.version > Model.SCHEMA_VERSION)
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
      Model.bindContracts(state, catalog(), raw.economy?.version || 0);
      Progression.init(state, catalog(), {
        legacy: Boolean(stored || legacy.length),
      });
      Progression.refresh(state);
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
      s = currentSummary();
    return {
      ...snap,
      enabled: enabled && !error && !catchup,
      catchingUp: Boolean(catchup),
      catchupEngine,
      clockNotice: state.economy.clockNotice || "",
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
      if (!result || result.steps !== 0) summaryCache = null;
      if (result === false) {
        state = previous;
        return false;
      }
      Progression.refresh(state);
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
  const monotonic = () =>
    typeof performance !== "undefined" ? performance.now() : null;
  function resetClock() {
    sessionClock = { wall: Date.now(), mono: monotonic() };
  }
  function advancePass(target, boost) {
    return transaction((s) =>
      Model.advance(s, target, boost, catalog(), {
        maxEvaluations: s.placedIncomeItems.length > 1000 ? 2 : 32,
      }),
    );
  }
  function finishCatchup() {
    const job = catchup;
    catchup = null;
    online = activeOnline();
    if (!sessionClock) resetClock();
    offlineResult = {
      steps: job.steps,
      earned: job.earned,
      elapsedMinutes: job.elapsedMinutes,
      rate: currentSummary().production.money,
    };
    emit();
  }
  function continueCatchup() {
    if (!enabled || error || !catchup) return;
    const result = advancePass(catchup.target, catchup.online);
    if (!result) {
      catchup = null;
      emit();
      return;
    }
    catchup.steps += result.steps;
    catchup.earned += result.earned;
    if (result.complete) return finishCatchup();
    catchupTimer = setTimeout(continueCatchup, 0);
  }
  function launchCatchup() {
    if (
      typeof Worker === "undefined" ||
      state.placedIncomeItems.length <= 256
    ) {
      catchupEngine = "cooperative";
      continueCatchup();
      return;
    }
    const job = catchup,
      before = state.money;
    function fallback() {
      catchupWorker?.terminate();
      catchupWorker = null;
      if (catchup !== job || !enabled) return;
      catchupEngine = "cooperative";
      continueCatchup();
    }
    try {
      const worker = new Worker("economy_worker.js?v=3403");
      catchupWorker = worker;
      catchupEngine = "worker";
      catchupWorker.onerror = (event) => {
        event.preventDefault();
        fallback();
      };
      catchupWorker.onmessage = ({ data }) => {
        if (catchupWorker !== worker || catchup !== job || !enabled) return;
        if (data.error || data.state?.economy?.lastTick !== job.target) {
          fallback();
          return;
        }
        catchupWorker.terminate();
        catchupWorker = null;
        const result = transaction((s) => {
          Object.assign(s, data.state);
          return data.result;
        });
        if (!result) {
          catchup = null;
          emit();
          return;
        }
        summaryCache = { online: true, value: data.summaryOnline };
        job.steps += result.steps;
        job.earned += state.money - before;
        finishCatchup();
      };
      catchupWorker.postMessage({
        state: Model.clone(state),
        defs: catalog(),
        target: job.target,
        online: job.online,
      });
    } catch (_) {
      fallback();
    }
  }
  function settle() {
    if (!enabled || error || catchup) return false;
    const now = Date.now(),
      mono = monotonic();
    let suspiciousClock = false;
    if (
      sessionClock &&
      mono !== null &&
      now - sessionClock.wall - (mono - sessionClock.mono) > 5000
    ) {
      suspiciousClock = true;
      const recorded = transaction((s) => {
        s.economy.clockAnomalies = (s.economy.clockAnomalies || 0) + 1;
        s.economy.clockNotice =
          "Clock or suspension gap detected: offline 1× applied, with no time cap. Local dates cannot be verified.";
        return { steps: 0 };
      });
      if (!recorded) return false;
    }
    const elapsedMinutes = Math.max(0, (now - state.economy.lastTick) / 60000),
      boost =
        !suspiciousClock && online && now - state.economy.lastTick <= 60000;
    const result = advancePass(now, boost);
    if (result && !result.complete) {
      catchup = {
        target: now,
        online: boost,
        steps: result.steps,
        earned: result.earned,
        elapsedMinutes,
      };
      launchCatchup();
    }
    if (online !== activeOnline()) summaryCache = null;
    online = activeOnline();
    resetClock();
    return result;
  }
  function setEnabled(value) {
    if (requested === !!value) return;
    requested = !!value;
    if (!requested) {
      if (enabled) settle();
      enabled = false;
      clearTimeout(catchupTimer);
      catchupWorker?.terminate();
      catchupWorker = null;
      catchup = null;
      sessionClock = null;
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
          catchup = {
            target: Date.now(),
            online: false,
            steps: 0,
            earned: 0,
            elapsedMinutes: Math.max(
              0,
              (Date.now() - state.economy.lastTick) / 60000,
            ),
          };
          resetClock();
          launchCatchup();
          timer = setInterval(() => {
            if (catchup) return;
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
    if (
      !enabled ||
      error ||
      catchup ||
      !def ||
      typeof data?.id !== "string" ||
      !data.id
    )
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
    if (!actual || Progression.reason(state, actual)) return false;
    settle();
    if (catchup || error) return false;
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
      const row = {
        ...data,
        economyContract: null,
        progressionAcquired: 1,
        type: actual.id,
        footprint: actual.footprint.slice(),
        level: 1,
        createdAt: Date.now(),
        recipeId: actual.recipeId || null,
        recipeVersion: actual.recipeVersion || 1,
      };
      Model.pinContract(s, row, actual);
      s.placedIncomeItems.push(row);
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
    const actual = catalog().find((d) => d.id === def?.id && d.economy);
    const locked = Progression.reason(state, actual);
    if (locked) return { allowed: false, reasons: [locked] };
    def = actual;
    if (!enabled || error || catchup)
      return {
        allowed: false,
        reasons: [
          error ||
            (catchup
              ? "Offline economy catch-up is still running"
              : "Economy construction is Singleplayer only"),
        ],
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
    if (catchup) return false;
    settle();
    if (catchup) return false;
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
    if (!Number.isFinite(amount) || amount < 0 || catchup) return false;
    settle();
    if (catchup) return false;
    const result = transaction((s) => {
      Model.flushPending(s, catalog());
      return Model.credit(s, amount);
    });
    emit();
    return !!result;
  }
  window.mapGameEconomy = {
    VERSION: "0.3.4C1",
    purchaseReason: (id) =>
      Progression.reason(
        state,
        catalog().find((d) => d.id === id),
      ),
    completeResearch: (id) => {
      if (!enabled || error || catchup) return false;
      settle();
      if (catchup || error) return false;
      const result = transaction((s) => {
        Model.flushPending(s, catalog());
        return Progression.complete(s, id, Model);
      });
      emit();
      return !!result;
    },
    setOperatingPriority: (mode) => {
      if (!enabled || error || catchup) return false;
      settle();
      if (catchup || error) return false;
      const result = transaction((s) => {
        Model.flushPending(s, catalog());
        return Progression.priorities(s, catalog(), mode, Model);
      });
      emit();
      return !!result;
    },
    SAVE_KEY,
    OFFLINE_CAP_MINUTES: null,
    snapshot,
    getStatus: () => ({
      enabled: enabled && !error && !catchup,
      catchingUp: Boolean(catchup),
      engine: catchupEngine,
      error,
    }),
    setEnabled,
    incomePerMinute: () => snapshot().incomePerMin,
    utilitySummary: () => snapshot().utilities,
    applyOfflineIncome: () => ({ ...offlineResult }),
    start: () => setEnabled(true),
    stop: () => setEnabled(false),
    canAfford: (cost) =>
      enabled && !error && !catchup && Model.canAfford(state, cost),
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
    else {
      const denied = requested ? error : "";
      readState();
      if (denied && !error) error = denied;
    }
    emit();
  });
})();
