// Paged text-first catalog. Closed panels perform no DOM work.
(() => {
  "use strict";
  const P = window.mapGameProgression;
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
    operationsPage = 0,
    shopReturn = null;
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
  const searchText = new Map(
    defs().map((d) => [
      d.id,
      JSON.stringify([
        d.id,
        d.name,
        d.sector,
        d.technology,
        d.economy.inputs,
        d.economy.production,
      ]).toLowerCase(),
    ]),
  );
  const technology = new Map(R.data.technologies.map((t) => [t.id, t.name]));
  const amounts = (values, rate = false) =>
    Object.entries(values || {})
      .map(
        ([k, v]) =>
          `${window.mapGameVisuals?.icon(k) || ""}${k === "money" ? "$" : esc(resource(k)) + " "}${fmt(v)}${rate ? "/min" : ""}`,
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
    shop.innerHTML = `<div class="mg-econ-shell"><header><div><small>SINGLEPLAYER · CONSTRUCTION</small><h2>Construction</h2></div><button data-close aria-label="Close shop">Close ×</button></header><p>Choose a building, then click a suitable site. R rotates; Escape cancels. Payment happens only when placed.</p><details class="mg-production-note"><summary>Production rates</summary><p>Production and recipe inputs: 1.2× while online; 1× offline, with no time cap. Upkeep is unboosted.</p></details><p>Homes, utilities and industry. Research opens new possibilities.</p><div class="mg-industrial-filters"><label>Category <select data-category><option value="starter">Starter buildings</option><option value="all">All buildings</option><option value="industries">All industries</option>${Object.entries(
      labels,
    )
      .map(([id, name]) => `<option value="${id}">${name}</option>`)
      .join(
        "",
      )}</select></label><label>Availability <select data-availability><option value="available">Available now</option><option value="discover">Discover / Research</option><option value="all">All statuses (detailed)</option><option value="playable">Playable</option><option value="futureLocked">Future-locked</option><option value="definitionsOnly">Definitions only</option></select></label><label>Search <input data-search placeholder="Name, material or technology" aria-label="Search industrial catalog"></label></div><label><input type="checkbox" data-detail> Detailed catalog</label><div data-message role="status"></div><div data-list></div><footer><button data-prev>Previous</button> <span data-page></span> <button data-next>Next</button></footer></div>`;
    document.body.appendChild(shop);
    shop.querySelector("[data-detail]").onchange = () => render();
    shop.querySelector("[data-close]").onclick = hideShop;
    shop.addEventListener("click", (e) => {
      if (e.target === shop) hideShop();
    });
    window.mapGameVisuals?.trapDialog(shop);
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
          (status === "all" ||
            (status === "available" || status === "playable"
              ? !P.reason(snap, d)
              : status === "discover"
                ? !!P.reason(snap, d)
                : (d.availability || "playable") === status)) &&
          searchText.get(d.id).includes(search),
      );
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
      page = Math.max(0, Math.min(page, pages - 1));
      shop.querySelector("[data-page]").textContent =
        `${filtered.length} entries · page ${page + 1} / ${pages}`;
      shop.querySelector("[data-prev]").disabled = page === 0;
      shop.querySelector("[data-next]").disabled = page === pages - 1;
      const list = shop.querySelector("[data-list]");
      const renderKey = JSON.stringify([
        category,
        status,
        search,
        page,
        snap.enabled,
        active,
        shop.querySelector("[data-detail]").checked,
        filtered
          .slice(page * PAGE, (page + 1) * PAGE)
          .map((d) => [
            d.id,
            P.reason(snap, d),
            window.mapGameEconomy.canAfford(d.cost),
          ]),
      ]);
      if (list.dataset.renderKey !== renderKey) {
        const focused = document.activeElement?.dataset.buy;
        list.innerHTML =
          filtered
            .slice(page * PAGE, (page + 1) * PAGE)
            .map((d) => {
              const r = d.economy,
                locked = P.reason(snap, d);
              const reason = locked
                ? locked
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
              return `<article data-catalog-id="${d.id}" class="mg-build-card"><div class="mg-build-preview">${window.mapGameVisuals?.preview(d) || ""}</div><div class="mg-build-copy"><small>${esc(d.sectorLabel || d.category)} · ${locked ? "Discover" : "Available"}</small><h4>${esc(d.name)}</h4><p class="mg-build-cost">${amounts(d.cost)}</p><p class="mg-build-output">${production}</p><p class="mg-build-needs">ϟ ${r.energyUse || 0} · ♙ ${r.workforce || 0} workers · $${r.upkeep || 0}/min upkeep</p><details ${shop.querySelector("[data-detail]").checked ? "open" : ""}><summary>Recipe & site</summary><p>Inputs: ${Object.keys(r.inputs || {}).length ? amounts(r.inputs, true) : "No material inputs"}</p><p>${d.footprint.join(" × ")} m · dry ground · slope ≤ 0.54 · no overlap</p></details><p class="mg-build-reason" id="reason-${d.id}">${esc(reason)}</p></div><button data-buy="${d.id}" aria-describedby="reason-${d.id}" ${reason ? "disabled" : ""}>Place</button></article>`;
            })
            .join("") || "<p>No matching buildings.</p>";
        list.dataset.renderKey = renderKey;
        if (focused) {
          const button = list.querySelector(`[data-buy="${focused}"]`);
          if (button && !button.disabled) button.focus();
        }
      }
    }
    if (stats && !stats.hidden) {
      const s = snap.summary,
        inventoryOpen = stats.querySelector("[data-inventory]")?.open,
        legacyOpen = stats.querySelector("[data-legacy]")?.open;
      stats.innerHTML = `<header><h3>City & inventory</h3><button data-collapse aria-label="Collapse statistics">−</button></header><p>Singleplayer economy ${snap.enabled ? "· active" : "· paused"}</p><dl><dt>Money</dt><dd>$${fmt(snap.money)}</dd><dt>Steel</dt><dd>${fmt(snap.steel)}</dd><dt>Carbon</dt><dd>${fmt(snap.carbon)}</dd><dt>Energy</dt><dd>${fmt(s.energyUsed)} used / ${fmt(s.energySupply)} capacity</dd><dt>Requested power</dt><dd>${fmt(s.requestedEnergy)} · deficit ${fmt(s.energyDeficit)}</dd><dt>Population</dt><dd>${fmt(s.population)} / ${fmt(s.housing)} housed</dd><dt>Workforce</dt><dd>${s.workforceUsed} used / ${s.workforce} available</dd><dt>Requested workers</dt><dd>${s.requestedWorkforce} · deficit ${s.workforceDeficit}</dd><dt>Money production</dt><dd>$${fmt(snap.incomePerMin)}/min</dd><dt>Upkeep</dt><dd>$${fmt(s.upkeep)}/min</dd></dl><details data-inventory ${inventoryOpen ? "open" : ""}><summary>Unlocked materials</summary><dl>${
        [...R.data.materials]
          .filter(
            (m) =>
              !["money", "steel", "carbon"].includes(m.id) &&
              P.manifest.materials.some((x) => x.id === m.id) &&
              P.unlocked(snap, m.id),
          )
          .map((m) => [m, snap[m.id] ?? snap.inventory?.[m.id] ?? 0])
          .filter(() => true)
          .map(
            ([m, n]) =>
              `<dt>${window.mapGameVisuals?.icon(m.id) || ""}${esc(m.name)}</dt><dd>${fmt(n)}</dd>`,
          )
          .join("") || "<dt>No extracted materials yet</dt>"
      }</dl></details><details data-legacy ${legacyOpen ? "open" : ""}><summary>Legacy Inventory</summary><dl>${
        R.data.materials
          .filter(
            (m) =>
              (snap[m.id] ?? snap.inventory?.[m.id] ?? 0) > 0 &&
              (!P.manifest.materials.some((x) => x.id === m.id) ||
                !P.unlocked(snap, m.id)),
          )
          .map(
            (m) =>
              `<dt>${window.mapGameVisuals?.icon(m.id) || ""}${esc(m.name)}</dt><dd>${fmt(snap[m.id] ?? snap.inventory?.[m.id] ?? 0)}</dd>`,
          )
          .join("") || "<dt>No hidden balances</dt>"
      }</dl></details><p>${esc(snap.error || (snap.catchingUp ? "Settling offline production…" : snap.clockNotice || "Your city keeps producing while you are away."))}</p><div data-operations></div><footer><button data-op-prev>Previous</button> <span data-op-page></span> <button data-op-next>Next</button></footer>`;
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
    if (!document.activeElement?.closest?.("#mgEconomyShop"))
      shopReturn = document.activeElement;
    ensure();
    const research = document.getElementById("mgProgressionPanel");
    if (research) research.hidden = true;
    if (stats) stats.hidden = true;
    message = "";
    shop.hidden = false;
    shop.setAttribute("aria-modal", "true");
    render();
    shop.querySelector("[data-close]").focus();
  }
  function hideShop() {
    if (shop && !shop.hidden) {
      shop.hidden = true;
      if (shopReturn?.isConnected) shopReturn.focus();
    }
  }
  function toggleStats() {
    ensure();
    hideShop();
    const research = document.getElementById("mgProgressionPanel");
    if (research) research.hidden = true;
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
