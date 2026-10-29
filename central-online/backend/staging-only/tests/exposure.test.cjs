const { test, beforeEach } = require("node:test"),
  assert = require("node:assert/strict");
const { as, reset, a, b, uuid, query } = require("./helpers.cjs");
beforeEach(reset);
test("synthetic legacy policy permits forged self-session and future heartbeat state", async () => {
  const id = uuid();
  await as(
    a,
    `INSERT INTO public.world_sessions(world_id,session_id,user_id,last_seen) VALUES('central','${id}','${a}',now()+interval '1 year')`,
  );
  assert.equal(
    await as(a, `SELECT public.map_game_session_heartbeat('central','${id}')`),
    "t",
  );
});
test("synthetic legacy start RPC takes over a known victim session ID", async () => {
  const id = uuid();
  await as(
    b,
    `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
  );
  await as(
    a,
    `SELECT public.map_game_start_session('central','${id}','Synthetic')`,
  );
  assert.equal(
    await query(
      `SELECT user_id FROM public.world_sessions WHERE session_id='${id}'`,
    ),
    a,
  );
});
