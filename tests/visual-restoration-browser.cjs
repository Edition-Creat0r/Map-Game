const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = process.argv[2] || "/tmp/map-game-visuals",
  origin = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    r = {
      origin,
      world: "singleplayer",
      errors: [],
      http: [],
      failed: [],
      views: [],
    };
  p.on("pageerror", (e) => r.errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") r.errors.push(m.text());
  });
  p.on("requestfailed", (q) => r.failed.push(q.url()));
  p.on("response", (q) => {
    if (q.status() >= 400) r.http.push([q.url(), q.status()]);
  });
  const start = Date.now();
  await p.goto(origin);
  await p.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  r.bootMs = Date.now() - start;
  await p.click("#mgStartSingle");
  await p.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  async function capture(name) {
    const state = await p.evaluate(() => mapGameBasicWorld.getState());
    await p.screenshot({ path: path.join(out, name + ".png") });
    r.views.push({
      name,
      ...state,
      biome: await p.evaluate(() => {
        const s = mapGameBasicWorld.getState();
        return mapGameBasicWorld.sample(s.cameraX, s.cameraZ).biome.id;
      }),
      forest: await p.evaluate(() => mapGameBasicWorld.forestStats()),
    });
  }
  async function enter(x, y) {
    await p.evaluate(
      async ({ x, y }) => {
        mapGameStrategicWorld.close();
        await mapGameRuntime.enterTerritory({ x, y, id: `T_${x}_${y}` });
      },
      { x, y },
    );
    await p.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
    await p.waitForTimeout(3000);
  }
  for (const [name, x, y] of [
    ["temperate", 140, 180],
    ["grassland", 48, 160],
    ["taiga", 256, 64],
    ["wetlands", 260, 108],
    ["mountains", 168, 75],
    ["mixed-biome", 190, 27],
    ["river", 154, 152],
    ["lake", 67, 22],
  ]) {
    await enter(x, y);
    if (name === "river") {
      const target = {
        x: 5057768.749117619 - 154 * 32768,
        z: 4990156.036991262 - 152 * 32768,
      };
      for (let i = 0; i < 50; i++) {
        const s = await p.evaluate(() => mapGameBasicWorld.getState()),
          dx = Math.max(-250, Math.min(250, (s.cameraX - target.x) * s.zoom)),
          dy = Math.max(-250, Math.min(250, (s.cameraZ - target.z) * s.zoom));
        if (Math.abs(dx) + Math.abs(dy) < 0.01) break;
        await p.mouse.move(700, 500);
        await p.mouse.down();
        await p.mouse.move(700 + dx, 500 + dy, { steps: 3 });
        await p.mouse.up();
      }
      await p.waitForTimeout(1800);
    }
    await capture(name + "-normal");
    if (name === "temperate") {
      const box = await p.locator("#basicCanvas").boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 12; i++) {
        await p.mouse.wheel(0, -100);
        await p.waitForTimeout(80);
      }
      await p.waitForTimeout(2200);
      await capture("temperate-close");
    }
  }
  await p.evaluate(() => mapGameRuntime.showWorldMap());
  await p.waitForTimeout(1500);
  r.worldMap = await p.evaluate(() => mapGameStrategicWorld.getState());
  await p.screenshot({ path: path.join(out, "world-map.png") });
  await enter(190, 27);
  await p.click('[data-action="shop"]');
  await p.screenshot({ path: path.join(out, "shop.png") });
  await p.click("#mgEconomyShop [data-close]");
  await p.click('[data-c1="research"]');
  await p.screenshot({ path: path.join(out, "research.png") });
  await p.click("[data-c1-close]");
  await p.click('[data-c1="more"]');
  await p.click('[data-action="economy"]');
  await p.locator("[data-inventory]").evaluate((e) => (e.open = true));
  await p.screenshot({ path: path.join(out, "inventory.png") });
  r.textureStats = await p.evaluate(
    () => mapGameBasicWorld.textureStats?.() || null,
  );
  if (r.textureStats)
    assert.ok(
      r.textureStats.length === 8 && r.textureStats.every((x) => x.loaded),
    );
  r.images = await p.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((x) => /trees|textures/.test(x.name))
      .map((x) => ({ url: x.name, ms: x.duration })),
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.http, []);
  assert.deepEqual(r.failed, []);
  fs.writeFileSync(path.join(out, "visuals.json"), JSON.stringify(r, null, 2));
  console.log(
    JSON.stringify({
      bootMs: r.bootMs,
      views: r.views.map((x) => ({
        name: x.name,
        zoom: x.zoom,
        trees: x.forest.drawn,
      })),
      errors: r.errors,
    }),
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
