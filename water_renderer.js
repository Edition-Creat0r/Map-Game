// Shared bounded vector cache; only the active map requests generation.
(() => {
  "use strict";
  const hydro = window.mapGameHydrology,
    cache = new Map();
  let owner = null,
    queue = [],
    job = null,
    revision = 0;
  function loop() {
    if (owner) {
      const start = performance.now();
      while (performance.now() - start < 1) {
        if (!job) {
          const next = queue.shift();
          if (!next) break;
          if (cache.has(next.key)) continue;
          job = { ...next, iterator: hydro.buildTile(next.tx, next.tz) };
        }
        const next = job.iterator.next();
        if (next.done) {
          if (cache.size >= 256) cache.delete(cache.keys().next().value);
          cache.set(job.key, next.value);
          job = null;
          revision++;
          owner.changed();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.createMapGameWaterRenderer = function (ctx, changed) {
    const self = { changed };
    let keys = [],
      layer = null;
    function draw(camera) {
      const { x, z, scale, width, height } = camera;
      const padding = 256,
        left = x - (width / 2 + padding) / scale,
        right = x + (width / 2 + padding) / scale,
        top = z - (height / 2 + padding) / scale,
        bottom = z + (height / 2 + padding) / scale;
      if (owner !== self) {
        owner = self;
        job = null;
        queue = [];
        layer = null;
      }
      const wanted = hydro
        .sourceTiles(left, top, right, bottom)
        .sort(
          (a, b) =>
            Math.hypot(
              (a.tx + 0.5) * hydro.TILE - x,
              (a.tz + 0.5) * hydro.TILE - z,
            ) -
            Math.hypot(
              (b.tx + 0.5) * hydro.TILE - x,
              (b.tz + 0.5) * hydro.TILE - z,
            ),
        )
        .slice(0, 256);
      keys = wanted.map((p) => p.key);
      const wantedSet = new Set(keys);
      queue = queue.filter((p) => wantedSet.has(p.key));
      if (job && !wantedSet.has(job.key)) job = null;
      for (const p of wanted) {
        const value = cache.get(p.key);
        if (value) {
          cache.delete(p.key);
          cache.set(p.key, value);
        } else if (job?.key !== p.key && !queue.some((j) => j.key === p.key))
          queue.push(p);
      }

      if (
        layer &&
        layer.revision === revision &&
        layer.scale === scale &&
        layer.width === width &&
        layer.height === height &&
        Math.abs((layer.x - x) * scale) < 150 &&
        Math.abs((layer.z - z) * scale) < 150
      ) {
        if (layer.count)
          ctx.drawImage(
            layer.canvas,
            -padding + (layer.x - x) * scale,
            -padding + (layer.z - z) * scale,
          );
        return;
      }
      const canvas = layer?.canvas || document.createElement("canvas");
      if (
        canvas.width !== width + 2 * padding ||
        canvas.height !== height + 2 * padding
      ) {
        canvas.width = width + 2 * padding;
        canvas.height = height + 2 * padding;
      }
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.lineCap = "round";
      c.lineJoin = "round";
      let count = 0;
      const seen = new Set(),
        groups = new Map();
      if (scale < 0.01) {
        for (const key of keys) {
          const tile = cache.get(key);
          if (!tile) continue;
          if (!tile.cartography || tile.cartography.scale !== scale) {
            const pad = hydro.HALO + hydro.GRID,
              originX = tile.tx * hydro.TILE - pad,
              originZ = tile.tz * hydro.TILE - pad;
            const image = document.createElement("canvas");
            image.width = image.height =
              Math.ceil((hydro.TILE + pad * 2) * scale) + 2;
            const pen = image.getContext("2d");
            pen.lineCap = "round";
            pen.lineJoin = "round";
            pen.beginPath();
            for (const e of tile.edges) {
              const p = e.points[0],
                q = e.points.at(-1);
              pen.moveTo((p.x - originX) * scale, (p.z - originZ) * scale);
              pen.lineTo((q.x - originX) * scale, (q.z - originZ) * scale);
            }
            pen.strokeStyle = "#397f9b";
            pen.lineWidth = 0.8;
            pen.stroke();
            tile.cartography = { image, scale, originX, originZ };
          }
          const t = tile.cartography;
          c.drawImage(
            t.image,
            padding + width / 2 + (t.originX - x) * scale,
            padding + height / 2 + (t.originZ - z) * scale,
          );
          count += tile.edges.length;
        }
      } else {
        for (const key of keys) {
          const tile = cache.get(key);
          if (!tile) continue;
          cache.delete(key);
          cache.set(key, tile);
          for (const e of tile.edges) {
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            const bounds = e.bounds;
            if (
              bounds.right < left ||
              bounds.left > right ||
              bounds.bottom < top ||
              bounds.top > bottom
            )
              continue;
            for (let i = 1; i < e.points.length; i++) {
              const p = e.points[i - 1],
                q = e.points[i];
              const w =
                scale < 0.01
                  ? 0.75
                  : Math.round((p.width + q.width) * 0.5 * scale * 2) / 2;
              const list = groups.get(w) || [];
              list.push([p, q]);
              groups.set(w, list);
            }
            count++;
          }
        }
        // Paint every bank first, then every stream. Width groups must not
        // repaint dark endcaps over already-painted downstream water.
        for (const pass of ["bank", "water"])
          for (const [w, list] of groups) {
            c.beginPath();
            for (const [p, q] of list) {
              c.moveTo(
                padding + width / 2 + (p.x - x) * scale,
                padding + height / 2 + (p.z - z) * scale,
              );
              c.lineTo(
                padding + width / 2 + (q.x - x) * scale,
                padding + height / 2 + (q.z - z) * scale,
              );
            }
            c.strokeStyle = pass === "bank" ? "#526a60" : "#397f9b";
            c.lineWidth = pass === "bank" ? w + Math.max(0.5, scale * 8) : w;
            c.stroke();
          }
      }
      layer = { canvas, x, z, scale, width, height, revision, count };
      if (count) ctx.drawImage(canvas, -padding, -padding);
    }
    return {
      draw,
      pause() {
        if (owner === self) {
          owner = null;
          queue = [];
          job = null;
        }
      },
      stats: () => ({
        ready: keys.filter((k) => cache.has(k)).length,
        requested: keys.length,
        queued: queue.length,
        building: !!job,
        edges: layer?.count || 0,
        cache: cache.size,
      }),
    };
  };
})();
