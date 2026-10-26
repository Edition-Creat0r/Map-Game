// Matched real-browser gestures against the exact 0.3.3C source, no TLS bypasses.
const { chromium } = require("playwright-core");
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  output = process.argv[2] || "/tmp/map-game-economy";
fs.mkdirSync(output, { recursive: true });
const origin = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001",
  base = "feature/0.3.3c-terrain-polish";
const baseline = new Map();
for (const file of execFileSync("git", ["ls-tree", "-r", "--name-only", base], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n"))
  if (/^[^/]+\.(js|css|html)$/.test(file))
    baseline.set(
      "/" + file,
      execFileSync("git", ["show", `${base}:${file}`], {
        cwd: root,
        encoding: "utf8",
      }),
    );
(async () => {
  for (let iteration = 1; iteration <= 3; iteration++)
    for (const variant of ["baseline", "economy"]) {
      const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
        args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
      });
      const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        }),
        report = { iteration, variant, errors: [], http: [], failed: [] };
      page.on("pageerror", (e) => report.errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") report.errors.push(m.text());
      });
      page.on("requestfailed", (r) => report.failed.push(r.url()));
      page.on("response", (r) => {
        if (r.status() >= 400) report.http.push([r.url(), r.status()]);
      });
      if (variant === "baseline")
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url()),
            file = url.pathname === "/" ? "/index.html" : url.pathname;
          if (url.origin === new URL(origin).origin && baseline.has(file))
            return route.fulfill({
              contentType: file.endsWith(".js")
                ? "application/javascript"
                : file.endsWith(".css")
                  ? "text/css"
                  : "text/html",
              body: baseline.get(file),
            });
          return route.continue();
        });
      await page.addInitScript(() => {
        window.economyPerfLongTasks = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            window.economyPerfLongTasks.push({
              start: e.startTime,
              duration: e.duration,
            });
        }).observe({ type: "longtask", buffered: true });
      });
      const start = Date.now();
      await page.goto(origin);
      await page.waitForFunction(
        () => document.querySelector("#mgStartSingle")?.disabled === false,
      );
      report.bootMs = Date.now() - start;
      await page.locator("#mgStartSingle").click();
      await page.waitForTimeout(2000);
      async function gesture(selector, zoom = false) {
        const box = await page.locator(selector).boundingBox(),
          x = box.x + box.width * 0.5,
          y = box.y + box.height * 0.5;
        await page.mouse.move(x, y);
        const timing = page.evaluate(
          () =>
            new Promise((resolve) => {
              const times = [],
                start = performance.now();
              function frame(t) {
                times.push(t);
                if (t - start < 2500) requestAnimationFrame(frame);
                else {
                  const d = times
                    .slice(1)
                    .map((v, i) => v - times[i])
                    .sort((a, b) => a - b);
                  resolve({
                    fps:
                      ((times.length - 1) * 1000) / (times.at(-1) - times[0]),
                    p95Ms: d[Math.floor(d.length * 0.95)],
                    maxMs: d.at(-1),
                  });
                }
              }
              requestAnimationFrame(frame);
            }),
        );
        if (zoom)
          for (let i = 0; i < 12; i++) {
            await page.mouse.wheel(0, i < 6 ? -100 : 100);
            await page.waitForTimeout(100);
          }
        else {
          await page.mouse.down();
          await page.mouse.move(x + 220, y + 120, { steps: 40 });
          await page.mouse.move(x, y, { steps: 40 });
          await page.mouse.up();
        }
        return await timing;
      }
      report.worldPan = await gesture("#mgStrategicCanvas");
      const box = await page.locator("#mgStrategicCanvas").boundingBox();
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      const enter = Date.now();
      await page.locator("#mgSwEnter").click();
      await page.waitForFunction(
        () => document.querySelector("#loadingScreen").hidden,
      );
      report.territoryEntryMs = Date.now() - enter;
      await page.waitForTimeout(1000);
      report.localPan = await gesture("#basicCanvas");
      report.zoom = await gesture("#basicCanvas", true);
      const detail = Date.now();
      await page.mouse.move(720, 500);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(120);
      }
      await page.waitForFunction(
        () => mapGameBasicWorld.getState().cachedChunks >= 12,
      );
      report.detailReadyMs = Date.now() - detail;
      report.detailPan = await gesture("#basicCanvas");
      report.longTasks = await page.evaluate(() => economyPerfLongTasks);
      report.closedShopUnbuilt =
        (await page.locator("#mgEconomyShop").count()) === 0;
      fs.writeFileSync(
        path.join(output, `comparison-${variant}-${iteration}.json`),
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
      await browser.close();
    }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
