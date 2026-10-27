const { test, before } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
let P, p;
const fixture = require("./fixture-policy.json");
before(async () => {
  P = await import("../policy.mjs");
  p = await P.compilePolicy(fixture, { allowTestPolicy: true });
});
test("server policy requires private configuration and refuses deployable test defaults", async () => {
  await assert.rejects(P.compilePolicy(fixture), /Test policy/);
  await assert.rejects(
    P.compilePolicy({ version: 1, terms: [], reserved: [] }),
  );
  assert.match(p.hash, /^[a-f0-9]{64}$/);
});
test("all five kinds apply identical profanity/phrase/obfuscation and impersonation checks", () => {
  for (const kind of P.kinds) {
    for (
      const name of [
        "shit",
        "SH1T",
        "sh١t",
        "s.h.i.t",
        "f_u_c_k",
        "fuuuuuck",
        "fuckyou123",
        "sh1thead",
        "Ａｄｍｉｎ",
        "admіn",
        "Αdmin",
        "Moderator",
        "admin123",
        "offici4l77",
        "moderator500",
        "Official-Town",
        "heil-hitler",
        "sex_slave",
        "sh\u200bit",
        "evil\u202ename",
      ]
    ) assert.equal(p.assess(name, kind).decision, "reject", kind + ":" + name);
  }
});
test("word-aware matching preserves harmless substrings and international names", () => {
  for (
    const s of [
      "Scunthorpe",
      "Dickinson",
      "Penistone",
      "Cockburn",
      "Shiitake Grove",
      "Shitake Grove",
      "Class Harbor",
      "Assistant Meadow",
      "Stafford",
      "Naziha",
      "Admiral Bay",
      "José",
      "Łukasz",
      "Αλέξανδρος",
      "Павел",
      "東京",
      "مريم",
    ]
  ) assert.equal(p.assess(s, "city").decision, "approve", s);
});
test("Unicode case folding and confusable identity skeletons are deterministic", () => {
  assert.equal(P.fold("Straße"), P.fold("STRASSE"));
  assert.equal(P.fold("ΟΣ"), P.fold("ος"));
  assert.equal(P.skeleton("mike"), P.skeleton("rnike"));
  assert.equal(P.skeleton("admin"), P.skeleton("admіn"));
  assert.equal(p.assess("Аlexander", "username").decision, "review");
});
test("controls, invisible marks, oversized strings, scripts and malformed inputs cannot be published", () => {
  for (
    const s of [
      "a",
      "a".repeat(100),
      "<script>",
      "x\u0000y",
      "x\u2066y",
      "x\u200dy",
      "😀😀😀",
    ]
  ) assert.equal(p.assess(s, "username").decision, "reject");
  assert.equal(p.assess(null, "city").decision, "reject");
  assert.equal(p.assess("Main Town", "unknown").decision, "reject");
  assert.equal(p.assess("Main Town", "city").decision, "approve");
});
test("allow exceptions cannot override administrative impersonation", async () => {
  const special = await P.compilePolicy({
    ...fixture,
    allowWhole: ["admin", "Scunthorpe"],
  }, { allowTestPolicy: true });
  assert.equal(special.assess("admin", "username").decision, "reject");
});
