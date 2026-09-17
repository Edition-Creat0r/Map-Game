// ============================================================
// MAP GAME — ui.js
// Alpha 0.1.1b presentation layer
// Keeps interface styling separate from gameplay.
// ============================================================

(() => {
  "use strict";

  if (window.__mapGameUiLoaded) return;
  window.__mapGameUiLoaded = true;

  const style = document.createElement("style");
  style.id = "map-game-ui-style";
  style.textContent = `
    :root {
      --mg-bg: rgba(5, 12, 21, .88);
      --mg-panel: rgba(8, 18, 29, .86);
      --mg-border: rgba(143, 221, 246, .14);
      --mg-border-strong: rgba(143, 221, 246, .26);
      --mg-text: #edf8ff;
      --mg-muted: #8fa7b5;
      --mg-accent: #75d9f6;
      --mg-positive: #76dda1;
    }

    #mg-topbar {
      min-height: 64px !important;
      background:
        linear-gradient(180deg, rgba(5,12,21,.94), rgba(7,16,27,.82)) !important;
      border-bottom: 1px solid var(--mg-border-strong) !important;
      box-shadow: 0 10px 34px rgba(0,0,0,.20) !important;
      backdrop-filter: blur(14px) saturate(125%);
    }

    #mg-topbar > div:last-child > div {
      background: rgba(255,255,255,.028) !important;
      border-color: rgba(255,255,255,.07) !important;
      box-shadow: inset 0 1px rgba(255,255,255,.025);
    }

    #mg-side-dock {
      width: 58px !important;
      padding: 7px !important;
      background: linear-gradient(180deg, rgba(6,14,24,.92), rgba(6,14,24,.76)) !important;
      border: 1px solid var(--mg-border) !important;
      border-radius: 15px !important;
      box-shadow: 0 16px 40px rgba(0,0,0,.24) !important;
      backdrop-filter: blur(14px) saturate(120%);
    }

    .mg-dock-button {
      position: relative;
      border-radius: 11px !important;
      background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018)) !important;
      border-color: rgba(255,255,255,.075) !important;
      box-shadow: inset 0 1px rgba(255,255,255,.025);
    }

    .mg-dock-button:focus-visible {
      outline: 2px solid var(--mg-accent);
      outline-offset: 2px;
    }

    #mg-inspector,
    #mg-shop {
      background:
        linear-gradient(180deg, rgba(7,16,27,.94), rgba(5,12,21,.91)) !important;
      border-color: var(--mg-border-strong) !important;
      box-shadow: 0 22px 60px rgba(0,0,0,.32) !important;
      backdrop-filter: blur(18px) saturate(120%);
    }

    #mg-bottom-bar {
      background: linear-gradient(90deg, rgba(4,10,18,.89), rgba(8,18,29,.83)) !important;
      border-top-color: var(--mg-border) !important;
      backdrop-filter: blur(12px);
    }

    #mg-graphics-toggle,
    #mg-multiplayer-badge {
      background: rgba(5,13,22,.78) !important;
      border-color: var(--mg-border) !important;
      box-shadow: 0 10px 26px rgba(0,0,0,.20) !important;
      backdrop-filter: blur(12px) saturate(120%);
    }

    #mg-graphics-toggle {
      transition: transform .15s ease, border-color .15s ease, background .15s ease;
    }

    #mg-graphics-toggle:hover {
      transform: translateY(-1px);
      border-color: var(--mg-border-strong) !important;
      background: rgba(10,28,43,.89) !important;
    }

    .mg-area-label {
      position: absolute;
      z-index: 72;
      pointer-events: none;
      color: var(--mg-text);
      font: 800 10px/1.2 Arial, sans-serif;
      letter-spacing: .9px;
      text-shadow: 0 2px 7px rgba(0,0,0,.75);
      opacity: .78;
      white-space: nowrap;
    }

    .mg-ui-corner {
      position: absolute;
      left: 88px;
      top: 79px;
      z-index: 71;
      padding: 7px 10px;
      border: 1px solid rgba(255,255,255,.055);
      border-radius: 9px;
      background: rgba(4,10,18,.43);
      color: rgba(232,247,255,.72);
      font: 700 9px/1.25 Arial, sans-serif;
      letter-spacing: .7px;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }

    @media (max-width: 760px) {
      #mg-topbar { padding: 0 10px !important; }
      #mg-side-dock { left: 8px !important; }
      .mg-ui-corner { display: none; }
    }
  `;
  document.head.appendChild(style);

  const corner = document.createElement("div");
  corner.className = "mg-ui-corner";
  corner.innerHTML = `<span style="color:#79dff7">WORLD VIEW</span> &nbsp;•&nbsp; CIVILIZATION COMMAND`;
  document.body.appendChild(corner);

  function addDockTooltips() {
    document.querySelectorAll(".mg-dock-button").forEach(button => {
      if (button.dataset.mgTooltipReady) return;
      button.dataset.mgTooltipReady = "1";

      const label = button.dataset.label || button.title || "Menu";
      button.setAttribute("aria-label", label);
    });
  }

  addDockTooltips();

  const observer = new MutationObserver(addDockTooltips);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
})();
