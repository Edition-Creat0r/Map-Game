import { createEngine, manifest } from "./generated/rules.mjs";
export { manifest };
export class Rejection extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateRequest(input) {
  if (
    !input || typeof input !== "object" || Array.isArray(input) ||
    !uuid.test(input.operationId || "") || !uuid.test(input.sessionId || "")
  ) throw new Rejection("invalid_operation_or_session");
  const fields = {
    settle: [],
    place: ["buildingId", "territoryId", "x", "z", "rotation"],
    research: ["technologyId"],
  }[input.action];
  if (
    !fields ||
    Object.keys(input).some((k) =>
      !["operationId", "sessionId", "action", ...fields].includes(k)
    ) || fields.some((k) => !Object.hasOwn(input, k))
  ) throw new Rejection("invalid_intent");
  const intent = { action: input.action };
  for (const k of fields) intent[k] = input[k];
  if (input.action === "place") {
    const m = /^T_(\d{1,3})_(\d{1,3})$/.exec(input.territoryId || "");
    if (
      !m || Number(m[1]) >= 316 || Number(m[2]) >= 316 ||
      `T_${Number(m[1])}_${Number(m[2])}` !== input.territoryId ||
      !Number.isFinite(input.x) || !Number.isFinite(input.z) || input.x < 0 ||
      input.x > 32768 || input.z < 0 || input.z > 32768 ||
      ![0, 1, 2, 3].includes(input.rotation) ||
      typeof input.buildingId !== "string" || input.buildingId.length > 80
    ) throw new Rejection("invalid_placement");
    if (
      Math.abs(Number(m[1]) - 158) <= 1 && Math.abs(Number(m[2]) - 158) <= 1
    ) throw new Rejection("protected_central_district", 403);
  }
  if (
    input.action === "research" &&
    (typeof input.technologyId !== "string" || input.technologyId.length > 80)
  ) throw new Rejection("invalid_technology");
  return {
    operationId: input.operationId.toLowerCase(),
    sessionId: input.sessionId.toLowerCase(),
    intent,
  };
}
const engine = createEngine();
export function freshState(now) {
  const s = engine.model.normalize({}, now);
  engine.model.bindContracts(s, engine.defs);
  engine.progression.init(s, engine.defs, { legacy: false });
  return s;
}
export function processIntent(
  context,
  request,
  actor,
  { maxEvaluations = 64 } = {},
) {
  if (context.releaseHash !== manifest.hash || context.seed !== manifest.seed) {
    throw new Rejection("server_rules_not_configured", 503);
  }
  const M = engine.model, P = engine.progression;
  const state = context.state
    ? M.clone(context.state)
    : freshState(context.nowMs);
  // Stored server state only. No import of browser ledgers, timestamps or contracts.
  if (state.economy.version !== M.SCHEMA_VERSION) {
    throw new Rejection("server_migration_required", 503);
  }
  const target = context.targetMs ?? context.nowMs;
  if (!Number.isSafeInteger(target) || target < state.economy.lastTick) {
    throw new Rejection("invalid_server_checkpoint", 503);
  }
  const result = M.advance(state, target, false, engine.defs, {
    maxEvaluations,
  });
  if (!result.complete) {
    return {
      state,
      complete: false,
      receipt: { status: 202, code: "settling", retry: true },
      building: null,
      remainingTarget: target,
    };
  }
  P.refresh(state);
  const receipt = { status: 200, code: "settled" }, intent = request.intent;
  let building = null;
  if (intent.action === "place") {
    const def = engine.defs.find((d) => d.id === intent.buildingId);
    if (!def) {
      receipt.status = 400;
      receipt.code = "unknown_building";
    } else if (P.reason(state, def)) {
      receipt.status = 409;
      receipt.code = "building_locked";
    } else {
      M.flushPending(state, engine.defs);
      const data = {
        id: request.operationId,
        type: def.id,
        territoryId: intent.territoryId,
        x: intent.x,
        z: intent.z,
        rotation: intent.rotation * Math.PI / 2,
        ownerId: actor,
        variant: 0,
      };
      const exclusions = [
        ...(context.neighbors || []),
        ...(context.capitals || []).map((c) => ({
          ...c,
          footprint: [150, 150],
          rotation: 0,
          reserved: true,
        })),
      ];
      const site = M.placement(state, def, data, engine.terrain, exclusions);
      if (!site.allowed) {
        receipt.status = 409;
        receipt.code = "placement_rejected";
        receipt.reasons = site.reasons;
      } else if (!M.spend(state, def.cost)) {
        receipt.status = 409;
        receipt.code = "insufficient_resources";
      } else {
        building = {
          ...data,
          footprint: def.footprint.slice(),
          level: 1,
          createdAt: context.nowMs,
          recipeId: def.recipeId || null,
          recipeVersion: def.recipeVersion || 1,
          progressionAcquired: 1,
        };
        M.pinContract(state, building, def);
        state.placedIncomeItems.push(building);
        receipt.code = "placed";
        receipt.building = building;
      }
    }
  } else if (intent.action === "research") {
    M.flushPending(state, engine.defs);
    if (!P.complete(state, intent.technologyId, M)) {
      receipt.status = 409;
      receipt.code = "research_rejected";
    } else {
      receipt.code = "researched";
      receipt.technologyId = intent.technologyId;
    }
  }
  P.refresh(state);
  return { state, complete: true, receipt, building, remainingTarget: null };
}
export function publicSnapshot(state) {
  return {
    schemaVersion: state.economy.version,
    materialRegistryVersion: state.economy.materialRegistryVersion,
    balances: { ...state.economy.precision },
    population: state.economy.population,
    checkpoint: state.economy.lastTick,
    progression: state.economy.progression,
    buildingCount: state.placedIncomeItems.length,
    onlineBonus: "not enabled: trusted activity policy required",
  };
}
export function serverEngine() {
  return engine;
}
