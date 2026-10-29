// Matched real-browser gestures against the a selectable baseline source, no TLS bypasses.
const { chromium } = require("playwright-core");
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  output = process.argv[2] || "/tmp/map-game-shop-performance";
fs.mkdirSync(output, { recursive: true });
const origin = process.env.MAP_GAME_TEST_URL || "http://127.0.0.1:8001",
  base = process.env.MAP_GAME_BASELINE_REF || "03adac1";
const baseline = new Map();
for (const file of execFileSync("git", ["ls-tree", "-r", "--name-only", base], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n"))
  if (/\.(js|css|html)$/.test(file))
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
          // Preserve earlier explicit CDN test routes for non-baseline requests.
          return route.fallback();
        });
      await page.goto(origin);
      await page.waitForFunction(
        () => document.querySelector("#mgStartSingle")?.disabled === false,
      );
      await page.click("#mgStartSingle");
      await page.waitForFunction(() => mapGameEconomy.getStatus().enabled);
      report.shop = await page.evaluate(() => {
        const times = [];
        for (let i = 0; i < 50; i++) {
          const start = performance.now();
          mapGameEconomyUI.showShop();
          const s = document.querySelector("#mgEconomyShop [data-category]"),
            a = document.querySelector("#mgEconomyShop [data-availability]");
          s.value = "all";
          a.value = "all";
          s.dispatchEvent(new Event("change"));
          mapGameEconomyUI.hideShop();
          times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        return {
          medianMs: times[25],
          p95Ms: times[47],
          maxMs: times[49],
          renderedRows: document.querySelectorAll("#mgEconomyShop [data-buy]")
            .length,
        };
      });
      fs.writeFileSync(
        path.join(output, `shop-${variant}-${iteration}.json`),
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
      await browser.close();
    }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
