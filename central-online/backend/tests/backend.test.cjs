const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  { query, rpc, quote } = require("./postgres.cjs");
let engine, createHandler, processIntent, freshState, manifest, validateRequest;
const actor = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  session = "33333333-3333-4333-8333-333333333333";
const uuid = () => crypto.randomUUID();
function input(action = "settle", extra = {}) {
  return { operationId: uuid(), sessionId: session, action, ...extra };
}
function handler(options = {}) {
  return createHandler({
    enabled: true,
    origins: ["https://game.test"],
    auth: async (token) =>
      token === actor || token === other
        ? { id: token, email_confirmed_at: "2026-01-01" }
        : null,
    verifySession: async (_token, id) => id === session,
    rpc,
    ...options,
  });
}
async function send(h, data, who = actor) {
  const response = await h(
    new Request("https://api.test/central", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + who,
        "Content-Type": "application/json",
        Origin: "https://game.test",
      },
      body: JSON.stringify(data),
    }),
  );
  return { status: response.status, data: await response.json() };
}
async function reset() {
  await query(
    `TRUNCATE cw041.audit,cw041.buildings,cw041.operations,cw041.rate_limits,cw041.accounts RESTART IDENTITY CASCADE;DELETE FROM public.capitals;DELETE FROM public.territory_claims;INSERT INTO public.territory_claims VALUES('central','T_190_27','${actor}'),('central','T_140_180','${other}');UPDATE cw041.settings SET enabled=true;`,
  );
}
before(async () => {
  ({
    processIntent,
    freshState,
    manifest,
    validateRequest,
    serverEngine: engine,
  } = await import("../engine.mjs"));
  ({ createHandler } = await import("../handler.mjs"));
  await query(
    `INSERT INTO auth.users VALUES('${actor}',now()),('${other}',now()) ON CONFLICT DO NOTHING;DELETE FROM public.world_members;INSERT INTO public.world_members VALUES('central','${actor}'),('central','${other}');`,
  );
});
test("backend off by default; no authentication/body/session bypass", async () => {
  const h = handler();
  assert.equal((await send(handler({ enabled: false }), input())).status, 503);
  assert.equal((await send(h, input(), "invalid")).status, 403);
  assert.equal(
    (await send(h, input("settle", { balances: { money: 1e12 } }))).status,
    400,
  );
  assert.equal(
    (await send(h, input("settle", { timestamp: 1e15 }))).status,
    400,
  );
  assert.equal(
    (await send(h, input("settle", { ownerId: other }))).status,
    400,
  );
  assert.equal(
    (await send(h, input("settle", { sessionId: uuid() }))).status,
    403,
  );
  assert.equal(
    (await h(
      new Request("https://api.test", {
        method: "GET",
        headers: { Origin: "https://evil.test" },
      }),
    )).status,
    403,
  );
  assert.equal(
    (await send(h, input("settle", { padding: "x".repeat(5000) }))).status,
    413,
  );
});
test("new SQL namespaces deny anonymous/authenticated reads/writes and service RPC impersonation", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (
      const sql of [
        `SELECT * FROM cw041.accounts`,
        `INSERT INTO cw041.accounts(actor) VALUES('${actor}')`,
        `SELECT public.cw041_context('${actor}','${uuid()}','{"action":"settle"}')`,
      ]
    ) {
      await assert.rejects(
        query(`SET ROLE ${role};${sql}`),
        /permission denied/,
      );
    }
  }
  assert.equal(
    await query(
      `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cw041' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity;`,
    ),
    "6",
  );
});
test("canonical catalog/terrain matches existing rules, all 121 IDs and 125 contracts", () => {
  assert.equal(engine().defs.length, 125);
  assert.equal(engine().registry.materialIds.length, 121);
  assert.equal(engine().terrain.seed, 734221);
  assert.equal(engine().model.SCHEMA_VERSION, 4);
  assert.throws(
    () =>
      validateRequest(
        input("place", {
          buildingId: "smallHouse",
          territoryId: "T_158_158",
          x: 500,
          z: 500,
          rotation: 0,
        }),
      ),
    /protected/,
  );
  for (
    const patch of [{ x: Infinity }, { rotation: 5 }, {
      territoryId: "T_001_1",
    }]
  ) {
    assert.throws(() =>
      validateRequest(
        input("place", {
          buildingId: "smallHouse",
          territoryId: "T_190_27",
          x: 500,
          z: 500,
          rotation: 0,
          ...patch,
        }),
      )
    );
  }
});
function site(territory = "T_190_27", taken = []) {
  const [, tx, ty] = territory.split("_").map(Number);
  const E = engine();
  for (let z = 200; z < 12000; z += 180) {
    for (let x = 200; x < 12000; x += 180) {
      if (
        taken.some((p) => Math.hypot(p.x - x, p.z - z) < 180)
      ) continue;
      const d = E.defs.find((d) => d.id === "smallHouse");
      if (
        E.model.placement(freshState(Date.now()), d, {
          territoryId: territory,
          x,
          z,
          rotation: 0,
        }, E.terrain).allowed
      ) return { x, z };
    }
  }
  throw Error("No valid fixture site");
}
test("real Postgres atomic purchase, exact receipt replay, collisions and immutable intent", async () => {
  await reset();
  const h = handler(),
    p = site(),
    op = input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    });
  const first = await send(h, op);
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.equal(first.data.code, "placed");
  assert.equal(
    first.data.snapshot.balances.money,
    String(388000n * 300000000000n),
  );
  const replay = await send(h, op);
  assert.deepEqual(replay, first);
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "1");
  assert.equal((await send(h, { ...op, x: p.x + 200 })).status, 409);
  const denied = await send(
    h,
    input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    }),
  );
  assert.equal(denied.status, 409);
  assert.equal(
    denied.data.snapshot.balances.money,
    first.data.snapshot.balances.money,
  );
  assert.equal(await query("SELECT count(*) FROM cw041.audit"), "2");
});
test("unauthorized territory and research bypass cannot debit or create factories", async () => {
  await reset();
  const h = handler(), p = site();
  assert.equal(
    (await send(
      h,
      input("place", {
        buildingId: "smallHouse",
        territoryId: "T_190_27",
        ...p,
        rotation: 0,
      }),
      other,
    )).status,
    403,
  );
  const locked = await send(
    h,
    input("research", { technologyId: "electricity" }),
  );
  assert.equal(locked.status, 409);
  const own = await send(
    h,
    input("research", { technologyId: "basicIndustry" }),
  );
  assert.equal(own.status, 200);
  const again = await send(
    h,
    input("research", { technologyId: "basicIndustry" }),
  );
  assert.equal(again.status, 200);
  assert.equal(
    again.data.snapshot.balances.money,
    own.data.snapshot.balances.money,
  );
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "0");
});
test("concurrent same operation charges once; concurrent overlapping placements commit once", async () => {
  await reset();
  const p = site(),
    h = handler(),
    op = input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    });
  const r = await Promise.all([send(h, op), send(h, op), send(h, op)]);
  assert(r.every((x) => x.status === 200), JSON.stringify(r));
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "1");
  assert.equal(
    await query(
      "SELECT state#>>'{economy,precision,money}' FROM cw041.accounts",
    ),
    String(388000n * 300000000000n),
  );
  await reset();
  const rr = await Promise.all([
    send(h, { ...op, operationId: uuid() }),
    send(h, { ...op, operationId: uuid() }),
  ]);
  assert.equal(
    rr.filter((r) => r.data.code === "placed").length,
    1,
    JSON.stringify(rr),
  );
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "1");
});
test("concurrent spending cannot overdraw; failures leave construction funds intact", async () => {
  await reset();
  const h = handler();
  await send(h, input());
  const state = JSON.parse(await query("SELECT state FROM cw041.accounts"));
  engine().model.spend(state, { money: 385000 });
  await query(
    `UPDATE cw041.accounts SET state=${quote(JSON.stringify(state))}::jsonb`,
  );
  const p = site(), q = site("T_190_27", [p]);
  const r = await Promise.all([
    send(
      h,
      input("place", {
        buildingId: "smallHouse",
        territoryId: "T_190_27",
        ...p,
        rotation: 0,
      }),
    ),
    send(
      h,
      input("place", {
        buildingId: "smallHouse",
        territoryId: "T_190_27",
        ...q,
        rotation: 0,
      }),
    ),
  ]);
  assert.equal(
    r.filter((x) => x.data.code === "placed").length,
    1,
    JSON.stringify(r),
  );
  assert.equal(
    await query(
      "SELECT state#>>'{economy,precision,money}' FROM cw041.accounts",
    ),
    String(3000n * 300000000000n),
  );
});
test("existing capital exclusion, stale ownership and missing coordination fail closed", async () => {
  await reset();
  const p = site(), h = handler();
  await query(
    `INSERT INTO public.capitals VALUES('central','T_190_27','${actor}',${p.x},${p.z})`,
  );
  assert.equal(
    (await send(
      h,
      input("place", {
        buildingId: "smallHouse",
        territoryId: "T_190_27",
        ...p,
        rotation: 0,
      }),
    )).status,
    409,
  );
  await query("DELETE FROM public.capitals");
  await send(
    h,
    input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    }),
  );
  await assert.rejects(
    query(
      `INSERT INTO public.capitals VALUES('central','T_190_27','${actor}',${p.x},${p.z})`,
    ),
    /capital_overlaps_factory/,
  );
  await query(
    `UPDATE public.territory_claims SET owner_id='${other}' WHERE territory_id='T_190_27'`,
  );
  assert.notEqual((await send(h, input())).status, 200);
  await query(
    "ALTER TABLE public.capitals DISABLE TRIGGER cw041_capital_guard",
  );
  assert.equal((await send(h, input())).status, 503);
  await query("ALTER TABLE public.capitals ENABLE TRIGGER cw041_capital_guard");
});
test("shared region projection excludes balances/contracts and requires verified world membership", async () => {
  await reset();
  const h = handler(), p = site();
  await send(
    h,
    input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    }),
  );
  const r = await send(h, {
    action: "region",
    territoryId: "T_190_27",
    sessionId: session,
  }, other);
  assert.equal(r.status, 200);
  assert.equal(r.data.buildings.length, 1);
  assert(!JSON.stringify(r.data).includes("economyContract"));
  assert(!JSON.stringify(r.data).includes("precision"));
  await query(`DELETE FROM public.world_members WHERE user_id='${other}'`);
  assert.equal(
    (await send(h, {
      action: "region",
      territoryId: "T_190_27",
      sessionId: session,
    }, other)).status,
    403,
  );
  await query(`INSERT INTO public.world_members VALUES('central','${other}')`);
});
test("bounded uncapped catch-up preserves exact constrained reference and online 1.2 rules", () => {
  const E = engine(), now = 1800000000000, s = freshState(now);
  const types = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "steelMill",
    "carbonPlant",
    "cornerStore",
  ];
  s.placedIncomeItems = types.map((type, i) => ({
    id: "test_" + i,
    type,
    territoryId: "T_190_27",
    x: 500 + i * 200,
    z: 500,
    level: 1,
  }));
  E.model.bindContracts(s, E.defs);
  s.economy.population = 30;
  const regular = E.model.clone(s),
    bounded = E.model.clone(s),
    target = now + 86400000 * 365.25 * 1000;
  E.model.advance(regular, target, false, E.defs, { maxEvaluations: 1e6 });
  let passes = 0;
  do {
    const result = processIntent(
      {
        state: bounded,
        nowMs: target,
        targetMs: target,
        releaseHash: manifest.hash,
        seed: 734221,
      },
      { operationId: uuid(), intent: { action: "settle" } },
      actor,
      { maxEvaluations: 64 },
    );
    Object.assign(bounded, result.state);
    if (result.complete) break;
    if (++passes > 500) throw Error("Catch-up did not converge");
  } while (true);
  assert.deepEqual(bounded.economy.precision, regular.economy.precision);
  assert.equal(bounded.economy.lastTick, target);
  const a = E.model.clone(s), b = E.model.clone(s);
  E.model.advance(a, now + 60000, false, E.defs);
  E.model.advance(b, now + 60000, true, E.defs);
  assert(b.steel > a.steel);
  assert.equal(b.economy.population, a.economy.population);
});
test("transaction failure after building insertion rolls back debit, state, audit and index", async () => {
  await reset();
  const h = handler(),
    p = site(),
    op = input("place", {
      buildingId: "smallHouse",
      territoryId: "T_190_27",
      ...p,
      rotation: 0,
    });
  await query(
    `CREATE FUNCTION cw041.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'isolated_test_failure';END$$; CREATE TRIGGER test_fail BEFORE INSERT ON cw041.audit FOR EACH ROW EXECUTE FUNCTION cw041.test_fail_audit();`,
  );
  assert.equal((await send(h, op)).status, 503);
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "0");
  assert.equal(await query("SELECT count(*) FROM cw041.audit"), "0");
  assert.equal(await query("SELECT revision FROM cw041.accounts"), "0");
  await query(
    "DROP TRIGGER test_fail ON cw041.audit;DROP FUNCTION cw041.test_fail_audit()",
  );
  const retry = await send(h, op);
  assert.equal(retry.status, 200);
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "1");
  assert.equal(
    retry.data.snapshot.balances.money,
    String(388000n * 300000000000n),
  );
});
test("capital-vs-factory concurrency cannot commit overlapping footprints", async () => {
  await reset();
  const h = handler(), p = site();
  const outcomes = await Promise.allSettled([
    send(
      h,
      input("place", {
        buildingId: "smallHouse",
        territoryId: "T_190_27",
        ...p,
        rotation: 0,
      }),
    ),
    query(
      `INSERT INTO public.capitals VALUES('central','T_190_27','${actor}',${p.x},${p.z})`,
    ),
  ]);
  const count = Number(
    await query(
      "SELECT (SELECT count(*) FROM cw041.buildings)+(SELECT count(*) FROM public.capitals)",
    ),
  );
  assert.equal(count, 1, JSON.stringify(outcomes));
});
test("stale revisions, future checkpoint and malformed precise ledger cannot commit", async () => {
  await reset();
  const req = validateRequest(input()),
    c = await rpc("cw041_context", {
      p_actor: actor,
      p_operation: req.operationId,
      p_intent: req.intent,
    }),
    result = processIntent(c, req, actor);
  const args = {
    p_actor: actor,
    p_operation: req.operationId,
    p_revision: c.revision,
    p_release: manifest.hash,
    p_state: result.state,
    p_complete: true,
    p_target: null,
    p_receipt: result.receipt,
    p_building: null,
  };
  assert.deepEqual(await rpc("cw041_commit", { ...args, p_revision: 99 }), {
    conflict: "account_changed",
  });
  assert.deepEqual(await rpc("cw041_commit", { ...args, p_revision: null }), {
    conflict: "account_changed",
  });
  await assert.rejects(
    rpc("cw041_commit", { ...args, p_receipt: null }),
    /invalid_server_receipt/,
  );
  const bad = engine().model.clone(result.state);
  bad.economy.precision.money = "-1";
  await assert.rejects(
    rpc("cw041_commit", { ...args, p_state: bad }),
    /invalid_exact_ledger/,
  );
  const future = engine().model.clone(result.state);
  future.economy.lastTick = c.nowMs + 86400000;
  await assert.rejects(
    rpc("cw041_commit", { ...args, p_state: future }),
    /invalid_checkpoint/,
  );
  assert.equal(await query("SELECT revision FROM cw041.accounts"), "0");
});
test("input shortages and bounded reference steps conserve every exact material", () => {
  const E = engine(), s = freshState(1800000000000);
  s.placedIncomeItems = [
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "ironSmelter",
    "coalMine",
    "cokeWorks",
    "steelFoundry",
  ].map((type, i) => ({
    id: "mixed_" + i,
    type,
    territoryId: "T_190_27",
    x: 300 + i * 200,
    z: 300,
    level: 1,
  }));
  E.model.bindContracts(s, E.defs);
  s.economy.population = 20;
  E.progression.complete(s, "basicIndustry", E.model);
  E.progression.complete(s, "miningRefining", E.model);
  const a = E.model.clone(s), b = E.model.clone(s);
  const target = s.economy.lastTick + 600000;
  E.model.advance(a, target, false, E.defs, {
    maxEvaluations: 1000,
    accelerate: false,
  });
  let complete = false;
  for (let i = 0; i < 1000 && !complete; i++) {
    const r = E.model.advance(b, target, false, E.defs, {
      maxEvaluations: 1,
      accelerate: false,
    });
    complete = r.complete;
  }
  assert(complete);
  assert.deepEqual(a.economy.precision, b.economy.precision);
  for (const n of Object.values(b.economy.precision)) assert(BigInt(n) >= 0n);
});
test("partial settlement commits a durable target and resumes without lost time or duplicate income", async () => {
  await reset();
  const h = handler({ maxEvaluations: 1 });
  await send(h, input());
  const initial = freshState(Date.now() - 25000);
  initial.placedIncomeItems = ["smallHouse", "powerPlant", "cornerStore"].map((
    type,
    i,
  ) => ({
    id: "resume_" + i,
    type,
    territoryId: "T_190_27",
    x: 300 + i * 200,
    z: 300,
    level: 1,
  }));
  engine().model.bindContracts(initial, engine().defs);
  initial.economy.population = 10;
  await query(
    `UPDATE cw041.accounts SET state=${quote(JSON.stringify(initial))}::jsonb`,
  );
  const op = input(), first = await send(h, op);
  assert.equal(first.status, 202, JSON.stringify(first));
  const target = Number(await query("SELECT target_ms FROM cw041.accounts"));
  assert(target > initial.economy.lastTick);
  let complete = first;
  for (let i = 0; i < 10 && complete.status === 202; i++) {
    complete = await send(h, op);
  }
  assert.equal(complete.status, 200);
  assert.equal(
    await query("SELECT target_ms IS NULL FROM cw041.accounts"),
    "t",
  );
  const reference = engine().model.clone(initial);
  engine().model.advance(reference, target, false, engine().defs, {
    maxEvaluations: 1000,
  });
  assert.deepEqual(
    complete.data.snapshot.balances,
    reference.economy.precision,
  );
  assert.equal(complete.data.snapshot.checkpoint, target);
  assert.deepEqual(await send(h, op), complete);
});
test("both economic and regional reads enforce the same authenticated request limit", async () => {
  await reset();
  const h = handler();
  await send(h, input());
  await query(
    "UPDATE cw041.rate_limits SET requests=120,bucket=floor(extract(epoch from clock_timestamp())/60)::bigint",
  );
  assert.equal((await send(h, input())).status, 429);
  assert.equal(
    (await send(h, {
      action: "region",
      territoryId: "T_190_27",
      sessionId: session,
    })).status,
    429,
  );
});
test("reconnect discovers only own pending intents and committed transaction receipts", async () => {
  await reset();
  const h = handler(), req = validateRequest(input());
  await rpc("cw041_context", {
    p_actor: actor,
    p_operation: req.operationId,
    p_intent: req.intent,
  });
  const own = await send(h, { action: "status", sessionId: session });
  assert.equal(own.status, 200);
  assert.equal(own.data.pending[0].operationId, req.operationId);
  const foreign = await send(
    h,
    { action: "status", sessionId: session },
    other,
  );
  assert.equal(foreign.status, 200);
  assert.equal(foreign.data.pending.length, 0);
  assert.equal(foreign.data.recent.length, 0);
  const settled = await send(h, {
    operationId: req.operationId,
    sessionId: session,
    ...req.intent,
  });
  assert.equal(settled.status, 200);
  const after = await send(h, { action: "status", sessionId: session });
  assert.equal(after.data.pending.length, 0);
  assert.equal(after.data.recent[0].receipt.code, "settled");
});
