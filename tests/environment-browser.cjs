const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2] || "/tmp/map-game-environment";
fs.mkdirSync(output, { recursive: true });
const sites = require("./environment-sites.json");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const report = { errors: [], failed: [], http: [], sites: [] };
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  page.on("requestfailed", (r) => report.failed.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) report.http.push([r.url(), r.status()]);
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "mapGame_alpha021_firstPlayable",
      JSON.stringify({ claims: [], customCompatibilityMarker: "keep" }),
    ),
  );
  await page.goto(process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001");
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.locator("#mgStartSingle").click();
  async function enter(name, site) {
    await page.evaluate(async (s) => {
      mapGameStrategicWorld.close();
      await mapGameRuntime.enterTerritory({
        x: s.x,
        y: s.y,
        id: `T_${s.x}_${s.y}`,
      });
    }, site);
    await page.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
    if (site.worldX) {
      const targetX = site.worldX - site.x * 32768,
        targetZ = site.worldZ - site.y * 32768;
      for (let i = 0; i < 30; i++) {
        const state = await page.evaluate(() => mapGameBasicWorld.getState());
        const dx = Math.max(
            -250,
            Math.min(250, (state.cameraX - targetX) * state.zoom),
          ),
          dy = Math.max(
            -250,
            Math.min(250, (state.cameraZ - targetZ) * state.zoom),
          );
        if (Math.abs(dx) + Math.abs(dy) < 1) break;
        await page.mouse.move(700, 500);
        await page.mouse.down();
        await page.mouse.move(700 + dx, 500 + dy, { steps: 3 });
        await page.mouse.up();
      }
    }
    if (name === "biome-transition") {
      await page.mouse.move(700, 500);
      await page.mouse.wheel(0, 100);
    }
    await page.waitForTimeout(300);
    await page.waitForFunction(
      () => {
        const s = mapGameBasicWorld.waterStats();
        return s.ready > 0 && s.queued === 0 && !s.building;
      },
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);
    const data = await page.evaluate(() => {
      const c = document.getElementById("basicCanvas"),
        pixels = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let blue = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i + 2] > pixels[i] + 35 && pixels[i + 1] > pixels[i] + 30)
          blue++;
      return {
        blue,
        water: mapGameBasicWorld.waterStats(),
        state: mapGameBasicWorld.getState(),
      };
    });
    if (name === "river" || name === "shoreline-lake")
      assert.ok(data.blue > 50, `${name} has no visible water`);
    report.sites.push({ name, ...data });
    await page.screenshot({ path: path.join(output, name + ".png") });
  }
  await enter("mountains", sites.mountain);
  await page.mouse.move(720, 500);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -100);
  await page.waitForFunction(
    () => mapGameBasicWorld.getState().cachedChunks >= 12,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(output, "mountains-detail.png") });
  await enter("river", sites.river);
  await enter("shoreline-lake", sites.lake);
  await enter("biome-transition", sites.transition);
  await page.locator('[data-action="map"]').click();
  await page.waitForFunction(() => mapGameStrategicWorld.getState().open);
  await page.waitForFunction(
    () => mapGameStrategicWorld.waterStats()?.ready > 0,
  );
  for (const center of [
    { x: 0, y: 0 },
    { x: 300, y: 300 },
    { x: sites.river.x, y: sites.river.y },
  ]) {
    await page.evaluate(
      (center) =>
        mapGameStrategicWorld.open({ worldType: "singleplayer", center }),
      center,
    );
    await page.waitForTimeout(30);
    assert.ok(
      await page.evaluate(
        () => mapGameStrategicWorld.getState().queuedRegions <= 100,
      ),
      "stale offscreen atlas jobs retained",
    );
  }
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(output, "strategic-environment.png"),
  });
  await page.evaluate(
    (center) =>
      mapGameStrategicWorld.open({ worldType: "singleplayer", center }),
    sites.lake,
  );
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(output, "strategic-lake.png") });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  report.saveCompatible = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mapGame_alpha021_firstPlayable"))
        .customCompatibilityMarker === "keep",
  );
  assert.ok(report.saveCompatible);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.http, []);
  fs.writeFileSync(
    path.join(output, "environment-browser.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    report.sites.map((s) => ({
      name: s.name,
      bluePixels: s.blue,
      edges: s.water.edges,
    })),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
