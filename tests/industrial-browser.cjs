const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2] || "/tmp/map-game-industrial";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const reports = [];
  for (const count of [1000, 10000]) {
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      r = { count, errors: [], http: [], failed: [] };
    page.on("pageerror", (e) => r.errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") r.errors.push(m.text());
    });
    page.on("requestfailed", (q) => r.failed.push(q.url()));
    page.on("response", (q) => {
      if (q.status() >= 400) r.http.push([q.url(), q.status()]);
    });
    await page.addInitScript((count) => {
      const native = Date.now.bind(Date),
        year = 365.25 * 86400000;
      Date.now = () => native() + 1000 * year;
      if (!localStorage.getItem("industrialFixture")) {
        const types = [
          "smallHouse",
          "powerPlant",
          "steelMill",
          "carbonPlant",
          "cornerStore",
          "smallHouse",
        ];
        const rows = Array.from({ length: count }, (_, i) => ({
          id: "stress_" + i,
          type: types[i % 6],
          territoryId: "T_190_27",
          x: 100 + (i % 100) * 200,
          z: 100 + Math.floor(i / 100) * 200,
        }));
        localStorage.setItem(
          "mapgame_economy_021e",
          JSON.stringify({
            money: 1e12,
            steel: 100,
            carbon: 40,
            placedIncomeItems: rows,
            unknown: "preserve",
            economy: {
              version: 1,
              lastTick: native(),
              population: 0,
              future: "keep",
            },
          }),
        );
        localStorage.setItem("industrialFixture", "yes");
      }
      window.cityLongTasks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          window.cityLongTasks.push({
            start: e.startTime,
            duration: e.duration,
          });
      }).observe({ type: "longtask", buffered: true });
    }, count);
    await page.goto(process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001");
    await page.waitForFunction(
      () => document.querySelector("#mgStartSingle")?.disabled === false,
    );
    await page.evaluate(() => {
      window.cityLongTasks = [];
      window.cityFrames = [];
      window.watchCity = true;
      function frame(t) {
        cityFrames.push(t);
        if (watchCity) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const start = Date.now();
    await page.locator("#mgStartSingle").click();
    await page.waitForFunction(() => mapGameEconomy.getStatus().enabled, null, {
      timeout: 120000,
    });
    r.catchupMs = Date.now() - start;
    r.catchup = await page.evaluate(() => {
      watchCity = false;
      const a = cityFrames,
        d = a
          .slice(1)
          .map((v, i) => v - a[i])
          .sort((a, b) => a - b),
        s = mapGameEconomy.snapshot();
      return {
        longTasks: cityLongTasks,
        frames: a.length,
        p95Ms: d[Math.floor(d.length * 0.95)] || null,
        maxMs: d.at(-1) || null,
        version: s.economy.version,
        engine: s.catchupEngine,
        population: s.economy.population,
        checkpoint: s.economy.lastTick,
        money: s.money,
        steel: s.steel,
        offline: mapGameEconomy.applyOfflineIncome(),
        unknown: s.unknown,
        future: s.economy.future,
      };
    });
    assert.equal(r.catchup.version, 2);
    assert.equal(r.catchup.engine, "worker");
    assert.equal(r.catchup.unknown, "preserve");
    assert.equal(r.catchup.future, "keep");
    assert.ok(r.catchup.offline.elapsedMinutes > 500e6);
    assert.ok(r.catchup.population > 0);
    await page.evaluate(async () => {
      mapGameStrategicWorld.close();
      await mapGameRuntime.enterTerritory({ x: 190, y: 27, id: "T_190_27" });
    });
    await page.waitForFunction(
      () => document.querySelector("#loadingScreen").hidden,
    );
    assert.equal(
      await page.evaluate(() => mapGameBasicWorld.getState().buildingCount),
      count,
    );
    const timings = page.evaluate(
      () =>
        new Promise((resolve) => {
          const a = [],
            start = performance.now();
          function f(t) {
            a.push(t);
            if (t - start < 2500) requestAnimationFrame(f);
            else {
              const d = a
                .slice(1)
                .map((v, i) => v - a[i])
                .sort((a, b) => a - b);
              resolve({
                fps: ((a.length - 1) * 1000) / (a.at(-1) - a[0]),
                p95Ms: d[Math.floor(d.length * 0.95)],
                maxMs: d.at(-1),
              });
            }
          }
          requestAnimationFrame(f);
        }),
    );
    await page.mouse.move(720, 500);
    await page.mouse.down();
    await page.mouse.move(920, 600, { steps: 50 });
    await page.mouse.move(720, 500, { steps: 50 });
    await page.mouse.up();
    r.pan = await timings;
    await page.screenshot({ path: path.join(output, `city-${count}.png`) });
    const before = await page.evaluate(() => ({
      money: mapGameEconomy.snapshot().money,
      steel: mapGameEconomy.snapshot().steel,
    }));
    await page.evaluate(() => {
      const saved = Date.now.bind(Date);
      Date.now = () => saved() + 3600000;
      mapGameEconomy.save();
    });
    const anomaly = await page.evaluate(() => mapGameEconomy.snapshot());
    assert.equal(anomaly.economy.clockAnomalies, 1);
    assert.ok(anomaly.money >= before.money);
    assert.ok(anomaly.steel >= before.steel);
    r.clockNotice = anomaly.clockNotice;
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector("#mgStartSingle")?.disabled === false,
    );
    await page.locator("#mgStartSingle").click();
    await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
    assert.equal(
      await page.evaluate(() => mapGameEconomy.listPlacedBuildings().length),
      count,
    );
    assert.equal(
      await page.evaluate(() => mapGameEconomy.snapshot().steel),
      anomaly.steel,
    );
    await page.screenshot({ path: path.join(output, `resume-${count}.png`) });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.http, []);
    assert.deepEqual(r.failed, []);
    reports.push(r);
    fs.writeFileSync(
      path.join(output, "industrial-browser.json"),
      JSON.stringify(reports, null, 2),
    );
    console.log(JSON.stringify(r));
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
