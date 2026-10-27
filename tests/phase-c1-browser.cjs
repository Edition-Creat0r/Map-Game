const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2] || "/tmp/map-game-phase-c1";
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

  await page.goto(process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001");
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.click("#mgStartSingle");
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  assert.equal(
    await page.evaluate(
      () =>
        mapGameProgression.manifest.materials.filter((m) =>
          mapGameProgression.unlocked(mapGameEconomy.snapshot(), m.id),
        ).length,
    ),
    10,
  );
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
    await page
      .locator("#mgEconomyShop [data-availability]")
      .selectOption("all");
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

  const reject = await page.evaluate(() => {
    const d = mapGameBuildings.CATALOG.find((d) => d.id === "ironMine"),
      money = mapGameEconomy.snapshot().money;
    return {
      accepted: mapGameEconomy.purchaseAndRegisterBuilding(
        { ...d, cost: {} },
        { id: "bypass", territoryId: "T_190_27", x: 500, z: 500 },
      ),
      money,
      balance: mapGameEconomy.snapshot().money,
    };
  });
  assert.equal(reject.accepted, false);
  assert.equal(reject.money, reject.balance);
  await page.click('[data-c1="research"]');
  assert.equal(
    await page.locator('[data-node="electricity"] button').isDisabled(),
    true,
  );
  await page.screenshot({ path: path.join(output, "research-locked.png") });
  await page.click('[data-research="basicIndustry"]');
  const paid = await page.evaluate(() => mapGameEconomy.snapshot().money);
  assert.equal(
    await page.evaluate(() => mapGameEconomy.completeResearch("basicIndustry")),
    true,
  );
  assert.equal(
    await page.evaluate(() => mapGameEconomy.snapshot().money),
    paid,
  );
  for (const id of [
    "miningRefining",
    "constructionTechnology",
    "electricity",
    "urbanDevelopment",
    "electronicsFoundations",
    "industrialMachinery",
  ])
    await page.click('[data-research="' + id + '"]');
  await page.screenshot({ path: path.join(output, "research-completed.png") });
  await page.click("[data-c1-close]");
  for (const id of [
    "smallHouse",
    "smallHouse",
    "smallHouse",
    "powerPlant",
    "cornerStore",
  ])
    await place(id, "starter");
  await page.evaluate(() => {
    mapGameEconomy.stop();
    const key = mapGameEconomy.SAVE_KEY,
      s = JSON.parse(localStorage.getItem(key));
    s.economy.lastTick -= 30 * 60000;
    s.lastEconomyTick = s.economy.lastTick;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.click("#mgStartSingle");
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  await enter();
  for (const id of ["ironMine", "coalMine"]) await place(id, "mining");
  for (const id of ["ironSmelter", "cokeWorks", "steelFoundry"])
    await place(id, "refining");
  await page.evaluate(() => {
    mapGameEconomy.stop();
    const key = mapGameEconomy.SAVE_KEY,
      s = JSON.parse(localStorage.getItem(key));
    s.economy.lastTick -= 20 * 60000;
    s.lastEconomyTick = s.economy.lastTick;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.click("#mgStartSingle");
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  await enter();
  const snap = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.equal(snap.economy.progression.era, 6);
  assert.equal(snap.economy.progression.completed.length, 7);
  assert.equal(snap.placedIncomeItems.length, 10);
  assert.ok(snap.inventory.ironOre > 0);
  assert.ok(snap.steel > 65);
  assert.equal(
    await page.evaluate(
      () =>
        mapGameProgression.manifest.materials.filter((m) =>
          mapGameProgression.unlocked(mapGameEconomy.snapshot(), m.id),
        ).length,
    ),
    100,
  );
  await page.selectOption("#mgNextGoal [data-priority]", "automatic");
  await page.click("#mgNextGoal [data-plan]");
  assert.equal(
    await page.evaluate(
      () => mapGameEconomy.snapshot().economy.progression.priorities.mode,
    ),
    "automatic",
  );
  await page.click('[data-c1="research"]');
  await page.screenshot({
    path: path.join(output, "all-materials-unlocked.png"),
  });
  await page.click("[data-c1-close]");
  await open("electronics");
  await page.locator("[data-search]").fill("processorFab");
  assert.equal(
    await page.locator('[data-buy="processorFab"]').isDisabled(),
    true,
  ); // unlocked but construction resources unavailable
  assert.equal(
    await page.evaluate(() => mapGameEconomy.purchaseReason("processorFab")),
    "",
  );
  await page.screenshot({ path: path.join(output, "industrial-shop.png") });
  await page.click("#mgEconomyShop [data-close]");
  await page.mouse.move(750, 500);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(output, "working-factories.png") });
  await page.click('[data-c1="more"]');
  await page.click('[data-action="economy"]');
  await page.locator("[data-inventory]").evaluate((e) => (e.open = true));
  await page.screenshot({ path: path.join(output, "unlocked-inventory.png") });
  await page.click("#mgEconomyStats [data-collapse]");
  await page.click('[data-action="map"]');
  await page.waitForFunction(() => mapGameStrategicWorld.getState().open);
  const saved = await page.evaluate(() => ({
    p: mapGameEconomy.snapshot().economy.progression,
    rows: mapGameEconomy.listPlacedBuildings(),
    stock: mapGameEconomy.snapshot().steel,
  }));
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#mgStartSingle")?.disabled === false,
  );
  await page.click("#mgStartSingle");
  await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
  const reloaded = await page.evaluate(() => mapGameEconomy.snapshot());
  assert.deepEqual(reloaded.economy.progression, saved.p);
  assert.deepEqual(reloaded.placedIncomeItems, saved.rows);
  assert.ok(reloaded.steel >= saved.stock);
  report.checks = [
    "Fresh Singleplayer: exactly ten initial unlocks",
    "Seven research purchases via UI; DAG and replay protection",
    "Ten actual canvas building purchases, six eras and all 100 material unlocks",
    "Offline factory production, automatic priorities and exact save/reload",
    "World Map navigation and repeated territory entry",
  ];
  report.result = {
    era: reloaded.economy.progression.era,
    research: reloaded.economy.progression.completed,
    buildings: reloaded.placedIncomeItems.length,
    steel: reloaded.steel,
  };
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(report.http, []);
  fs.writeFileSync(
    path.join(output, "phase-c1-browser.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
