const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = process.argv[2] || "/tmp/visual-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    r = { errors: [], failed: [], http: [], checks: [] };
  p.on("pageerror", (e) => r.errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") r.errors.push(m.text());
  });
  p.on("requestfailed", (q) => r.failed.push(q.url()));
  p.on("response", (q) => {
    if (q.status() >= 400) r.http.push([q.url(), q.status()]);
  });
  const url = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001";
  async function start() {
    await p.goto(url);
    await p.waitForFunction(
      () => document.querySelector("#mgStartSingle")?.disabled === false,
    );
    await p.click("#mgStartSingle");
    await p.waitForFunction(() => mapGameEconomy.getStatus().enabled);
    await p.evaluate(async () => {
      mapGameStrategicWorld.close();
      await mapGameRuntime.enterTerritory({ x: 140, y: 180, id: "T_140_180" });
    });
    await p.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
  }
  await start();
  await p.waitForFunction(() => mapGameBasicWorld.forestStats().drawn > 0);
  assert.ok(
    (await p.locator("#mgResourceStrip [data-resource]").count()) === 5,
  );
  await p.click("#mgTerrainInspector [data-inspector-toggle]");
  assert.equal(
    await p.locator("#mgTerrainInspector [data-terrain-body]").isVisible(),
    false,
  );
  await p.click("#mgTerrainInspector [data-inspector-toggle]");
  const sceneFrame = await p.evaluate(() => mapGameRuntime.scene.getFrameId());
  await p.waitForTimeout(1100);
  assert.equal(
    await p.evaluate(() => mapGameRuntime.scene.getFrameId()),
    sceneFrame,
  );
  r.checks.push(
    "Normal-zoom trees, five resource chips and collapsible inspector",
  );
  await p.click('[data-action="shop"]');
  await p.locator("[data-search]").fill("smallHouse");
  await p.evaluate(
    () =>
      (window.visualCard = document.querySelector(
        '[data-catalog-id="smallHouse"]',
      )),
  );
  await p.locator('[data-catalog-id="smallHouse"] details summary').click();
  await p.waitForTimeout(2200);
  assert.equal(
    await p.evaluate(
      () =>
        window.visualCard ===
        document.querySelector('[data-catalog-id="smallHouse"]'),
    ),
    true,
  );
  assert.equal(
    await p
      .locator('[data-catalog-id="smallHouse"] details')
      .evaluate((el) => el.open),
    true,
  );
  await p.locator("[data-search]").focus();
  await p.keyboard.type("wasd");
  const camera = await p.evaluate(() => mapGameBasicWorld.getState());
  assert.equal(camera.cameraX, 16384);
  assert.equal(camera.cameraZ, 16384);
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#mgEconomyShop").isVisible(), false);
  r.checks.push(
    "Shop preserves card DOM/expanded recipe across ticks; text input does not pan; Escape closes",
  );
  await p.click('[data-c1="research"]');
  await p.waitForFunction(
    () => document.querySelectorAll(".mg-research-links path").length === 7,
  );
  await p.click('[data-research="basicIndustry"]');
  await p.waitForFunction(() =>
    document
      .querySelector("#mgVisualAnnouncement")
      ?.textContent.includes("Basic Industry"),
  );
  await p.screenshot({ path: path.join(out, "technology-unlock.png") });
  await p.keyboard.press("Escape");
  assert.equal(
    await p
      .locator('[data-c1="research"]')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  r.checks.push("Research graph, actual unlock feedback and focus restoration");
  await p.click('[data-c1="more"]');
  await p.click('[data-action="settings"]');
  await p.evaluate(() => mapGameEconomy.stop());
  const before = await p.evaluate(() => ({
    economy: localStorage.getItem(mapGameEconomy.SAVE_KEY),
    world: localStorage.getItem("mapGame_alpha021_firstPlayable"),
  }));
  await p.selectOption("[data-visual-theme]", "midnight");
  await p.selectOption("[data-visual-density]", "compact");
  const after = await p.evaluate(() => ({
    economy: localStorage.getItem(mapGameEconomy.SAVE_KEY),
    world: localStorage.getItem("mapGame_alpha021_firstPlayable"),
  }));
  assert.deepEqual(after, before);
  await p.screenshot({ path: path.join(out, "appearance-settings.png") });
  await p.click("#mgCloseSettings");
  await p.reload();
  await p.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.theme),
    "midnight",
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.dataset.density),
    "compact",
  );
  r.checks.push("Theme/density persist without changing economy/world saves");
  await start();
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForFunction(
      () => {
        const s = mapGameBasicWorld.forestStats();
        return s.queued === 0;
      },
      {},
      { timeout: 45000 },
    );
    const built = await p.evaluate(() => mapGameBasicWorld.forestStats().built);
    await p.waitForTimeout(1200);
    assert.equal(
      await p.evaluate(() => mapGameBasicWorld.forestStats().built),
      built,
    );
    assert.ok(
      await p.evaluate(() => mapGameBasicWorld.forestStats().tiles <= 120),
    );
    await p.click('[data-action="shop"]');
    const box = await p.locator("#mgEconomyShop .mg-econ-shell").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5);
    await p.screenshot({ path: path.join(out, `shop-${width}.png`) });
    await p.click("#mgEconomyShop [data-close]");
  }
  r.checks.push("Laptop and large-screen panel bounds");
  await p.evaluate(() => mapGameRuntime.showWorldMap());
  await p.waitForFunction(() => mapGameStrategicWorld.getState().open);
  await p.waitForTimeout(1100);
  assert.ok(
    (await p.locator(".mg-sw-heading .mg-kicker").innerText()).includes(
      "SINGLEPLAYER",
    ),
  );
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.http, []);
  fs.writeFileSync(
    path.join(out, "visual-ui.json"),
    JSON.stringify(r, null, 2),
  );
  console.log(JSON.stringify(r));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
