// Presentation only. Preference storage never reads/writes economy/world saves.
(() => {
  "use strict";
  const KEY = "mapgame_visual_preferences_v1",
    E = window.mapGameEconomy,
    R = window.mapGameIndustrialRegistry;
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
  const homeSettings = document.getElementById("mgSettingsPanel");
  if (homeSettings) document.body.append(homeSettings);
  const tokens = {
    money: "$",
    steel: "Fe",
    carbon: "C",
    iron: "Fe",
    ironOre: "Fe",
    coal: "C",
    concrete: "▥",
    glass: "◇",
    silica: "Si",
    copperOre: "Cu",
    limestone: "Ca",
    energy: "ϟ",
    population: "♙",
  };
  function icon(id) {
    const m = R.material(id);
    return `<span class="mg-material-icon" data-material="${esc(id)}" title="${esc(m?.name || id)}" aria-hidden="true">${
      tokens[id] ||
      esc(
        (m?.name || id)
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2),
      )
    }</span>`;
  }
  function preview(d) {
    const house = d.category === "Residential",
      plant = d.economy?.energySupply,
      industrial = d.industrial || d.category === "Industrial",
      fp = d.footprint || [40, 40];
    const ratio = Math.max(0.5, Math.min(1.8, fp[0] / fp[1])),
      w = 48 * Math.sqrt(ratio),
      h = 32 / Math.sqrt(ratio),
      x = 48 - w / 2,
      y = 39 - h / 2;
    return `<svg class="mg-building-preview" viewBox="0 0 96 82" role="img" aria-label="${esc(d.name)} plan view, ${fp[0]} by ${fp[1]} metres"><path d="M8 65H88M8 72H88M16 10V72M80 10V72" stroke="#75a5b2" opacity=".13"/><rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="2" fill="#020e16" opacity=".5"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${house ? "#aa9673" : plant ? "#7ba0a6" : industrial ? "#658a9c" : "#7daaad"}" stroke="#b6d6d9"/><path d="M${x} 39H${x + w}" stroke="#d5e5e0" opacity=".7"/>${house ? `<path d="M${x - 3} ${y + 2}L48 ${y - 9}L${x + w + 3} ${y + 2}" fill="#567888" stroke="#afcad0"/>` : industrial || plant ? '<path d="M36 29V16H42V29M55 29V12H61V29" fill="#b9c5bf" stroke="#344e5d"/>' : ""}<text x="48" y="73" text-anchor="middle" fill="#b6cbd3" font-family="system-ui" font-size="8">${fp[0]} × ${fp[1]} m</text></svg>`;
  }
  let prefs = { version: 1, theme: "navy", density: "comfortable" },
    installed = false,
    settingsReturn = null,
    lastCompleted = null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v?.version === 1) prefs = { ...prefs, ...v };
  } catch (_) {}
  function apply() {
    document.documentElement.dataset.theme = [
      "navy",
      "midnight",
      "slate",
    ].includes(prefs.theme)
      ? prefs.theme
      : "navy";
    document.documentElement.dataset.density =
      prefs.density === "compact" ? "compact" : "comfortable";
  }
  apply();
  function announce(text) {
    let el = document.getElementById("mgVisualAnnouncement");
    if (!el) {
      el = document.createElement("div");
      el.id = "mgVisualAnnouncement";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.append(el);
    }
    el.textContent = text;
    el.classList.remove("visible");
    void el.offsetWidth;
    el.classList.add("visible");
  }
  function trapDialog(panel) {
    if (panel.dataset.focusTrap) return;
    panel.dataset.focusTrap = "true";
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        const a = [
          ...panel.querySelectorAll(
            'button:not(:disabled),input,select,a[href],summary,[tabindex="0"]',
          ),
        ].filter((x) => x.getClientRects().length);
        if (a.length) {
          if (e.shiftKey && document.activeElement === a[0]) {
            e.preventDefault();
            a.at(-1).focus();
          } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
            e.preventDefault();
            a[0].focus();
          }
        }
      }
      if (e.key !== "Escape") e.stopPropagation();
    });
  }
  function settings() {
    const el = document.getElementById("mgSettingsPanel");
    if (!el) return;
    settingsReturn = document.activeElement;
    el.hidden = false;
    trapDialog(el);
    document.getElementById("mgCloseSettings").focus();
  }
  function install() {
    if (installed || !document.querySelector("#mgHUD .mg-topbar")) return;
    installed = true;
    const bar = document.querySelector("#mgHUD .mg-topbar"),
      old = bar.querySelector(".mg-top-status");
    old.classList.add("mg-legacy-status");
    const strip = document.createElement("div");
    strip.id = "mgResourceStrip";
    strip.setAttribute("aria-label", "World resources");
    strip.innerHTML = ["money", "steel", "carbon", "energy", "population"]
      .map(
        (id) =>
          `<div class="mg-resource" data-resource="${id}">${icon(id)}<div><span>${id === "money" ? "Money" : id === "steel" ? "Steel" : id === "carbon" ? "Carbon" : id === "energy" ? "Energy" : "Population"}</span><strong>—</strong></div></div>`,
      )
      .join("");
    bar.insertBefore(strip, old);
    const mode = document.createElement("span");
    mode.id = "mgVisualWorld";
    bar.querySelector(".mg-brand-lockup").append(mode);
    const sub = bar.querySelector(".mg-brand-lockup span");
    if (sub) sub.textContent = "INDUSTRIAL REVOLUTION";
    const panel = document.getElementById("mgSettingsPanel"),
      section = document.createElement("section");
    section.className = "mg-settings-group mg-appearance-settings";
    section.innerHTML = `<h3>Appearance</h3><label>Theme <select data-visual-theme><option value="navy">Ocean navy</option><option value="midnight">Midnight</option><option value="slate">Slate</option></select></label><label>Interface density <select data-visual-density><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><h3>Rendering & interface</h3><div data-render-controls></div><p>Appearance preferences apply on this device.</p>`;
    panel.append(section);
    for (const id of ["mgUIModeToggle", "mgGraphicsToggle"])
      section
        .querySelector("[data-render-controls]")
        .append(document.getElementById(id));
    for (const [selector, key] of [
      ["[data-visual-theme]", "theme"],
      ["[data-visual-density]", "density"],
    ]) {
      const el = section.querySelector(selector);
      el.value = prefs[key];
      el.onchange = () => {
        prefs[key] = el.value;
        apply();
        try {
          localStorage.setItem(KEY, JSON.stringify(prefs));
          announce("Appearance updated");
        } catch (_) {
          announce(
            "Appearance updated for this session; storage is unavailable.",
          );
        }
      };
    }
    document.querySelector('#mgDock [data-action="settings"]').onclick =
      settings;
    document.getElementById("mgShadowsToggle").addEventListener("click", () => {
      if (window.mapGameRuntime?.scene)
        window.mapGameRuntime.scene.shadowsEnabled =
          localStorage.getItem("mapgame_shadows_enabled") !== "false";
    });
    document
      .getElementById("mgCloseSettings")
      .addEventListener("click", () => settingsReturn?.focus());
    for (const button of document.querySelectorAll("#mgDock button")) {
      const text =
        button.querySelector("span")?.textContent || button.textContent;
      button.setAttribute("aria-label", text.trim());
      button.title = button.title || text.trim();
    }
  }
  const fmt = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: "compact",
  });
  E.subscribe((s) => {
    install();
    const caption = document.querySelector(".mg-sw-heading .mg-kicker");
    if (caption)
      caption.textContent =
        document.body.dataset.world === "singleplayer"
          ? "WORLD ATLAS · SINGLEPLAYER"
          : "WORLD ATLAS · CENTRAL WORLD";
    const note = document.querySelector(".mg-sw-inspector .mg-panel-note");
    if (note)
      note.textContent =
        "Select a territory to inspect the landscape and enter your world.";
    const strip = document.getElementById("mgResourceStrip");
    if (strip) {
      const values = {
        money: "$" + fmt.format(s.money),
        steel: fmt.format(s.steel),
        carbon: fmt.format(s.carbon),
        energy: `${fmt.format(s.summary.energyUsed)}/${fmt.format(s.summary.energySupply)}`,
        population: `${fmt.format(s.summary.population)}/${fmt.format(s.summary.housing)}`,
      };
      for (const [id, v] of Object.entries(values)) {
        const el = strip.querySelector(`[data-resource="${id}"]`);
        el.querySelector("strong").textContent = v;
        el.tabIndex = 0;
        el.setAttribute("aria-label", id + " " + v);
        el.title =
          id === "energy"
            ? `${s.summary.energyUsed} used / ${s.summary.energySupply} available`
            : id === "population"
              ? `${s.summary.population} residents / ${s.summary.housing} housing`
              : String(s[id]);
      }
      document.getElementById("mgVisualWorld").textContent =
        document.body.dataset.world === "singleplayer"
          ? "Singleplayer"
          : "Central World";
    }
    const ids = s.economy.progression?.completed || [];
    if (lastCompleted) {
      for (const id of ids)
        if (!lastCompleted.has(id)) {
          const n = window.mapGameProgression.research.nodes.find(
            (n) => n.id === id,
          );
          announce(`${n?.name || "Technology"} unlocked`);
          requestAnimationFrame(() =>
            document
              .querySelector(`[data-node="${id}"]`)
              ?.classList.add("mg-new-unlock"),
          );
        }
    }
    lastCompleted = new Set(ids);
  });
  window.addEventListener("mapgame:runtime-ready", install);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const el = document.getElementById("mgSettingsPanel");
      if (!el.hidden) {
        el.hidden = true;
        settingsReturn?.focus();
      }
    }
  });
  const home = document.querySelector(".mg-home-kicker");
  if (home) home.textContent = "MAP GAME · INDUSTRIAL REVOLUTION";
  const hero = document.querySelector(".mg-home-hero>p");
  if (hero)
    hero.textContent =
      "Explore the planet, build a city, and grow your industry.";
  window.mapGameVisuals = {
    icon,
    preview,
    trapDialog,
    announce,
    settings,
    preferences: () => ({ ...prefs }),
  };
})();
