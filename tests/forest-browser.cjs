const { chromium } = require("playwright-core"),
  fs = require("fs");
const output = process.argv[2] || "/tmp/map-game-forest-validation";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const out = { errors: [], http: [] };
  p.on("pageerror", (e) => out.errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") out.errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) out.http.push([r.url(), r.status()]);
  });
  await p.goto(process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8000");
  await p.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await p.locator("#mgStartSingle").click();
  await p.evaluate(async () => {
    mapGameStrategicWorld.close();
    await mapGameRuntime.enterTerritory({ x: 140, y: 180, id: "T_140_180" });
  });
  await p.waitForTimeout(1200);
  const box = await p.locator("#basicCanvas").boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const snapshot = () =>
    p.evaluate(() =>
      mapGameForest.treesInBounds(
        140 * 32768 + 16000,
        180 * 32768 + 16000,
        140 * 32768 + 17000,
        180 * 32768 + 17000,
      ),
    );
  out.rootsBefore = await snapshot();
  out.frames = {};
  async function frames() {
    return p.evaluate(
      () =>
        new Promise((resolve) => {
          let a = [],
            s = performance.now();
          function f(t) {
            a.push(t);
            if (t - s < 2200) requestAnimationFrame(f);
            else {
              let d = a
                .slice(1)
                .map((v, i) => v - a[i])
                .sort((a, b) => a - b);
              resolve({
                fps: ((a.length - 1) * 1000) / (a.at(-1) - a[0]),
                p95: d[Math.floor(d.length * 0.95)],
                max: d.at(-1),
              });
            }
          }
          requestAnimationFrame(f);
        }),
    );
  }
  const transitionTiming = frames();
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let i = 0; i < 12; i++) await p.mouse.wheel(0, -100);
    for (let i = 0; i < 12; i++) await p.mouse.wheel(0, 100);
  }
  out.rootsAfter = await snapshot();
  if (JSON.stringify(out.rootsBefore) !== JSON.stringify(out.rootsAfter))
    throw Error("LOD changed trees");
  await p.waitForTimeout(2000);
  out.frames.transitions = await transitionTiming;
  for (let i = 0; i < 28; i++) await p.mouse.wheel(0, -100);
  await p.waitForTimeout(2200);
  out.stats = await p.evaluate(() => mapGameBasicWorld.forestStats());
  if (out.stats.records > 8192 || out.stats.tiles > 120)
    throw Error("Cache exceeded limit");
  let timing = frames();
  await p.mouse.down();
  await p.mouse.move(
    box.x + box.width / 2 + 240,
    box.y + box.height / 2 + 100,
    { steps: 50 },
  );
  await p.mouse.up();
  out.frames.maxZoomPan = await timing;
  await p.screenshot({ path: output + "/forest-temperate-close.png" });
  await p.waitForFunction(() => mapGameBasicWorld.forestStats().queued === 0);
  out.buildBeforeIdle = await p.evaluate(
    () => mapGameBasicWorld.forestStats().built,
  );
  await p.waitForTimeout(1500);
  out.buildAfterIdle = await p.evaluate(
    () => mapGameBasicWorld.forestStats().built,
  );
  for (const [name, x, y] of [
    ["taiga", 256, 64],
    ["wetlands", 260, 108],
    ["grassland", 48, 160],
    ["tundra", 4, 0],
  ]) {
    await p.evaluate(
      async ({ x, y }) =>
        mapGameRuntime.enterTerritory({ x, y, id: `T_${x}_${y}` }),
      { x, y },
    );
    for (let i = 0; i < 12; i++) await p.mouse.wheel(0, -100);
    await p.waitForTimeout(1700);
    await p.screenshot({ path: `${output}/forest-${name}.png` });
  }
  if (out.buildAfterIdle !== out.buildBeforeIdle)
    throw Error("Idle forest regenerated");
  await p.evaluate(() => mapGameRuntime.showWorldMap());
  for (const center of [
    { x: 0, y: 0 },
    { x: 300, y: 300 },
    { x: 158, y: 158 },
  ]) {
    await p.evaluate((center) => {
      mapGameStrategicWorld.close();
      mapGameStrategicWorld.open({ worldType: "singleplayer", center });
    }, center);
    await p.waitForTimeout(25);
  }
  await p.waitForFunction(
    () => mapGameStrategicWorld.getState().queuedRegions === 0,
    { timeout: 30000 },
  );
  await p.waitForTimeout(100);
  out.streamReopen = await p.evaluate(() => mapGameStrategicWorld.getState());
  if (out.errors.length || out.http.length)
    throw new Error(
      "Forest browser errors: " +
        JSON.stringify({ errors: out.errors, http: out.http }),
    );
  fs.writeFileSync(output + "/forest-lod.json", JSON.stringify(out, null, 2));
  console.log({
    frames: out.frames,
    stats: out.stats,
    errors: out.errors,
    http: out.http,
    roots: out.rootsBefore.length,
    idleBuilds: out.buildAfterIdle - out.buildBeforeIdle,
  });
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
