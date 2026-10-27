const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2] || "/tmp/map-game-phase-b";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    report = { errors: [], failed: [], http: [], checks: [] };
  const attach = (p) => {
    p.on("pageerror", (e) => report.errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") report.errors.push(m.text());
    });
    p.on("requestfailed", (r) => report.failed.push(r.url()));
    p.on("response", (r) => {
      if (r.status() >= 400) report.http.push([r.url(), r.status()]);
    });
  };
  attach(page);
  await context.addInitScript(() => {
    if (!localStorage.getItem("phaseBFixture")) {
      localStorage.setItem(
        "mapgame_economy_021e",
        JSON.stringify({
          money: 400000,
          steel: 100,
          iron: 0,
          carbon: 40,
          custom: "retain",
          inventory: { futureUnknown: 19 },
          placedIncomeItems: [],
          economy: {
            version: 2,
            population: 0,
            lastTick: Date.now(),
            future: { keep: true },
          },
        }),
      );
      localStorage.setItem("phaseBFixture", "yes");
    }
  });
  const url = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001";
  await page.goto(url);
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.locator("#mgStartSingle").click();
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  async function enter() {
    await page.evaluate(async () => {
      mapGameStrategicWorld.close();
      await mapGameRuntime.enterTerritory({ x: 190, y: 27, id: "T_190_27" });
    });
    await page.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
  }
  await enter();
  const sites = [];
  async function open(category) {
    await page.locator('[data-action="shop"]').click();
    await page.locator("#mgEconomyShop [data-category]").selectOption(category);
    await page.locator("#mgEconomyShop [data-search]").fill("");
  }
  async function place(id, category) {
    await open(category);
    const point = await page.evaluate(
      ({ id, sites }) => {
        const v = mapGameBasicWorld.getState(),
          def = mapGameBuildings.CATALOG.find((d) => d.id === id);
        for (let z = v.cameraZ - 500; z <= v.cameraZ + 500; z += 220)
          for (let x = v.cameraX - 1000; x <= v.cameraX + 1000; x += 220) {
            if (sites.some((p) => Math.hypot(p.x - x, p.z - z) < 190)) continue;
            if (
              mapGameEconomy.checkPlacement(def, {
                territoryId: v.territory.id,
                x,
                z,
                rotation: 0,
              }).allowed
            )
              return { x, z };
          }
      },
      { id, sites },
    );
    assert.ok(point, "No valid site for " + id);
    await page.locator(`[data-buy="${id}"]`).click();
    const location = await page.evaluate((p) => {
      const v = mapGameBasicWorld.getState(),
        c = document.getElementById("basicCanvas"),
        r = c.getBoundingClientRect();
      return {
        x:
          r.x +
          ((c.width / 2 + (p.x - v.cameraX) * v.zoom) * r.width) / c.width,
        y:
          r.y +
          ((c.height / 2 + (p.z - v.cameraZ) * v.zoom) * r.height) / c.height,
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
    sites.push(point);
  }
  for (const id of ["smallHouse", "smallHouse", "powerPlant", "cornerStore"])
    await place(id, "starter");
  for (const id of ["ironMine", "coalMine"]) await place(id, "mining");
  for (const id of ["ironSmelter", "cokeWorks", "steelFoundry"])
    await place(id, "refining");
  report.checks.push(
    "Nine buildings bought and placed through actual shop/canvas, including five new industrial factories",
  );
  await open("mining");
  assert.equal(await page.locator("#mgEconomyShop [data-buy]").count(), 10);
  await page.locator("[data-next]").click();
  assert.equal(await page.locator("#mgEconomyShop [data-buy]").count(), 4);
  await page.screenshot({ path: path.join(output, "mining-catalog.png") });
  await page.locator("#mgEconomyShop [data-close]").click();
  await open("refining");
  await page.locator("[data-search]").fill("steelFoundry");
  assert.equal(await page.locator("#mgEconomyShop [data-buy]").count(), 1);
  await page.screenshot({ path: path.join(output, "steel-recipe.png") });
  await page.locator("#mgEconomyShop [data-close]").click();
  await open("electronics");
  assert.equal(
    await page.locator('[data-buy="processorFab"]').isDisabled(),
    true,
  );
  await page.screenshot({ path: path.join(output, "future-locked.png") });
  await page.locator("#mgEconomyShop [data-close]").click();
  await open("defense");
  assert.equal(
    await page.locator("#mgEconomyShop [data-buy]:disabled").count(),
    10,
  );
  await page.screenshot({ path: path.join(output, "defense-definitions.png") });
  await page.locator("#mgEconomyShop [data-close]").click();
  const rejection = await page.evaluate(() => {
    const d = mapGameBuildings.CATALOG.find((d) => d.id === "processorFab"),
      before = mapGameEconomy.snapshot().money;
    const paid = mapGameEconomy.purchaseAndRegisterBuilding(d, {
      id: "blocked",
      type: d.id,
      territoryId: "T_190_27",
      x: 25000,
      z: 25000,
      rotation: 0,
    });
    return {
      paid,
      before,
      after: mapGameEconomy.snapshot().money,
      reason: mapGameEconomy.checkPlacement(d, {
        territoryId: "T_190_27",
        x: 25000,
        z: 25000,
        rotation: 0,
      }).reasons,
    };
  });
  assert.equal(rejection.paid, false);
  assert.equal(rejection.before, rejection.after);
  report.checks.push(
    "Pagination/search, future locks, definition-only entries and API purchase rejection",
  );
  const before = await page.evaluate(() => mapGameEconomy.snapshot());
  await page.evaluate(() => {
    mapGameEconomy.stop();
    const s = JSON.parse(localStorage.getItem(mapGameEconomy.SAVE_KEY));
    s.economy.lastTick -= 20 * 60000;
    s.lastEconomyTick = s.economy.lastTick;
    localStorage.setItem(mapGameEconomy.SAVE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.locator("#mgStartSingle").click();
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  const after = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.equal(after.economy.version, 3);
  assert.equal(after.economy.materialRegistryVersion, 1);
  assert.equal(after.custom, "retain");
  assert.equal(after.inventory.futureUnknown, 19);
  assert.deepEqual(after.economy.future, { keep: true });
  assert.ok(after.steel > before.steel);
  assert.ok(after.inventory.ironOre > 0);
  assert.ok(after.inventory.coal > 0);
  report.bottleneck = after.summary.buildings.find(
    (b) => b.type === "steelFoundry",
  );
  assert.ok(
    report.bottleneck.operating ||
      report.bottleneck.shortages?.some((v) => v.material === "iron"),
  );
  assert.ok(
    after.placedIncomeItems
      .filter((b) => b.type === "steelFoundry")[0]
      .economyContract.startsWith("industrial-v1:"),
  );
  await enter();
  await place("smallHouse", "starter");
  await place("ironMine", "mining");
  await place("ironSmelter", "refining");
  await page.evaluate(() => {
    mapGameEconomy.stop();
    const s = JSON.parse(localStorage.getItem(mapGameEconomy.SAVE_KEY));
    s.economy.lastTick -= 20 * 60000;
    s.lastEconomyTick = s.economy.lastTick;
    localStorage.setItem(mapGameEconomy.SAVE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.locator("#mgStartSingle").click();
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  await enter();
  await page.waitForFunction(
    () =>
      mapGameEconomy
        .snapshot()
        .summary.buildings.find((b) => b.type === "steelFoundry")?.operating,
    null,
    { timeout: 45000, polling: 1000 },
  );
  const upgraded = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.ok(upgraded.steel > after.steel + 70);
  report.progression = {
    before: after.steel,
    after: upgraded.steel,
    workers: upgraded.summary.workforceUsed,
    energy: upgraded.summary.energyUsed,
  };
  report.checks.push(
    "Resolved iron bottleneck by building another mine, smelter and home; foundry resumes at full throughput",
  );
  await page.mouse.move(650, 350);
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(output, "working-factories.png") });
  await page.locator('[data-action="economy"]').click();
  await page
    .locator("#mgEconomyStats [data-inventory]")
    .evaluate((e) => (e.open = true));
  await page.screenshot({
    path: path.join(output, "industrial-inventory.png"),
  });
  await page.locator('[data-action="map"]').click();
  await page.waitForFunction(() => mapGameStrategicWorld.getState().open);
  report.checks.push(
    "Actual mine → iron/carbon → steel production, exact inventory persistence and territory/world navigation",
  );
  report.production = {
    beforeSteel: before.steel,
    afterSteel: after.steel,
    ironOre: after.inventory.ironOre,
    coal: after.inventory.coal,
    population: after.economy.population,
    energy: after.summary.energyUsed,
    workers: after.summary.workforceUsed,
  };
  await context.close();
  const legacy = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    lp = await legacy.newPage();
  attach(lp);
  await legacy.addInitScript(() => {
    if (!localStorage.getItem("legacyFixture")) {
      localStorage.setItem(
        "mapgame_economy_021e",
        JSON.stringify({
          money: 200000,
          steel: 0,
          iron: 0,
          carbon: 0,
          placedIncomeItems: ["smallHouse", "powerPlant", "steelMill"].map(
            (type, i) => ({
              id: "legacy" + i,
              type,
              custom: "keep",
              x: 500 + i * 200,
              z: 500,
              territoryId: "T_190_27",
              variant: 2,
            }),
          ),
          economy: {
            version: 2,
            population: 20,
            lastTick: Date.now() - 3600000,
          },
          future: "keep",
        }),
      );
      localStorage.setItem("legacyFixture", "yes");
    }
  });
  await lp.goto(url);
  await lp.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await lp.locator("#mgStartSingle").click();
  await lp.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  const old = await lp.evaluate(() => mapGameEconomy.snapshot());
  assert.ok(old.steel >= 360);
  assert.equal(old.placedIncomeItems[2].id, "legacy2");
  assert.equal(old.placedIncomeItems[2].variant, 2);
  assert.equal(old.placedIncomeItems[2].custom, "keep");
  assert.equal(old.future, "keep");
  assert.equal(old.iron, 0);
  report.checks.push(
    "Pre-catalog steel factory earns its original no-input rate after schema-2 migration",
  );
  report.legacy = {
    steel: old.steel,
    money: old.money,
    contract: old.placedIncomeItems[2].economyContract,
  };
  const reference = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  attach(reference);
  await reference.goto(url + "/industrial/catalog-reference.html");
  await reference.locator("#sector").selectOption("refining");
  assert.equal(await reference.locator("#rows tr").count(), 12);
  await reference.locator('[data-id="steelFoundry"]').click();
  assert.match(await reference.locator("#detail").innerText(), /Iron Ore/);
  await reference.screenshot({
    path: path.join(output, "catalog-reference.png"),
  });
  await reference.close();
  report.checks.push(
    "Interactive full-catalog reference and upstream recipe graph",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.http, []);
  assert.deepEqual(report.failed, []);
  fs.writeFileSync(
    path.join(output, "phase-b-browser.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
