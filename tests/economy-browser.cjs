const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2] || "/tmp/map-game-economy";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const report = { errors: [], failed: [], http: [], checks: [] };
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  page.on("requestfailed", (r) => report.failed.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) report.http.push([r.url(), r.status()]);
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem("testEconomyFixture")) {
      localStorage.setItem(
        "mapGame_alpha021_firstPlayable",
        JSON.stringify({
          claims: [{ territory_id: "T_1_1", localOwner: true }],
          unknownWorldField: "retain",
        }),
      );
      localStorage.setItem(
        "mapgame_economy_021e",
        JSON.stringify({
          money: 400000,
          steel: 100,
          carbon: 40,
          unknownEconomyField: "retain",
          placedIncomeItems: [],
          lastEconomyTick: Date.now(),
        }),
      );
      localStorage.setItem("testEconomyFixture", "yes");
    }
  });
  const origin = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001";
  await page.goto(origin);
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  assert.equal(
    await page.evaluate(() => mapGameEconomy.snapshot().enabled),
    false,
  );
  await page.locator("#mgStartSingle").click();
  await page.waitForFunction(() => mapGameEconomy.snapshot().enabled);
  await page.evaluate(async () => {
    mapGameStrategicWorld.close();
    await mapGameRuntime.enterTerritory({ x: 190, y: 27, id: "T_190_27" });
  });
  await page.waitForFunction(
    () => document.querySelector("#loadingScreen").hidden,
  );
  const money = await page.evaluate(() => mapGameEconomy.snapshot().money);
  await page.locator('[data-action="shop"]').click();
  await page.locator('[data-buy="smallHouse"]').click();
  await page.locator("#mgConstructionControls [data-cancel]").click();
  assert.equal(
    await page.evaluate(() => mapGameEconomy.snapshot().money),
    money,
  );
  report.checks.push("Cancel placement does not spend");
  const sites = [];
  async function place(type) {
    const point = await page.evaluate(
      ({ type, used }) => {
        const state = mapGameBasicWorld.getState(),
          def = mapGameBuildings.CATALOG.find((d) => d.id === type);
        for (let z = state.cameraZ - 700; z <= state.cameraZ + 700; z += 220)
          for (
            let x = state.cameraX - 1000;
            x <= state.cameraX + 1000;
            x += 220
          ) {
            if (used.some((p) => Math.hypot(p.x - x, p.z - z) < 190)) continue;
            const data = { territoryId: state.territory.id, x, z, rotation: 0 };
            if (mapGameEconomy.checkPlacement(def, data).allowed)
              return { x, z };
          }
      },
      { type, used: sites },
    );
    assert.ok(point, "No available dry construction site for " + type);
    await page.locator('[data-action="shop"]').click();
    await page.locator(`[data-buy="${type}"]`).click();
    if (type === "powerPlant") await page.keyboard.press("r");
    const location = await page.evaluate((point) => {
      const v = mapGameBasicWorld.getState(),
        c = document.getElementById("basicCanvas"),
        r = c.getBoundingClientRect();
      return {
        x:
          r.x +
          ((c.width / 2 + (point.x - v.cameraX) * v.zoom) * r.width) / c.width,
        y:
          r.y +
          ((c.height / 2 + (point.z - v.cameraZ) * v.zoom) * r.height) /
            c.height,
      };
    }, point);
    const count = await page.evaluate(
      () => mapGameEconomy.listPlacedBuildings().length,
    );
    await page.mouse.click(location.x, location.y);
    await page.waitForFunction(
      (n) => mapGameEconomy.listPlacedBuildings().length === n + 1,
      count,
    );
    if (type === "powerPlant")
      assert.ok(
        Math.abs(
          (await page.evaluate(
            () =>
              mapGameEconomy
                .listPlacedBuildings()
                .find((b) => b.type === "powerPlant").rotation,
          )) -
            Math.PI / 2,
        ) < 1e-9,
      );
    sites.push(point);
  }
  for (const type of [
    "smallHouse",
    "powerPlant",
    "steelMill",
    "carbonPlant",
    "cornerStore",
  ])
    await place(type);
  assert.equal(
    await page.evaluate(() => mapGameEconomy.listPlacedBuildings().length),
    5,
  );
  report.checks.push(
    "All five starter types placed through the shop and canvas",
  );
  await page.locator('[data-action="economy"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "economy-deficits.png") });
  async function resumeOffline(minutes) {
    await page.evaluate((minutes) => {
      mapGameEconomy.stop();
      const raw = JSON.parse(localStorage.getItem(mapGameEconomy.SAVE_KEY));
      raw.economy.lastTick -= minutes * 60000;
      raw.lastEconomyTick = raw.economy.lastTick;
      localStorage.setItem(mapGameEconomy.SAVE_KEY, JSON.stringify(raw));
    }, minutes);
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector("#mgStartSingle")?.disabled === false,
    );
    await page.locator("#mgStartSingle").click();
    await page.waitForFunction(() => mapGameEconomy.snapshot().enabled);
    await page.evaluate(async () => {
      mapGameStrategicWorld.close();
      await mapGameRuntime.enterTerritory({ x: 190, y: 27, id: "T_190_27" });
    });
    await page.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
    await page.locator('[data-action="economy"]').click();
  }
  // A fixture of an older saved checkpoint models a real closed-game interval.
  const before = await page.evaluate(() => mapGameEconomy.snapshot());
  await resumeOffline(10);
  const grown = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.ok(grown.summary.population > 19.9);
  assert.ok(grown.steel > before.steel);
  assert.ok(grown.carbon > before.carbon);
  assert.ok(grown.summary.workforceDeficit > 0);
  await place("smallHouse");
  await resumeOffline(10);
  const snapshot = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.equal(
    snapshot.summary.buildings.filter((b) => !b.operating).length,
    0,
  );
  assert.ok(snapshot.money > grown.money - 12000);
  report.checks.push(
    "Growth, production, visible deficits and workforce recovery",
  );
  await page.screenshot({ path: path.join(output, "economy-town.png") });
  await page.locator('[data-action="shop"]').click();
  await page.screenshot({ path: path.join(output, "economy-shop.png") });
  await page.locator(".mg-econ-shell").evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await page.screenshot({
    path: path.join(output, "economy-shop-industry.png"),
  });
  await page.locator("#mgEconomyShop [data-close]").click();
  const validation = await page.evaluate(() => {
    const def = mapGameBuildings.CATALOG.find((d) => d.id === "smallHouse"),
      row = mapGameEconomy.listPlacedBuildings()[0];
    const overlap = mapGameEconomy.checkPlacement(def, {
      ...row,
      id: "overlap",
    });
    let water;
    for (let y = 0; y < 316 && !water; y += 1)
      for (let x = 0; x < 316 && !water; x += 1)
        if (mapGameSharedTerrain.strategic(x, y).water)
          water = {
            territoryId: `T_${x}_${y}`,
            x: 16384,
            z: 16384,
            rotation: 0,
          };
    return { overlap, water: mapGameEconomy.checkPlacement(def, water) };
  });
  assert.equal(validation.overlap.allowed, false);
  assert.equal(validation.water.allowed, false);
  report.checks.push("Real shared terrain water and building overlap rejected");
  const homeOnly = await context.newPage();
  await homeOnly.goto(origin);
  await homeOnly.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await homeOnly.close();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mapGame_alpha021_firstPlayable"))
          .claims.length,
    ),
    1,
  );
  report.checks.push("Closing the home screen preserves legacy world claims");
  const second = await context.newPage();
  await second.goto(origin);
  await second.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await second.locator("#mgStartSingle").click();
  await second.waitForFunction(() =>
    mapGameEconomy.snapshot().error.includes("another tab"),
  );
  assert.equal(
    await second.evaluate(() => mapGameEconomy.snapshot().enabled),
    false,
  );
  await second.close();
  report.checks.push("Second tab fails closed without economy writes");
  const buildings = await page.evaluate(() =>
    mapGameEconomy.listPlacedBuildings(),
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.locator("#mgStartSingle").click();
  await page
    .waitForFunction(() => mapGameEconomy.snapshot().enabled)
    .catch(async (e) => {
      console.error(
        "Reload state:",
        await page.evaluate(() => mapGameEconomy.snapshot()),
      );
      throw e;
    });
  const reloaded = await page.evaluate(() => ({
    snapshot: mapGameEconomy.snapshot(),
    world: JSON.parse(localStorage.getItem("mapGame_alpha021_firstPlayable")),
  }));
  assert.deepEqual(reloaded.snapshot.placedIncomeItems, buildings);
  assert.equal(reloaded.snapshot.unknownEconomyField, "retain");
  assert.equal(reloaded.world.unknownWorldField, "retain");
  assert.equal(reloaded.world.claims.length, 1);
  assert.ok(Math.abs(reloaded.snapshot.money - snapshot.money) < 100);
  report.checks.push(
    "Reload retains complete building data, balance and unknown fields without duplicate awards",
  );
  await page.evaluate(async () => {
    mapGameStrategicWorld.close();
    await mapGameRuntime.enterTerritory({ x: 190, y: 27, id: "T_190_27" });
  });
  await page.waitForFunction(
    () => document.querySelector("#loadingScreen").hidden,
  );
  assert.equal(
    await page.evaluate(() => mapGameBasicWorld.getState().buildingCount),
    6,
  );
  const frames = page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [],
          start = performance.now();
        function f(t) {
          times.push(t);
          if (t - start < 2200) requestAnimationFrame(f);
          else {
            const d = times
              .slice(1)
              .map((t, i) => t - times[i])
              .sort((a, b) => a - b);
            resolve({
              fps: ((times.length - 1) * 1000) / (times.at(-1) - times[0]),
              p95Ms: d[Math.floor(d.length * 0.95)],
              maxMs: d.at(-1),
            });
          }
        }
        requestAnimationFrame(f);
      }),
  );
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(840, 560, { steps: 20 });
  await page.mouse.up();
  await page.mouse.wheel(0, -100);
  report.populatedPan = await frames;
  await page.mouse.move(650, 320);
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(output, "economy-close.png") });
  await page.evaluate(() =>
    mapGameEconomy.spend({ money: mapGameEconomy.snapshot().money }),
  );
  await page.locator('[data-action="shop"]').click();
  assert.equal(
    await page.locator("#mgEconomyShop [data-buy]:disabled").count(),
    5,
  );
  assert.match(
    await page.locator("#mgEconomyShop [data-list]").innerText(),
    /Insufficient construction resources/,
  );
  await page.screenshot({
    path: path.join(output, "economy-unaffordable.png"),
  });
  await page.locator("#mgEconomyShop [data-close]").click();
  report.checks.push(
    "Insufficient-funds purchases are disabled with an explanation",
  );
  await page.waitForTimeout(400);
  await page.locator('[data-action="map"]').click();
  await page.waitForFunction(
    () => !document.querySelector("#mgStrategicWorld").hidden,
  );
  report.checks.push("Reloaded territory, pan, zoom and return to World Map");
  report.snapshot = snapshot;
  report.reloaded = reloaded;
  report.validation = validation;
  fs.writeFileSync(
    path.join(output, "economy-browser.json"),
    JSON.stringify(report, null, 2),
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.http, []);
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        errors: report.errors,
        failed: report.failed,
        http: report.http,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
