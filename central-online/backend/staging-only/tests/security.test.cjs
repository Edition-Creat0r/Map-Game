const { test, beforeEach } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { as, reset, join, a, b, unverified, uuid, query, rpc } = require(
  "./helpers.cjs",
);
const deny = (p) =>
  assert.rejects(
    p,
    /permission denied|42501|verified_central|active_member|immutable|not_territory_owner|protected|session_owned|invalid_capital|row-level security/,
  );
const beat = (actor, id) =>
  as(actor, `SELECT public.map_game_session_heartbeat('central','${id}')`);
const claim = (actor, t) =>
  as(
    actor,
    `INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','${t}','${actor}','Synthetic')`,
  );
const capital = (actor, t, x = 500, z = 500) =>
  as(
    actor,
    `INSERT INTO public.capitals(world_id,owner_id,owner_username,territory_id,name,x,z) VALUES('central','${actor}','Synthetic','${t}','Test city',${x},${z})`,
  );
beforeEach(reset);
test("expanded preflight returns all-five-table metadata without fixture actor rows", async () => {
  const text = await query(
    fs.readFileSync(path.join(__dirname, "../preflight.sql"), "utf8"),
  );
  const data = JSON.parse(text);
  assert.equal(data.tables.length, 5);
  assert.equal(
    data.public_functions.filter((f) => f.name.startsWith("map_game_")).length,
    4,
  );
  assert.ok(data.column_grants.length > 0);
  assert.equal(text.includes(a), false);
  assert.equal(text.includes(b), false);
});
test("draft keeps economy OFF and removes table AND column session write grants", async () => {
  assert.equal(await query("SELECT enabled FROM cw041.settings"), "f");
  for (const role of ["anon", "authenticated"]) {
    for (
      const permission of [
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "REFERENCES",
        "TRIGGER",
      ]
    ) {
      assert.equal(
        await query(
          `SELECT has_table_privilege('${role}','public.world_sessions','${permission}')`,
        ),
        "f",
      );
    }
    for (const permission of ["INSERT", "UPDATE", "REFERENCES"]) {
      assert.equal(
        await query(
          `SELECT has_column_privilege('${role}','public.world_sessions','last_seen','${permission}')`,
        ),
        "f",
      );
    }
  }
});
test("forged direct session INSERT/UPDATE/DELETE/TRUNCATE are denied", async () => {
  const id = await join(a);
  for (
    const sql of [
      `INSERT INTO public.world_sessions(world_id,session_id,user_id) VALUES('central','${uuid()}','${a}')`,
      `UPDATE public.world_sessions SET last_seen=now()+interval '1 year',conflicted=false`,
      `DELETE FROM public.world_sessions WHERE user_id='${a}'`,
      "TRUNCATE public.world_sessions",
    ]
  ) await deny(as(a, sql));
  assert.equal(await beat(a, id), "t");
});
test("anonymous, unverified users, wrong world and NULL session cannot start", async () => {
  await deny(
    as(
      "",
      `SELECT public.map_game_start_session('central','${uuid()}','Synthetic')`,
      "anon",
    ),
  );
  await deny(
    as(
      unverified,
      `SELECT public.map_game_start_session('central','${uuid()}','Synthetic')`,
    ),
  );
  await deny(
    as(
      a,
      `SELECT public.map_game_start_session('other','${uuid()}','Synthetic')`,
    ),
  );
  await assert.rejects(
    as(a, `SELECT public.map_game_start_session('central',NULL,'Synthetic')`),
    /session_required/,
  );
});
test("existing join order is preserved: verified session first, membership second", async () => {
  const id = await join(a);
  assert.equal(await beat(a, id), "t");
  await claim(a, "T_190_27");
  await capital(a, "T_190_27");
  assert.equal(await query("SELECT count(*) FROM public.capitals"), "1");
});
test("both start overloads reject another actor session collision without losing own session", async () => {
  const sa = await join(a), sb = await join(b);
  for (
    const args of [
      `'central','${sb}','Synthetic'`,
      `'device','${sb}','Synthetic','central'`,
    ]
  ) {
    await deny(as(a, `SELECT public.map_game_start_session(${args})`));
  }
  assert.equal(await beat(a, sa), "t");
  assert.equal(await beat(b, sb), "t");
});
test("concurrent starts serialize per actor; exactly one wins and other actor survives", async () => {
  const other = await join(b);
  const ids = Array.from({ length: 6 }, uuid);
  await Promise.all(
    ids.map((id, i) =>
      as(
        a,
        `SELECT public.map_game_start_session(${
          i % 2
            ? `'device','${id}','Synthetic','central'`
            : `'central','${id}','Synthetic'`
        })`,
      )
    ),
  );
  assert.equal(
    await query(
      `SELECT count(*) FROM public.world_sessions WHERE user_id='${a}'`,
    ),
    "1",
  );
  const validity = await Promise.all(ids.map((id) => beat(a, id)));
  assert.equal(validity.filter((v) => v === "t").length, 1);
  assert.equal(await beat(b, other), "t");
});
test("simultaneous cross-account collision assigns an ID to only one actor", async () => {
  const id = uuid();
  const results = await Promise.allSettled([
    as(
      a,
      `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
    ),
    as(
      b,
      `SELECT public.map_game_start_session('device','${id}','Synthetic','central')`,
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(await query("SELECT count(*) FROM public.world_sessions"), "1");
});
test("session reads, heartbeat and end cannot control a different account", async () => {
  const sa = await join(a), sb = await join(b);
  assert.equal(await as(a, "SELECT count(*) FROM public.world_sessions"), "1");
  assert.equal(await beat(a, sb), "f");
  await as(a, `SELECT public.map_game_end_session('central','${sb}')`);
  assert.equal(await beat(b, sb), "t");
  assert.equal(await beat(a, sa), "t");
});
test("stale, future and conflicted sessions cannot be revived by heartbeat", async () => {
  const id = await join(a);
  for (
    const patch of [
      "last_seen=clock_timestamp()-interval '91 seconds'",
      "last_seen=clock_timestamp()+interval '1 day'",
      "conflicted=true",
    ]
  ) {
    await as(
      a,
      `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
    );
    await query(
      `UPDATE public.world_sessions SET ${patch} WHERE session_id='${id}'`,
    );
    assert.equal(await beat(a, id), "f");
  }
  await as(
    a,
    `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
  );
  assert.equal(await beat(a, id), "t"); // explicit authenticated rejoin is allowed
});
test("membership requires verified active actor; cannot forge another identity", async () => {
  await deny(
    as(
      a,
      `INSERT INTO public.world_members(world_id,user_id,username) VALUES('central','${a}','Synthetic')`,
    ),
  );
  await join(a);
  await deny(
    as(
      a,
      `INSERT INTO public.world_members(world_id,user_id,username) VALUES('central','${b}','Synthetic')`,
    ),
  );
  await as(
    a,
    `UPDATE public.world_members SET last_seen=now()+interval '1 year' WHERE user_id='${a}'`,
  );
  assert.equal(
    await query(
      `SELECT last_seen<=clock_timestamp() FROM public.world_members WHERE user_id='${a}'`,
    ),
    "t",
  );
});
test("claims reject invalid/protected grid, wrong owner and missing membership", async () => {
  const id = uuid();
  await as(
    a,
    `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
  );
  await deny(claim(a, "T_190_27"));
  await join(a);
  for (
    const t of [
      "T_158_158",
      "T_157_159",
      "T_316_0",
      "T_01_4",
      "T_-1_4",
      "not-a-territory",
    ]
  ) await deny(claim(a, t));
  await deny(
    as(
      a,
      `INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','T_190_27','${b}','Synthetic')`,
    ),
  );
});
test("capital ownership and footprint are checked while economy is OFF", async () => {
  await join(a);
  await join(b);
  await claim(a, "T_190_27");
  await claim(b, "T_140_180");
  await deny(capital(a, "T_140_180"));
  await deny(capital(a, "T_190_27", 0, 500));
  await capital(a, "T_190_27");
  await deny(
    as(
      a,
      `UPDATE public.capitals SET territory_id='T_140_180' WHERE owner_id='${a}'`,
    ),
  );
  await deny(
    as(a, `UPDATE public.capitals SET x='NaN'::float8 WHERE owner_id='${a}'`),
  );
});
test("even an accidentally permissive policy cannot transfer claims past the trigger", async () => {
  await join(a);
  await join(b);
  await claim(a, "T_190_27");
  await query(
    "CREATE POLICY test_accidental_update ON public.territory_claims FOR UPDATE TO authenticated USING(true) WITH CHECK(true)",
  );
  try {
    await deny(
      as(
        a,
        `UPDATE public.territory_claims SET owner_id='${b}' WHERE owner_id='${a}'`,
      ),
    );
    await deny(
      as(
        a,
        `UPDATE public.territory_claims SET territory_id='T_180_30' WHERE owner_id='${a}'`,
      ),
    );
  } finally {
    await query(
      "DROP POLICY test_accidental_update ON public.territory_claims",
    );
  }
});
test("private guards and economy RPC/table writes remain inaccessible to users", async () => {
  for (const actor of [a, b]) {
    for (
      const sql of [
        "SELECT * FROM cw041.accounts",
        `SELECT cw041_staging_security.actor('central')`,
        `SELECT public.cw041_context('${actor}','${uuid()}','{"action":"settle"}')`,
      ]
    ) await deny(as(actor, sql));
  }
  for (const t of ["worlds", "world_members", "territory_claims", "capitals"]) {
    assert.equal(
      await query(
        `SELECT has_table_privilege('authenticated','public.${t}','TRUNCATE')`,
      ),
      "f",
    );
  }
});
test("draft rejects missing acknowledgement and contract drift before mutation", async () => {
  const draft = fs.readFileSync(
    path.join(__dirname, "../draft/000_staging_legacy_security.DRAFT.sql"),
    "utf8",
  );
  await assert.rejects(
    query("BEGIN;" + draft + "ROLLBACK;"),
    /staging identity and real schema approval required/,
  );
  await assert.rejects(
    query(
      "BEGIN;ALTER TABLE public.world_sessions RENAME COLUMN conflicted TO unexpected;SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';SET LOCAL mapgame.legacy_schema_reviewed='yes';" +
        draft + "ROLLBACK;",
    ),
    /schema contract mismatch/,
  );
  assert.equal(
    await query(
      "SELECT count(*) FROM information_schema.columns WHERE table_name='world_sessions' AND column_name='conflicted'",
    ),
    "1",
  );
});
test("draft refuses active economy, duplicate legacy sessions and unknown RPC overloads", async () => {
  const draft = fs.readFileSync(
    path.join(__dirname, "../draft/000_staging_legacy_security.DRAFT.sql"),
    "utf8",
  );
  const approved =
    "SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';SET LOCAL mapgame.legacy_schema_reviewed='yes';";
  await assert.rejects(
    query(
      "BEGIN;UPDATE cw041.settings SET enabled=true;" + approved + draft +
        "ROLLBACK;",
    ),
    /disable economy/,
  );
  await assert.rejects(
    query(
      "BEGIN;CREATE FUNCTION public.map_game_start_session(integer) RETURNS boolean LANGUAGE sql AS 'SELECT true';" +
        approved + draft + "ROLLBACK;",
    ),
    /session signatures/,
  );
  await assert.rejects(
    query(
      `BEGIN;DROP INDEX public.staging_one_session_per_world_actor;
 INSERT INTO public.world_sessions(world_id,session_id,user_id) VALUES('central','${uuid()}','${a}'),('central','${uuid()}','${a}');` +
        approved + draft + "ROLLBACK;",
    ),
    /duplicate sessions/,
  );
  assert.equal(await query("SELECT enabled FROM cw041.settings"), "f");
  assert.equal(await query("SELECT count(*) FROM public.world_sessions"), "0");
});
test("real SQL session guard integrates with existing handler: two owners, concurrent replay and expiry", async () => {
  const { createHandler } = await import("../../handler.mjs");
  const { serverEngine, freshState } = await import("../../engine.mjs");
  const sa = await join(a), sb = await join(b);
  await claim(a, "T_190_27");
  await claim(b, "T_140_180");
  await query("UPDATE cw041.settings SET enabled=true"); // isolated test only, rolled off by next reset
  const h = createHandler({
    enabled: true,
    origins: ["https://synthetic.test"],
    auth: async (token) =>
      [a, b].includes(token)
        ? { id: token, email_confirmed_at: "2026-01-01" }
        : null,
    verifySession: async (token, id) => (await beat(token, id)) === "t",
    rpc,
  });
  const send = async (actor, data) => {
    const r = await h(
      new Request("https://synthetic.test", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + actor,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }),
    );
    return { status: r.status, body: await r.json() };
  };
  const E = serverEngine(), def = E.defs.find((d) => d.id === "smallHouse");
  function site(territory) {
    for (let z = 200; z < 12000; z += 180) {
      for (let x = 200; x < 12000; x += 180) {
        if (
          E.model.placement(freshState(Date.now()), def, {
            territoryId: territory,
            x,
            z,
            rotation: 0,
          }, E.terrain).allowed
        ) {
          return { x, z };
        }
      }
    }
    throw Error("No synthetic site");
  }
  const pa = {
    action: "place",
    operationId: uuid(),
    sessionId: sa,
    buildingId: "smallHouse",
    territoryId: "T_190_27",
    ...site("T_190_27"),
    rotation: 0,
  };
  const [one, two] = await Promise.all([send(a, pa), send(a, pa)]);
  assert.equal(one.status, 200, JSON.stringify(one));
  assert.deepEqual(one, two);
  assert.equal(
    one.body.snapshot.balances.money,
    String(388000n * 300000000000n),
  );
  const pb = { ...pa, operationId: uuid(), sessionId: sb };
  assert.equal((await send(b, pb)).status, 403);
  assert.equal(
    (await send(b, { ...pb, territoryId: "T_140_180", ...site("T_140_180") }))
      .status,
    200,
  );
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "2");
  await query(
    `UPDATE public.world_sessions SET last_seen=clock_timestamp()-interval '91 seconds' WHERE user_id='${a}'`,
  );
  assert.equal((await send(a, pa)).status, 403);
  assert.equal(await query("SELECT count(*) FROM cw041.buildings"), "2");
  await query("UPDATE cw041.settings SET enabled=false");
});

