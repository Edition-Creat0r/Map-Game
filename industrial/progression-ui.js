// Beginner navigation and small research DAG; closed panels perform no catalog work.
(() => {
  "use strict";
  const P = window.mapGameProgression,
    E = window.mapGameEconomy;
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
  let panel,
    nav,
    last,
    navInstalled = false;
  const money = (n) =>
    Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  function shop(category) {
    window.mapGameEconomyUI.showShop();
    const el = document.querySelector("#mgEconomyShop [data-category]");
    el.value = category;
    el.dispatchEvent(new Event("change"));
  }
  function ensure() {
    if (panel) return;
    panel = document.createElement("section");
    panel.id = "mgProgressionPanel";
    panel.hidden = true;
    panel.className = "mg-c1-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Research and material discovery");
    document.body.append(panel);
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-c1-close")) panel.hidden = true;
      if (b.dataset.research) {
        E.completeResearch(b.dataset.research);
        render(last || E.snapshot());
      }
    });
  }
  function showResearch() {
    ensure();
    window.mapGameEconomyUI.hideShop();
    panel.hidden = false;
    render(last || E.snapshot());
  }
  function render(s) {
    if (!panel || panel.hidden) return;
    const p = s.economy.progression;
    if (!p) return;
    panel.innerHTML = `<header><h2>Research · ${P.eras[p.era - 1]}</h2><button data-c1-close>Close ×</button></header><p>${esc(P.nextGoal(s))}</p><p>Complete research with money earned through ordinary industry and commerce. Era milestones require powered housing and construction; no minigames.</p><div class="mg-c1-tree">${P.research.nodes
      .map((n) => {
        const reason = P.researchReason(s, n.id),
          can = !reason && s.enabled && E.canAfford(n.cost);
        return `<article data-node="${n.id}"><h3>${esc(n.name)}</h3><p>${n.prerequisites.length ? "← " + n.prerequisites.map((id) => esc(P.research.nodes.find((x) => x.id === id).name)).join(" + ") : "Root technology"}</p><p>$${money(n.cost.money)} · ${n.effects.materials.length} materials · ${n.effects.buildings.length} factory licenses, when their materials and era are reached${n.effects.eras.length ? " · era milestone: " + n.effects.eras.map((e) => P.eras[e - 1]).join(", ") : ""}</p><button data-research="${n.id}" ${can ? "" : "disabled"}>${esc(reason || (!s.enabled ? "Singleplayer only" : can ? "Research" : "Insufficient money"))}</button></article>`;
      })
      .join(
        "",
      )}</div><h3>Discover materials</h3><p>${P.manifest.materials.filter((m) => P.unlocked(s, m.id)).length} / 100 unlocked · all 121 internal balances retained.</p><div class="mg-c1-discover">${
      P.manifest.materials
        .filter((m) => !P.unlocked(s, m.id))
        .map(
          (m) =>
            `<p><b>${esc(window.mapGameIndustrialRegistry.material(m.id).name)}</b> · ${P.eras[m.unlockEra - 1]} · ${m.unlockRequirements.map((id) => esc(P.research.nodes.find((n) => n.id === id).name)).join(", ")} · acquire from ${esc(window.mapGameIndustrialRegistry.building(m.acquisition.building)?.name || "Commercial building")}</p>`,
        )
        .join("") || "<p>All 100 materials unlocked.</p>"
    }</div>`;
  }
  function install() {
    const dock = document.querySelector("#mgDock");
    if (!dock || navInstalled) return;
    navInstalled = true;
    nav = dock;
    for (const b of dock.querySelectorAll("button"))
      if (!["shop", "map"].includes(b.dataset.action))
        b.dataset.advanced = "true";
    dock.querySelector('[data-action="shop"] span').textContent = "Build";
    dock.querySelector('[data-action="map"] span').textContent = "World";
    for (const [name, fn] of [
      ["Industry", () => shop("industries")],
      ["Research", showResearch],
      [
        "More",
        () => {
          dock.classList.toggle("mg-c1-more");
        },
      ],
    ]) {
      const b = document.createElement("button");
      b.dataset.c1 = name.toLowerCase();
      b.textContent = name;
      b.onclick = fn;
      dock.append(b);
    }
    const build = dock.querySelector('[data-action="shop"]');
    build.onclick = () => shop("starter");
    const goal = document.createElement("aside");
    goal.id = "mgNextGoal";
    goal.innerHTML =
      '<b>Next Goal</b><p data-goal></p><div data-core></div><label>Operating priority <select data-priority><option value="manual">Manual · saved order</option><option value="automatic">Automatic · beginner plan</option></select></label><button data-plan>Apply plan</button>';
    goal.querySelector("[data-plan]").onclick = () =>
      E.setOperatingPriority(goal.querySelector("[data-priority]").value);
    document.body.append(goal);
  }
  E.subscribe((s) => {
    last = s;
    install();
    const single = document.body.dataset.world === "singleplayer";
    document.body.classList.toggle("mg-c1-single", single);
    const g = document.querySelector("#mgNextGoal");
    if (g) {
      g.hidden = !single;
      g.querySelector("[data-goal]").textContent = P.nextGoal(s);
      g.querySelector("[data-core]").textContent =
        `Money $${money(s.money)} · Steel ${money(s.steel)} · Carbon ${money(s.carbon)} · Energy ${money(s.summary.energyUsed)}/${money(s.summary.energySupply)} · Population ${money(s.summary.population)}/${money(s.summary.housing)}`;
      if (document.activeElement !== g.querySelector("select"))
        g.querySelector("select").value =
          s.economy.progression?.priorities.mode || "manual";
      g.querySelector("button").disabled = !s.enabled;
    }
    render(s);
  });
  window.addEventListener("mapgame:runtime-ready", install);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel) panel.hidden = true;
  });
  window.mapGameProgressionUI = { showResearch };
})();
