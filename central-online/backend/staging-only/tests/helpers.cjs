// LOCAL CONTAINER ONLY. Synthetic identities; never a Supabase client.
const { query, rpc, quote } = require("../../tests/postgres.cjs");
const { randomUUID } = require("node:crypto");
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  unverified = "33333333-3333-4333-8333-333333333333";
function as(actor, sql, role = "authenticated") {
  return query(
    `BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claim.sub',${
      quote(actor || "")
    },true);${sql};COMMIT;`,
  ).then((s) => s.split("\n").slice(1).join("\n"));
}
async function reset() {
  await query(
    `TRUNCATE public.capitals,public.territory_claims,public.world_members,public.world_sessions;
 DO $$BEGIN IF to_regclass('cw041.settings') IS NOT NULL THEN
 TRUNCATE cw041.audit,cw041.buildings,cw041.operations,cw041.rate_limits,cw041.accounts RESTART IDENTITY CASCADE;
 UPDATE cw041.settings SET enabled=false; END IF; END$$;`,
  );
}
async function join(actor, id = randomUUID(), old = false) {
  const args = old
    ? `'device','${id}','Synthetic','central'`
    : `'central','${id}','Synthetic'`;
  await as(actor, `SELECT public.map_game_start_session(${args})`);
  await as(
    actor,
    `INSERT INTO public.world_members(world_id,user_id,username) VALUES('central','${actor}','Synthetic') ON CONFLICT(world_id,user_id) DO UPDATE SET last_seen=now()`,
  );
  return id;
}
module.exports = {
  query,
  rpc,
  quote,
  as,
  reset,
  join,
  a,
  b,
  unverified,
  uuid: randomUUID,
};
