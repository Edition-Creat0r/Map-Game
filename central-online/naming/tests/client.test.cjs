const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const code = fs.readFileSync(require.resolve("../client.js"), "utf8");
function setup(enabled) {
  const timeouts = [], events = [], requests = [];
  const window = {
    mapGameNamingConfig: { enabled },
    mapGameAuth: {
      client: {
        rpc: async (name, args) => {
          requests.push({ name, args });
          return {
            data: {
              enabled: true,
              names: args.p_requests.map((r) => ({
                ...r,
                display: r.kind === "username" ? "SafePlayer" : "Safe City",
              })),
            },
          };
        },
      },
    },
    dispatchEvent: (e) => events.push(e),
    mapGameMultiplayer: { getState: () => ({ connected: true }) },
  };
  const context = {
    window,
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout: (f) => {
      timeouts.push(f);
      return 1;
    },
    setInterval: () => {},
    Date,
    Map,
  };
  vm.runInNewContext(code, context);
  return { api: window.mapGamePublicNames, window, requests, timeouts, events };
}
test("disabled adapter does no requests and preserves legacy row identities", () => {
  const s = setup(false), row = { owner_id: "actor", owner_username: "old" };
  assert.equal(s.api.project(row, "claim"), row);
  assert.equal(s.requests.length, 0);
  assert.equal(s.timeouts.length, 0);
});
test("enabled adapter never displays forged presence/claim/city names and preserves IDs", async () => {
  const s = setup(true), row = { userId: "actor", username: "Admin" };
  let safe = s.api.project(row, "presence");
  assert.equal(safe.username, "Player");
  assert.equal(safe.userId, "actor");
  assert.equal(s.timeouts.length, 0);
  safe = s.api.project(row, "presence");
  assert.equal(safe.username, "Player");
  s.api.username("actor");
  await s.timeouts.shift()();
  assert.equal(row.username, "Admin");
  const claim = s.api.project({
    owner_id: "actor",
    owner_username: "Spoofed",
    territory_id: "T_1_2",
  }, "claim");
  assert.equal(claim.owner_username, "SafePlayer");
  assert.equal(claim.territory_id, "T_1_2");
  const city = s.api.project({ owner_id: "actor", name: "Evil" }, "capital");
  assert.equal(city.name, "Unnamed city");
  await s.timeouts.shift()();
  assert.equal(
    s.api.project({ owner_id: "actor", name: "Evil" }, "capital").name,
    "Safe City",
  );
  assert(s.requests.every((r) => r.name === "cw041_names_public_batch"));
});
test("failed approved-label reads fall back safely without trusting sender text", async () => {
  const s = setup(true);
  s.window.mapGameAuth.client.rpc = async () => ({ error: Error("offline") });
  assert.equal(
    s.api.project({ userId: "x", username: "Admin" }, "presence").username,
    "Player",
  );
  s.api.username("x");
  await s.timeouts.shift()();
  assert.equal(
    s.api.project({ userId: "x", username: "Admin" }, "presence").username,
    "Player",
  );
});
