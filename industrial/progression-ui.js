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
    navInstalled = false,
    researchReturn = null;
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
    window.mapGameVisuals?.trapDialog(panel);
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-c1-close")) {
        panel.hidden = true;
        researchReturn?.focus();
      }
      if (b.dataset.research) {
        E.completeResearch(b.dataset.research);
        render(last || E.snapshot());
      }
    });
  }
  function showResearch() {
    researchReturn = document.activeElement;
    ensure();
    window.mapGameEconomyUI.hideShop();
    const stats = document.getElementById("mgEconomyStats");
    if (stats) stats.hidden = true;
    panel.hidden = false;
    render(last || E.snapshot());
    panel.querySelector("[data-c1-close]").focus();
  }
  function render(s) {
    if (!panel || panel.hidden) return;
    const p = s.economy.progression;
    if (!p) return;
    const signature = JSON.stringify([
      p.era,
      p.completed,
      s.enabled,
      P.nextGoal(s),
      P.research.nodes.map((n) => E.canAfford(n.cost)),
    ]);
    if (panel.dataset.signature === signature) return;
    const focused = document.activeElement?.dataset.research;
    panel.dataset.signature = signature;
    panel.innerHTML = `<header><h2>Research · ${P.eras[p.era - 1]}</h2><button data-c1-close>Close ×</button></header><p>${esc(P.nextGoal(s))}</p><p>Invest in ideas that shape your city. Grow your population and industry to reach the next era.</p><div class="mg-c1-tree" aria-label="Technology prerequisites">${P.research.nodes
      .map((n) => {
        const reason = P.researchReason(s, n.id),
          can = !reason && s.enabled && E.canAfford(n.cost);
        return `<article data-node="${n.id}" data-completed="${p.completed.includes(n.id)}"><h3>${esc(n.name)}</h3><p>${n.prerequisites.length ? "← " + n.prerequisites.map((id) => esc(P.research.nodes.find((x) => x.id === id).name)).join(" + ") : "Start here"}</p><p>$${money(n.cost.money)} · ${n.effects.materials.length} materials · ${n.effects.buildings.length} factory licenses, when their materials and era are reached${n.effects.eras.length ? " · era milestone: " + n.effects.eras.map((e) => P.eras[e - 1]).join(", ") : ""}</p><button data-research="${n.id}" ${can ? "" : "disabled"}>${esc(reason || (!s.enabled ? "Singleplayer only" : can ? "Research" : "Insufficient money"))}</button></article>`;
      })
      .join(
        "",
      )}</div><details class="mg-resource-discovery"><summary>Discover future materials</summary><p>${P.manifest.materials.filter((m) => P.unlocked(s, m.id)).length} / 100 unlocked · resources for your growing city.</p><div class="mg-c1-discover">${
      P.manifest.materials
        .filter((m) => !P.unlocked(s, m.id))
        .map(
          (m) =>
            `<p><b>${esc(window.mapGameIndustrialRegistry.material(m.id).name)}</b> · ${P.eras[m.unlockEra - 1]} · ${m.unlockRequirements.map((id) => esc(P.research.nodes.find((n) => n.id === id).name)).join(", ")} · acquire from ${esc(window.mapGameIndustrialRegistry.building(m.acquisition.building)?.name || "Commercial building")}</p>`,
        )
        .join("") || "<p>All 100 materials unlocked.</p>"
    }</div></details>`;
    if (focused) panel.querySelector(`[data-research="${focused}"]`)?.focus();
    requestAnimationFrame(drawLinks);
  }
  function drawLinks() {
    const tree = panel?.querySelector(".mg-c1-tree");
    if (!tree || panel.hidden) return;
    tree.querySelector("svg")?.remove();
    const box = tree.getBoundingClientRect();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("mg-research-links");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    for (const n of P.research.nodes)
      for (const id of n.prerequisites) {
        const a = tree
            .querySelector(`[data-node="${id}"]`)
            .getBoundingClientRect(),
          b = tree
            .querySelector(`[data-node="${n.id}"]`)
            .getBoundingClientRect();
        const x1 = a.x + a.width / 2 - box.x,
          y1 = a.bottom - box.y,
          x2 = b.x + b.width / 2 - box.x,
          y2 = b.top - box.y;
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute(
          "d",
          y2 - y1 > 60
            ? `M${x1} ${y1}V${y1 + 13}H${box.width / 2}V${y2 - 13}H${x2}V${y2}`
            : `M${x1} ${y1}V${(y1 + y2) / 2}H${x2}V${y2}`,
        );
        path.setAttribute("fill", "none");
        path.setAttribute(
          "stroke",
          last?.economy.progression.completed.includes(id)
            ? "#58d8d7"
            : "#456173",
        );
        path.setAttribute("stroke-width", "2");
        svg.append(path);
      }
    tree.prepend(svg);
  }
  window.addEventListener("resize", () => requestAnimationFrame(drawLinks));
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
      '<b>Next objective</b><p data-goal></p><div data-core></div><details data-priority-options><summary>Operating priorities</summary><label>Operating priority <select data-priority><option value="manual">Manual · saved order</option><option value="automatic">Automatic · beginner plan</option></select></label><button data-plan>Apply plan</button></details>';
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
    if (e.key === "Escape" && panel && !panel.hidden) {
      panel.hidden = true;
      researchReturn?.focus();
    }
  });
  window.mapGameProgressionUI = { showResearch };
})();
