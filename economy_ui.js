// Paged text-first catalog. Closed panels perform no DOM work.
(() => {
  "use strict";
  const R = window.mapGameIndustrialRegistry,
    labels = {
      mining: "Mining",
      refining: "Refining",
      construction: "Construction Materials",
      chemicals: "Chemicals",
      electronics: "Electronics",
      machinery: "Machinery",
      vehicles: "Vehicles",
      aerospace: "Aerospace",
      consumer: "Consumer Goods",
      defense: "Defense Manufacturing",
    };
  let shop = null,
    stats = null,
    message = "",
    lastSnapshot = null,
    page = 0,
    operationsPage = 0;
  const counts = R.data.buildings.reduce(
    (a, d) => {
      a[d.availability]++;
      return a;
    },
    { playable: 0, futureLocked: 0, definitionsOnly: 0 },
  );
  const PAGE = 10,
    OPERATIONS = 30;
  const defs = () => window.mapGameBuildings.CATALOG.filter((v) => v.economy);
  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const resource = (k) => R.material(k)?.name || k;
  const technology = new Map(R.data.technologies.map((t) => [t.id, t.name]));
  const amounts = (values, rate = false) =>
    Object.entries(values || {})
      .map(
        ([k, v]) =>
          `${k === "money" ? "$" : esc(resource(k)) + " "}${fmt(v)}${rate ? "/min" : ""}`,
      )
      .join(" · ");
  function ensure() {
    if (shop) return;
    shop = document.createElement("section");
    shop.id = "mgEconomyShop";
    shop.hidden = true;
    shop.setAttribute("role", "dialog");
    shop.setAttribute("aria-modal", "true");
    shop.setAttribute("aria-label", "Construction shop");
    shop.innerHTML = `<div class="mg-econ-shell"><header><div><small>SINGLEPLAYER · CONSTRUCTION</small><h2>Industrial construction</h2></div><button data-close aria-label="Close shop">Close ×</button></header><p>Choose a building, then click a suitable site. R rotates; Escape cancels. Payment happens only when placed.</p><p>Production and recipe inputs: 1.2× while visibly online; 1× offline, with no elapsed-time cap. Upkeep is unboosted.</p><p>${R.data.buildings.length} industries: ${counts.playable} playable · ${counts.futureLocked} future-locked · ${counts.definitionsOnly} definitions only. Five starter contracts remain available.</p><div class="mg-industrial-filters"><label>Category <select data-category><option value="starter">Starter buildings</option><option value="all">All buildings</option><option value="industries">All industries</option>${Object.entries(
      labels,
    )
      .map(([id, name]) => `<option value="${id}">${name}</option>`)
      .join(
        "",
      )}</select></label><label>Availability <select data-availability><option value="all">All statuses</option><option value="playable">Playable</option><option value="futureLocked">Future-locked</option><option value="definitionsOnly">Definitions only</option></select></label><label>Search <input data-search placeholder="Name, material or technology" aria-label="Search industrial catalog"></label></div><div data-message role="status"></div><div data-list></div><footer><button data-prev>Previous</button> <span data-page></span> <button data-next>Next</button></footer></div>`;
    document.body.appendChild(shop);
    shop.querySelector("[data-close]").onclick = hideShop;
    for (const selector of [
      "[data-category]",
      "[data-availability]",
      "[data-search]",
    ])
      shop
        .querySelector(selector)
        .addEventListener(
          selector === "[data-search]" ? "input" : "change",
          () => {
            page = 0;
            render();
          },
        );
    shop.querySelector("[data-prev]").onclick = () => {
      page = Math.max(0, page - 1);
      render();
    };
    shop.querySelector("[data-next]").onclick = () => {
      page++;
      render();
    };
    shop.querySelector("[data-list]").onclick = (e) => {
      const button = e.target.closest("[data-buy]");
      if (!button || button.disabled) return;
      const def = defs().find((v) => v.id === button.dataset.buy);
      if (!def) return;
      if (!window.mapGameBasicWorld?.getState()?.active) {
        message = "Enter a Singleplayer territory before placing a building.";
        render();
        return;
      }
      hideShop();
      window.mapGameBasicWorld.beginConstruction(def);
    };
    stats = document.createElement("aside");
    stats.id = "mgEconomyStats";
    stats.hidden = true;
    stats.setAttribute("aria-label", "World statistics");
    document.body.appendChild(stats);
  }
  function render() {
    const snap = lastSnapshot || window.mapGameEconomy.snapshot();
    if (shop && !shop.hidden) {
      shop.querySelector("[data-message]").textContent =
        snap.error ||
        (snap.catchingUp
          ? "Settling offline production… construction resumes when complete."
          : "") ||
        message ||
        (!snap.enabled
          ? "Economy construction is available in Singleplayer only."
          : "");
      const category = shop.querySelector("[data-category]").value,
        status = shop.querySelector("[data-availability]").value,
        search = shop.querySelector("[data-search]").value.toLowerCase(),
        active = window.mapGameBasicWorld?.getState()?.active;
      const filtered = defs().filter(
        (d) =>
          (category === "all" ||
            (category === "starter" && !d.industrial) ||
            (category === "industries" && d.industrial) ||
            d.sector === category) &&
          (status === "all" || (d.availability || "playable") === status) &&
          JSON.stringify([
            d.id,
            d.name,
            d.sector,
            d.technology,
            d.economy.inputs,
            d.economy.production,
          ])
            .toLowerCase()
            .includes(search),
      );
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
      page = Math.max(0, Math.min(page, pages - 1));
      shop.querySelector("[data-page]").textContent =
        `${filtered.length} entries · page ${page + 1} / ${pages}`;
      shop.querySelector("[data-prev]").disabled = page === 0;
      shop.querySelector("[data-next]").disabled = page === pages - 1;
      shop.querySelector("[data-list]").innerHTML =
        filtered
          .slice(page * PAGE, (page + 1) * PAGE)
          .map((d) => {
            const r = d.economy,
              locked = d.industrial && d.availability !== "playable";
            const reason = locked
              ? d.availability === "definitionsOnly"
                ? "Definition only — future manufacturing activation"
                : `Future-locked · Era ${d.era} · ${technology.get(d.technology) || d.technology}`
              : !snap.enabled
                ? "Singleplayer only"
                : !active
                  ? "Enter a local territory"
                  : !window.mapGameEconomy.canAfford(d.cost)
                    ? "Insufficient construction resources"
                    : "";
            const production = Object.keys(r.production || {}).length
              ? amounts(r.production, true)
              : r.housing
                ? `Housing +${r.housing} · growth ${r.growth}/min when powered`
                : `Energy capacity +${r.energySupply}`;
            return `<article data-catalog-id="${d.id}"><div><small>${esc(d.sectorLabel || d.category)} · ${esc(d.availability || "Starter contract")}</small><h4>${esc(d.name)}</h4><p>${amounts(d.cost)} · footprint ${d.footprint.join(" × ")} m</p><p>Base output: ${production}</p><p>Base inputs: ${Object.keys(r.inputs || {}).length ? amounts(r.inputs, true) : d.industrial ? "Local extraction — no material input" : "No material inputs (starter contract)"}</p><p>Energy ${r.energyUse || 0} · workers ${r.workforce || 0} · upkeep $${r.upkeep || 0}/min</p>${d.industrial ? `<p>Era ${d.era} · ${esc(technology.get(d.technology) || d.technology)} · ${esc(d.logistics.storageClass)} goods</p>` : ""}<p>Requires dry terrain, slope ≤ 0.54, no overlap. Stocks are shared across your Singleplayer world.</p></div><div><button data-buy="${d.id}" ${reason ? "disabled" : ""}>Place</button><p>${esc(reason)}</p></div></article>`;
          })
          .join("") || "<p>No matching buildings.</p>";
    }
    if (stats && !stats.hidden) {
      const s = snap.summary,
        inventoryOpen = stats.querySelector("[data-inventory]")?.open;
      stats.innerHTML = `<header><h3>World statistics</h3><button data-collapse aria-label="Collapse statistics">−</button></header><p>Singleplayer economy ${snap.enabled ? "· active" : "· paused"}</p><dl><dt>Money</dt><dd>$${fmt(snap.money)}</dd><dt>Steel</dt><dd>${fmt(snap.steel)}</dd><dt>Carbon</dt><dd>${fmt(snap.carbon)}</dd><dt>Energy</dt><dd>${fmt(s.energyUsed)} used / ${fmt(s.energySupply)} capacity</dd><dt>Requested power</dt><dd>${fmt(s.requestedEnergy)} · deficit ${fmt(s.energyDeficit)}</dd><dt>Population</dt><dd>${fmt(s.population)} / ${fmt(s.housing)} housed</dd><dt>Workforce</dt><dd>${s.workforceUsed} used / ${s.workforce} available</dd><dt>Requested workers</dt><dd>${s.requestedWorkforce} · deficit ${s.workforceDeficit}</dd><dt>Money production</dt><dd>$${fmt(snap.incomePerMin)}/min</dd><dt>Upkeep</dt><dd>$${fmt(s.upkeep)}/min</dd></dl><details data-inventory ${inventoryOpen ? "open" : ""}><summary>Other material stocks</summary><dl>${
        [...R.data.materials]
          .filter((m) => !["money", "steel", "carbon"].includes(m.id))
          .map((m) => [m, snap[m.id] ?? snap.inventory?.[m.id] ?? 0])
          .filter(([, n]) => n > 0)
          .map(([m, n]) => `<dt>${esc(m.name)}</dt><dd>${fmt(n)}</dd>`)
          .join("") || "<dt>No extracted materials yet</dt>"
      }</dl></details><p>${esc(snap.error || (snap.catchingUp ? "Settling offline production…" : snap.clockNotice || "1× offline · no time cap · exact saved checkpoints"))}</p><div data-operations></div><footer><button data-op-prev>Previous</button> <span data-op-page></span> <button data-op-next>Next</button></footer>`;
      const pages = Math.max(1, Math.ceil(s.buildings.length / OPERATIONS));
      operationsPage = Math.min(operationsPage, pages - 1);
      stats.querySelector("[data-op-page]").textContent =
        `${s.buildings.length} buildings · ${operationsPage + 1}/${pages}`;
      const byId = new Map(defs().map((d) => [d.id, d]));
      for (const b of s.buildings.slice(
        operationsPage * OPERATIONS,
        (operationsPage + 1) * OPERATIONS,
      )) {
        const line = document.createElement("p");
        line.textContent = `${byId.get(b.type)?.name || b.type}: ${b.reason}${b.shortages?.length ? " — " + b.shortages.map((v) => `${resource(v.material)} ${fmt(v.available)}/${fmt(v.required)} per tick`).join(", ") : ""}`;
        stats.querySelector("[data-operations]").appendChild(line);
      }
      for (const [selector, delta] of [
        ["[data-op-prev]", -1],
        ["[data-op-next]", 1],
      ]) {
        const b = stats.querySelector(selector);
        b.disabled =
          delta < 0 ? operationsPage === 0 : operationsPage === pages - 1;
        b.onclick = () => {
          operationsPage += delta;
          render();
        };
      }
      stats.querySelector("[data-collapse]").onclick = () => {
        stats.hidden = true;
      };
    }
  }
  function showShop() {
    ensure();
    message = "";
    shop.hidden = false;
    render();
    shop.querySelector("[data-close]").focus();
  }
  function hideShop() {
    if (shop) shop.hidden = true;
  }
  function toggleStats() {
    ensure();
    stats.hidden = !stats.hidden;
    render();
  }
  window.mapGameEconomyUI = {
    showShop,
    hideShop,
    toggleStats,
    refresh: render,
  };
  window.mapGameEconomy.subscribe((s) => {
    lastSnapshot = s;
    if ((shop && !shop.hidden) || (stats && !stats.hidden)) render();
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && shop && !shop.hidden) {
        hideShop();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
})();