test('termination is owner-only idempotent cleanup, including stale and conflicted sessions',async()=>{
 const sa=await join(a),sb=await join(b);
 await query(`UPDATE public.world_sessions SET last_seen=clock_timestamp()-interval '91 seconds',conflicted=true WHERE session_id='${sa}'`);
 assert.equal(await beat(a,sa),'f');
 assert.equal(await as(b,`SELECT public.map_game_end_session('central','${sa}')`),'t');
 assert.equal(await query(`SELECT count(*) FROM public.world_sessions WHERE session_id='${sa}'`),'1');
 assert.equal(await as(a,`SELECT public.map_game_end_session('central','${sa}')`),'t');
 assert.equal(await as(a,`SELECT public.map_game_end_session('central','${sa}')`),'t');
 assert.equal(await query(`SELECT count(*) FROM public.world_sessions WHERE session_id='${sa}'`),'0');
 assert.equal(await beat(b,sb),'t');
});
test('expired membership cannot authorize claims; explicit rejoin restores only its owner',async()=>{
 const sa=await join(a);await join(b);
 await query(`UPDATE public.world_sessions SET last_seen=clock_timestamp()-interval '91 seconds' WHERE session_id='${sa}'`);
 await deny(claim(a,'T_190_27'));
 await deny(as(b,`SELECT public.map_game_start_session('central','${sa}','Synthetic')`));
 await as(a,`SELECT public.map_game_start_session('central','${sa}','Synthetic')`);
 await claim(a,'T_190_27');
 assert.equal(await query("SELECT count(*) FROM public.territory_claims"),'1');
});
