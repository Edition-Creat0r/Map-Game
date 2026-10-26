// Text-first starter construction and an on-demand statistics panel.
(() => {
  "use strict";
  let shop = null,
    stats = null,
    message = "",
    lastSnapshot = null;
  const defs = () => window.mapGameBuildings.CATALOG.filter((v) => v.economy);
  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const costs = (d) =>
    Object.entries(d.cost)
      .map(([k, v]) => `${k === "money" ? "$" : k + " "}${fmt(v)}`)
      .join(" · ");
  function error(text) {
    message = text;
    render();
  }
  function ensure() {
    if (shop) return;
    shop = document.createElement("section");
    shop.id = "mgEconomyShop";
    shop.hidden = true;
    shop.setAttribute("role", "dialog");
    shop.setAttribute("aria-modal", "true");
    shop.setAttribute("aria-label", "Construction shop");
    shop.innerHTML =
      '<div class="mg-econ-shell"><header><div><small>SINGLEPLAYER · CONSTRUCTION</small><h2>Starter buildings</h2></div><button data-close aria-label="Close shop">Close ×</button></header><p>Choose a building, then click a suitable site. R rotates; Escape cancels. Payment happens only when placed.</p><p>Production: 1.2× while visible online; 1× offline, capped at 12 hours. Energy and workforce are shared across your local world.</p><div data-message role="status"></div><div data-list></div></div>';
    document.body.appendChild(shop);
    shop.querySelector("[data-close]").onclick = hideShop;
    shop.querySelector("[data-list]").onclick = (e) => {
      const button = e.target.closest("[data-buy]");
      if (!button) return;
      const def = defs().find((v) => v.id === button.dataset.buy);
      if (!def) return;
      const view = window.mapGameBasicWorld?.getState();
      if (!view?.active)
        return error(
          "Enter a Singleplayer territory before placing a building.",
        );
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
        message ||
        (!snap.enabled
          ? "Economy construction is available in Singleplayer only."
          : "");
      const active = window.mapGameBasicWorld?.getState()?.active;
      shop.querySelector("[data-list]").innerHTML = [
        "Residential",
        "Infrastructure",
        "Industrial",
        "Commercial",
      ]
        .map(
          (category) =>
            `<section><h3>${category}</h3>${defs()
              .filter((d) => d.category === category)
              .map((d) => {
                const r = d.economy,
                  affordable = window.mapGameEconomy.canAfford(d.cost);
                const reason = !snap.enabled
                  ? "Singleplayer only"
                  : !active
                    ? "Enter a local territory"
                    : !affordable
                      ? "Insufficient construction resources"
                      : "";
                const production =
                  Object.entries(r.production || {})
                    .map(
                      ([k, v]) =>
                        `${k} ${fmt(v)}/min base (${fmt(v * 1.2)} online)`,
                    )
                    .join(" · ") ||
                  (r.housing
                    ? `Housing +${r.housing} · growth ${r.growth}/min when powered`
                    : `Energy capacity +${r.energySupply}`);
                return `<article><div><h4>${d.name}</h4><p>${costs(d)} · footprint ${d.footprint.join(" × ")} m</p><p>${production}</p><p>Energy ${r.energyUse || 0} · workers ${r.workforce || 0} · upkeep $${r.upkeep || 0}/min</p><p>Requires dry terrain, slope ≤ 0.54, no overlap. Operating requirements are checked each tick.</p></div><div><button data-buy="${d.id}" ${reason ? "disabled" : ""}>Place</button><p>${reason}</p></div></article>`;
              })
              .join("")}</section>`,
        )
        .join("");
    }
    if (stats && !stats.hidden) {
      const s = snap.summary;
      stats.innerHTML = `<header><h3>World statistics</h3><button data-collapse aria-label="Collapse statistics">−</button></header><p>Singleplayer economy ${snap.enabled ? "· active" : "· paused"}</p><dl><dt>Money</dt><dd>$${fmt(snap.money)}</dd><dt>Steel</dt><dd>${fmt(snap.steel)}</dd><dt>Carbon</dt><dd>${fmt(snap.carbon)}</dd><dt>Energy</dt><dd>${fmt(s.energyUsed)} used / ${fmt(s.energySupply)} capacity</dd><dt>Requested power</dt><dd>${fmt(s.requestedEnergy)} · deficit ${fmt(s.energyDeficit)}</dd><dt>Population</dt><dd>${fmt(s.population)} / ${fmt(s.housing)} housed</dd><dt>Workforce</dt><dd>${s.workforceUsed} used / ${s.workforce} available</dd><dt>Requested workers</dt><dd>${s.requestedWorkforce} · deficit ${s.workforceDeficit}</dd><dt>Money production</dt><dd>$${fmt(snap.incomePerMin)}/min</dd><dt>Upkeep</dt><dd>$${fmt(s.upkeep)}/min</dd></dl><p>${snap.error || "10-second simulation steps · offline cap 12h at 1×"}</p><div data-operations></div>`;
      const operations = stats.querySelector("[data-operations]");
      for (const b of s.buildings) {
        const line = document.createElement("p");
        line.textContent = `${window.mapGameBuildings.CATALOG.find((d) => d.id === b.type)?.name || b.type}: ${b.reason}`;
        operations.appendChild(line);
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
