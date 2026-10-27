// EXPLICIT test-only fallback for an environment-blocked CDN. Not live startup proof.
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  { chromium } = require("playwright-core");
const specs = [
  [
    "https://cdn.babylonjs.com/babylon.js",
    process.env.CW041_BABYLON_CACHE,
    "5e162a4179028c7aa6e110879039a173f67337c170d0788a8733a20d00231f83",
  ],
  [
    "https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js",
    process.env.CW041_LOADERS_CACHE,
    "38096724c9dff7584c4e85ba65b34c8f15394e381815c23071761f05c08a192e",
  ],
];
const bodies = new Map();
for (const [url, file, hash] of specs) {
  if (!file) throw Error("Explicit cached-CDN test mode requires both files");
  const body = fs.readFileSync(file);
  if (crypto.createHash("sha256").update(body).digest("hex") !== hash) {
    throw Error("Cached library fingerprint mismatch");
  }
  bodies.set(url, body);
}
const attach = async (scope) => {
  for (const [url, body] of bodies) {
    await scope.route(
      url,
      (r) => r.fulfill({ contentType: "application/javascript", body }),
    );
  }
  return scope;
};
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const b = await launch(...args),
    context = b.newContext.bind(b),
    page = b.newPage.bind(b);
  b.newContext = async (...a) => attach(await context(...a));
  b.newPage = async (...a) => attach(await page(...a));
  return b;
};
console.log(
  "EXPLICIT CACHED-CDN MODE: Babylon 9.32.0 and loaders; live CDN reachability is NOT validated.",
);
