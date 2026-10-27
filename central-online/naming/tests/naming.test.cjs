const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { query, rpc, quote } = require("./pg.cjs");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  M = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  R = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  BUILD = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
let policy, handler, createNamingHandler, compilePolicy;
const op = (extra) => ({
  operationId: crypto.randomUUID(),
  action: "rename",
  kind: "username",
  entity: A,
  name: "FrontierOne",
  ...extra,
});
async function send(data, actor = A, h = handler) {
  const r = await h(
    new Request("https://names.test", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + actor,
        "Content-Type": "application/json",
        Origin: "https://game.test",
      },
      body: JSON.stringify(data),
    }),
  );
  return { status: r.status, data: await r.json() };
}
async function display(kind = "username", entity = A) {
  return (await rpc("cw041_names_public", { p_kind: kind, p_entity: entity }))
    .display;
}
async function reset() {
  await query(
    `TRUNCATE cw041_names.config;INSERT INTO cw041_names.config(singleton,attempt_limit) VALUES(true,100);TRUNCATE cw041_names.names,cw041_names.username_keys,cw041_names.username_skeletons,cw041_names.attempts,cw041_names.reviews,cw041_names.reports,cw041_names.audit,cw041_names.legacy_review,cw041_names.actors,cw041_names.moderators RESTART IDENTITY;INSERT INTO cw041_names.moderators VALUES('${M}',true,true,true),('${R}',true,false,false);UPDATE auth.users SET raw_user_meta_data='{"username":"old-unreviewed","privateField":"keep"}';UPDATE public.world_members SET username='old-unreviewed';UPDATE public.territory_claims SET owner_username='old-unreviewed';UPDATE cw041.settings SET enabled=false;UPDATE public.capitals SET name='old-unreviewed',owner_username='old-unreviewed';SELECT cw041_names.activate('${policy.hash}');UPDATE cw041.settings SET enabled=true;`,
  );
}
before(async () => {
  ({ compilePolicy } = await import("../policy.mjs"));
  policy = await compilePolicy(require("./fixture-policy.json"), {
    allowTestPolicy: true,
  });
  ({ createNamingHandler } = await import("../handler.mjs"));
  handler = createNamingHandler({
    enabled: true,
    origins: ["https://game.test"],
    policy,
    rpc,
    auth: async (token) =>
      [A, B, M, R].includes(token)
        ? { id: token, email_confirmed_at: "2026-01-01" }
        : null,
  });
  await query(
    `UPDATE cw041.settings SET enabled=false;INSERT INTO auth.users(id,email_confirmed_at) VALUES('${A}',now()),('${B}',now()),('${M}',now()),('${R}',now());INSERT INTO public.world_members VALUES('central','${A}',NULL),('central','${B}',NULL);UPDATE public.territory_claims SET owner_id='${A}' WHERE territory_id='T_190_27';INSERT INTO public.capitals(world_id,owner_id,territory_id,x,z,name) VALUES('central','${A}','T_190_27',1000,1000,'old');INSERT INTO cw041_names.bindings VALUES('kingdom','k1','${A}','isolated-fixture:kingdom'),('alliance','a1','${A}','isolated-fixture:alliance');UPDATE cw041.settings SET enabled=true;`,
  );
  // A real Checkpoint-1 purchase fixture, not client-authoritative construction.
  const E = await import("../../backend/engine.mjs"),
    old = require("../../backend/tests/postgres.cjs");
  const intent = {
    action: "place",
    buildingId: "smallHouse",
    territoryId: "T_190_27",
    x: 200,
    z: 200,
    rotation: 0,
  };
  const context = await old.rpc("cw041_context", {
      p_actor: A,
      p_operation: BUILD,
      p_intent: intent,
    }),
    result = E.processIntent(context, { operationId: BUILD, intent }, A);
  assert.equal(result.receipt.code, "placed");
  await old.rpc("cw041_commit", {
    p_actor: A,
    p_operation: BUILD,
    p_revision: context.revision,
    p_release: E.manifest.hash,
    p_state: result.state,
    p_complete: true,
    p_target: null,
    p_receipt: result.receipt,
    p_building: result.building,
  });
});
test("activation quarantines old names, keeps auth/private metadata and ownership/economy intact", async () => {
  await reset();
  assert.equal(await display(), "Player");
  assert.equal(
    await query(
      `SELECT raw_user_meta_data->>'privateField' FROM auth.users WHERE id='${A}'`,
    ),
    "keep",
  );
  assert.equal(
    await query(
      "SELECT owner_id FROM public.territory_claims WHERE territory_id='T_190_27'",
    ),
    A,
  );
  assert.equal(
    await query(`SELECT count(*)>0 FROM cw041_names.legacy_review`),
    "t",
  );
});
test("case-insensitive concurrent claims and Unicode lookalikes cannot create duplicate usernames", async () => {
  await reset();
  const r = await Promise.all([
    send(op({ name: "NorthStar" }), A),
    send(op({ entity: B, name: "northstar" }), B),
  ]);
  assert.equal(r.filter((x) => x.status === 200).length, 1, JSON.stringify(r));
  assert.equal(r.filter((x) => x.data.code === "name_unavailable").length, 1);
  await reset();
  assert.equal((await send(op({ name: "Straße" }))).status, 200);
  assert.equal((await send(op({ entity: B, name: "STRASSE" }), B)).status, 409);
  await reset();
  assert.equal((await send(op({ name: "mike" }))).status, 200);
  assert.equal((await send(op({ entity: B, name: "rnike" }), B)).status, 409);
});
test("username cooldown uses only DB time; case changes, metadata and forged timestamps cannot bypass it", async () => {
  await reset();
  const first = op();
  assert.equal((await send(first)).status, 200);
  const nativeNow = Date.now;
  try {
    Date.now = () => nativeNow() + 86400000000;
    assert.equal(
      (await send(op({ name: "ClockBypass" }))).data.code,
      "username_cooldown",
    );
  } finally {
    Date.now = nativeNow;
  }
  const before = await query(
    `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
  );
  assert.equal(
    (await send(op({ name: "OtherName" }))).data.code,
    "username_cooldown",
  );
  assert.equal(
    (await send(op({ name: "FRONTIERONE" }))).data.code,
    "username_cooldown",
  );
  assert.equal(
    (await send(op({ name: "OtherName", changedAt: "2000-01-01" }))).status,
    400,
  );
  await assert.rejects(
    query(
      `UPDATE auth.users SET raw_user_meta_data=jsonb_set(raw_user_meta_data,'{username}','"Admin"') WHERE id='${A}'`,
    ),
    /public_name_endpoint_required/,
  );
  assert.equal(
    await query(
      `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
    ),
    before,
  );
  await query(
    `UPDATE cw041_names.names SET changed_at=clock_timestamp()-interval '2 hours 1 second' WHERE kind='username' AND entity='${A}'`,
  );
  assert.equal((await send(op({ name: "OtherName" }))).status, 200);
});
test("concurrent renames of one account serialize and idempotent replay never restarts cooldown", async () => {
  await reset();
  const r = await Promise.all([
    send(op({ name: "FirstOne" })),
    send(op({ name: "SecondOne" })),
  ]);
  assert.equal(r.filter((x) => x.status === 200).length, 1);
  assert.equal(r.filter((x) => x.data.code === "username_cooldown").length, 1);
  await reset();
  const request = op(), a = await send(request);
  assert.deepEqual(await send(request), a);
  assert.equal((await send({ ...request, name: "ChangedIntent" })).status, 409);
});
test("same policy protects all kinds; fake entity ownership and direct Supabase writes fail", async () => {
  await reset();
  for (
    const [kind, entity] of [["username", A], ["city", A], ["kingdom", "k1"], [
      "alliance",
      "a1",
    ], ["building", A + ":" + BUILD]]
  ) {
    assert.equal((await send(op({ kind, entity, name: "Shit" }))).status, 409);
    assert.equal(
      (await send(
        op({
          kind,
          entity,
          name: kind === "username" ? "CleanName" : "Clean Meadow",
        }),
      )).status,
      200,
      kind,
    );
  }
  assert.equal(
    (await send(
      op({ kind: "kingdom", entity: "k1", name: "Stolen Kingdom" }),
      B,
    )).status,
    403,
  );
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      query(`SET ROLE ${role};UPDATE cw041_names.names SET display='Admin'`),
      /permission denied/,
    );
    await assert.rejects(
      query(
        `SET ROLE ${role};SELECT public.cw041_names_finish('${A}','${crypto.randomUUID()}','${policy.hash}','approve','{}')`,
      ),
      /permission denied/,
    );
  }
  assert.equal(
    await query(
      `SELECT state#>>'{economy,precision,money}' FROM cw041.accounts WHERE actor='${A}'`,
    ),
    String(388000n * 300000000000n),
  );
});
test("legacy label writes are canonicalized without changing joins, claims or private auth fields", async () => {
  await reset();
  await send(op());
  await query(
    `SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${A}',false);UPDATE public.world_members SET username='Admin' WHERE user_id='${A}';UPDATE public.territory_claims SET owner_username='Admin' WHERE owner_id='${A}';UPDATE public.capitals SET name='Admin',owner_username='Admin' WHERE owner_id='${A}';`,
  );
  assert.equal(
    await query(
      `SELECT username FROM public.world_members WHERE user_id='${A}'`,
    ),
    "FrontierOne",
  );
  assert.equal(
    await query(
      `SELECT owner_username FROM public.territory_claims WHERE owner_id='${A}'`,
    ),
    "FrontierOne",
  );
  assert.equal(
    await query(`SELECT name FROM public.capitals WHERE owner_id='${A}'`),
    "Unnamed city",
  );
  await query(
    `INSERT INTO auth.users(id,email_confirmed_at,raw_user_meta_data) VALUES('ffffffff-ffff-4fff-8fff-ffffffffffff',now(),'{"username":"Admin","privateField":"kept"}')`,
  );
  assert.equal(
    await query(
      `SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff'`,
    ),
    "Player",
  );
});
test("rejected naming attempts count toward persistent rate limits and do not disclose policy rules", async () => {
  await reset();
  await query("UPDATE cw041_names.config SET attempt_limit=3");
  for (let i = 0; i < 3; i++) {
    const r = await send(op({ name: "SH1T" }));
    assert.equal(r.status, 409);
    assert.equal(JSON.stringify(r).includes("profanity"), false);
  }
  assert.equal((await send(op({ name: "GoodName" }))).status, 429);
  assert.equal(await display(), "Player");
});
test("reports deduplicate without hiding automatically; unauthorized moderation and metadata roles fail", async () => {
  await reset();
  await send(op());
  for (let i = 0; i < 2; i++) {
    assert.equal(
      (await send({
        operationId: crypto.randomUUID(),
        action: "report",
        kind: "username",
        entity: A,
        reason: "impersonation",
      }, B)).status,
      200,
    );
  }
  assert.equal(await query("SELECT count(*) FROM cw041_names.reports"), "1");
  assert.equal(await display(), "FrontierOne");
  for (const actor of [B, R]) {
    assert.equal(
      (await send({
        operationId: crypto.randomUUID(),
        action: "hide",
        revision: 1,
        kind: "username",
        entity: A,
        reason: "privacy",
      }, actor)).status,
      403,
    );
    assert.equal(
      (await send(
        op({
          action: "force_rename",
          revision: 1,
          name: "NewIdentity",
          reason: "correction",
        }),
        actor,
      )).status,
      403,
    );
  }
  await query(
    `UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data||'{"role":"admin"}' WHERE id='${B}'`,
  );
  assert.equal((await send({ action: "queue" }, B)).status, 403);
});
test("authorized hide scrubs public mirrors; forced rename is checked and cannot be undone via cooldown", async () => {
  await reset();
  await send(op());
  assert.equal(
    (await send({
      operationId: crypto.randomUUID(),
      action: "hide",
      revision: 1,
      kind: "username",
      entity: A,
      reason: "privacy",
    }, M)).status,
    200,
  );
  assert.equal(await display(), "Player");
  assert.equal(
    await query(
      `SELECT username FROM public.world_members WHERE user_id='${A}'`,
    ),
    "Player",
  );
  assert.equal(
    (await send(
      op({
        action: "force_rename",
        revision: 2,
        name: "Admin",
        reason: "correction",
      }),
      M,
    )).status,
    409,
  );
  assert.equal(
    (await send(
      op({
        action: "force_rename",
        revision: 2,
        name: "SafeIdentity",
        reason: "correction",
      }),
      M,
    )).status,
    200,
  );
  assert.equal(
    (await send(op({ name: "OldIdentity" }))).data.code,
    "username_cooldown",
  );
});
test("ambiguous scripts enter private manual review; approval is role-gated and cannot override hard rejections", async () => {
  await reset();
  const proposed = await send(op({ name: "Аlexander" }));
  assert.equal(proposed.status, 202, JSON.stringify(proposed));
  assert.equal(await display(), "Player");
  const review = {
    operationId: crypto.randomUUID(),
    action: "review",
    reviewId: proposed.data.reviewId,
    decision: "approve",
  };
  assert.equal((await send(review, B)).status, 403);
  assert.equal((await send(review, R)).status, 200);
  assert.equal(await display(), "Аlexander");
  assert.equal((await send({ action: "queue" }, B)).status, 403);
});
test("stale reviews and policy version changes cannot overwrite newer names", async () => {
  await reset();
  const proposed = await send(
    op({ kind: "city", entity: A, name: "Аlexandria" }),
  );
  assert.equal(proposed.status, 202);
  await send(op({ kind: "city", entity: A, name: "New Harbor" }));
  const r = await send({
    operationId: crypto.randomUUID(),
    action: "review",
    reviewId: proposed.data.reviewId,
    decision: "approve",
  }, R);
  assert.equal(r.status, 409);
  assert.equal(await display("city", A), "New Harbor");
  await query(`UPDATE cw041_names.config SET policy_hash=repeat('0',64)`);
  assert.equal(
    (await send(op({ kind: "city", entity: A, name: "Other Harbor" }))).status,
    503,
  );
  assert.equal(await display("city", A), "New Harbor");
});
test("server endpoint is off by default, rejects fake approvals and oversized input", async () => {
  await reset();
  const off = createNamingHandler({
    enabled: false,
    origins: ["https://game.test"],
    policy,
    auth: async () => null,
    rpc,
  });
  assert.equal((await send(op(), A, off)).status, 503);
  assert.equal((await send(op({ decision: "approve" }))).status, 400);
  assert.equal((await send(op({ name: "x".repeat(5000) }))).status, 413);
  assert.equal((await send(op(), "invalid")).status, 403);
});
test("retired usernames stay reserved; retention removes raw attempts without reopening replay or cooldown", async () => {
  await reset();
  const req = op({ name: "OldHandle" });
  const first = await send(req);
  await query(
    `UPDATE cw041_names.names SET changed_at=clock_timestamp()-interval '3 hours' WHERE kind='username' AND entity='${A}'`,
  );
  assert.equal((await send(op({ name: "NewHandle" }))).status, 200);
  assert.equal(
    (await send(op({ entity: B, name: "OLDHANDLE" }), B)).status,
    409,
  );
  await query(
    `UPDATE cw041_names.attempts SET created_at=clock_timestamp()-interval '31 days';SELECT cw041_names.purge()`,
  );
  assert.equal(
    await query("SELECT count(*) FROM cw041_names.attempts WHERE intent<>'{}'"),
    "0",
  );
  assert.deepEqual(await send(req), first);
  assert.equal(await display(), "NewHandle");
});
test("public batch names hide moderated labels and never disclose private review/audit/filter data", async () => {
  await reset();
  await send(op());
  const q = async () =>
    JSON.parse(
      await query(
        `SET ROLE authenticated;SELECT public.cw041_names_public_batch('[{"kind":"username","entity":"${A}"}]')`,
      ),
    );
  assert.equal((await q()).names[0].display, "FrontierOne");
  await send({
    operationId: crypto.randomUUID(),
    action: "hide",
    revision: 1,
    kind: "username",
    entity: A,
    reason: "privacy",
  }, M);
  assert.equal((await q()).names[0].display, "Player");
  for (const key of ["candidate", "policy_hash", "canonical_key", "skeleton"]) {
    assert(!JSON.stringify(await q()).includes(key));
  }
  await assert.rejects(
    query("SET ROLE authenticated;SELECT * FROM cw041_names.moderators"),
    /permission denied/,
  );
});
test("manual approval cannot bypass a current cooldown or resurrect a hard-rejected name", async () => {
  await reset();
  await send(op());
  const q = await send(op({ name: "ВetaUser" }));
  assert.equal(q.status, 202);
  const r = await send({
    operationId: crypto.randomUUID(),
    action: "review",
    reviewId: q.data.reviewId,
    decision: "approve",
  }, R);
  assert.equal(r.data.code, "username_cooldown");
  assert.equal(await display(), "FrontierOne");
  await reset();
  const bad = crypto.randomUUID();
  await query(
    `INSERT INTO cw041_names.reviews(id,actor,kind,entity,candidate,base_revision,policy_hash) VALUES('${bad}','${A}','username','${A}','{"display":"Admin"}',0,'${policy.hash}')`,
  );
  const denied = await send({
    operationId: crypto.randomUUID(),
    action: "review",
    reviewId: bad,
    decision: "approve",
  }, R);
  assert.equal(denied.data.code, "review_rejected");
  assert.equal(await display(), "Player");
});
test("injected transaction failure leaves registry, cooldown, mirrors and audit unchanged", async () => {
  await reset();
  await query(
    `CREATE FUNCTION cw041_names.test_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'isolated_rollback_test';END$$;CREATE TRIGGER fail BEFORE INSERT ON cw041_names.audit FOR EACH ROW EXECUTE FUNCTION cw041_names.test_fail()`,
  );
  const req = op();
  assert.equal((await send(req)).status, 503);
  assert.equal(await display(), "Player");
  assert.equal(await query("SELECT count(*) FROM cw041_names.names"), "0");
  assert.equal(
    await query("SELECT count(*) FROM cw041_names.username_keys"),
    "0",
  );
  assert.equal(
    await query(
      `SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id='${A}'`,
    ),
    "Player",
  );
  await query(
    "DROP TRIGGER fail ON cw041_names.audit;DROP FUNCTION cw041_names.test_fail()",
  );
  assert.equal((await send(req)).status, 200);
});
test("moderator corrections require the observed revision and can safely initialize a quarantined profile", async () => {
  await reset();
  assert.equal(
    (await send(
      op({
        action: "force_rename",
        name: "CorrectedName",
        reason: "correction",
        revision: 0,
      }),
      M,
    )).status,
    200,
  );
  assert.equal(await display(), "CorrectedName");
  const before = await query(
    `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
  );
  assert.equal(
    (await send({
      operationId: crypto.randomUUID(),
      action: "hide",
      kind: "username",
      entity: A,
      reason: "privacy",
      revision: 0,
    }, M)).status,
    409,
  );
  assert.equal(
    (await send(
      op({
        action: "force_rename",
        name: "StaleCorrection",
        reason: "correction",
        revision: 0,
      }),
      M,
    )).status,
    409,
  );
  assert.equal(await display(), "CorrectedName");
  assert.equal(
    await query(
      `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
    ),
    before,
  );
});
test("private grants, binding creation and activation cannot be forged; auth credentials remain independently editable", async () => {
  await reset();
  for (
    const sql of [
      `INSERT INTO cw041_names.bindings VALUES('kingdom','forged','${B}','fake')`,
      `UPDATE cw041_names.config SET enabled=false`,
      `SELECT cw041_names.activate(repeat('0',64))`,
      `SELECT public.cw041_names_begin('${A}','${crypto.randomUUID()}','{"action":"rename"}')`,
    ]
  ) {
    await assert.rejects(
      query("SET ROLE authenticated;" + sql),
      /permission denied/,
    );
  }
  await query(
    `UPDATE auth.users SET encrypted_password='changed-by-auth-service' WHERE id='${A}'`,
  );
  await send(op());
  assert.equal(
    await query(`SELECT encrypted_password FROM auth.users WHERE id='${A}'`),
    "changed-by-auth-service",
  );
  assert.equal((await send(op({ actor: M }))).status, 400);
});
test("emergency API suspension cannot accidentally disable activated database name guards", async () => {
  await reset();
  await assert.rejects(
    query("UPDATE cw041_names.config SET enabled=false"),
    /suspend_api_not_public_name_guards/,
  );
  await query(
    `UPDATE public.world_members SET username='Admin' WHERE user_id='${A}'`,
  );
  assert.equal(
    await query(
      `SELECT username FROM public.world_members WHERE user_id='${A}'`,
    ),
    "Player",
  );
});
test("unknown-world legacy capital writes cannot become an unmoderated city-name channel", async () => {
  await reset();
  await query(
    `INSERT INTO public.capitals(world_id,territory_id,owner_id,x,z,name,owner_username) VALUES('unconfigured-world','T_1_1','${A}',1000,1000,'Admin','Admin')`,
  );
  assert.equal(
    await query(
      "SELECT name FROM public.capitals WHERE world_id='unconfigured-world'",
    ),
    "Unnamed city",
  );
  assert.equal(
    await query(
      "SELECT owner_username FROM public.capitals WHERE world_id='unconfigured-world'",
    ),
    "Player",
  );
  await query(
    "DELETE FROM public.capitals WHERE world_id='unconfigured-world'",
  );
});
test("review outcomes become terminal replay receipts; overdue private candidates expire without changing names", async () => {
  await reset();
  const req = op({ name: "Аlexander" }), pending = await send(req);
  await send({
    operationId: crypto.randomUUID(),
    action: "review",
    reviewId: pending.data.reviewId,
    decision: "approve",
  }, R);
  assert.equal((await send(req)).data.code, "review_approved");
  const stamp = await query(
    `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
  );
  assert.equal((await send(req)).status, 200);
  assert.equal(
    await query(
      `SELECT changed_at FROM cw041_names.names WHERE kind='username' AND entity='${A}'`,
    ),
    stamp,
  );
  await reset();
  const next = op({ name: "Аlexander" });
  assert.equal((await send(next)).status, 202);
  await query(
    `UPDATE cw041_names.attempts SET created_at=clock_timestamp()-interval '31 days';UPDATE cw041_names.reviews SET created_at=clock_timestamp()-interval '31 days';SELECT cw041_names.purge()`,
  );
  assert.equal((await send(next)).data.code, "review_expired");
  assert.equal(await query("SELECT count(*) FROM cw041_names.reviews"), "0");
  assert.equal(await display(), "Player");
});
test("UUID casing and extra entity segments cannot fork a username cooldown or fake a building binding", async () => {
  await reset();
  await send(op());
  const changed = await send(
    op({ entity: A.toUpperCase(), name: "NamespaceBypass" }),
  );
  assert.equal(changed.data.code, "username_cooldown");
  assert.equal(
    await query("SELECT count(*) FROM cw041_names.names WHERE kind='username'"),
    "1",
  );
  assert.equal(
    (await send(
      op({
        kind: "building",
        entity: A + ":" + BUILD + ":extra",
        name: "Fake Site",
      }),
    )).status,
    400,
  );
  await assert.rejects(
    rpc("cw041_names_begin", {
      p_actor: A,
      p_operation: crypto.randomUUID(),
      p_intent: {
        action: "rename",
        kind: "username",
        entity: A.toUpperCase(),
        name: "UnsafeAlias",
      },
    }),
    /invalid_entity/,
  );
});
