// Cached world-anchored canopy tiles and exact same trees at every LOD.
(() => {
  "use strict";
  window.createMapGameForestRenderer = function (ctx, onChange) {
    const forest = window.mapGameForest,
      terrain = window.mapGameSharedTerrain;
    const records = new Map(),
      tiles = new Map(),
      images = {},
      queue = [];
    const CACHE_LIMIT = 120,
      RECORD_LIMIT = 8192,
      SIZE = forest.TILE_SIZE,
      SCALE = 1 / 6,
      PAD = 20;
    let layer = null,
      tileRevision = 0;
    let active = false,
      wanted = new Set(),
      built = 0,
      hits = 0,
      drawn = 0,
      nowCamera = null;
    const sprites = {
      broadleaf: "tree_small_green.png",
      olive: "tree_round_olive.png",
      willow: "tree_deciduous_mint_large.png",
      flowering: "tree_cherry_pink.png",
      scrub: "tree_round_olive.png",
    };
    for (const [id, name] of Object.entries(sprites)) {
      const img = new Image();
      img.onload = () => {
        if (layer) layer.revision = -1;
        onChange();
      };
      img.src = "assets/environment/trees/" + name;
      images[id] = img;
    }
    for (const species of ["spruce", "pine"]) {
      const atlas = document.createElement("canvas");
      atlas.width = 64;
      atlas.height = 96;
      const c = atlas.getContext("2d");
      c.fillStyle = "#63503c";
      c.fillRect(29, 57, 6, 36);
      for (let level = 5; level >= 0; level--) {
        const y = 8 + level * 10,
          w = 10 + level * 3.5;
        c.fillStyle = species === "spruce" ? "#244d43" : "#385b40";
        c.beginPath();
        c.moveTo(32, y - 7);
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          c.lineTo(32 - w + 2 * w * t, y + 21 - Math.sin(t * Math.PI * 8) * 2);
        }
        c.closePath();
        c.fill();
        c.fillStyle = species === "spruce" ? "#507c67" : "#729061";
        c.beginPath();
        c.moveTo(32, y - 7);
        c.lineTo(32 - w, y + 19);
        c.lineTo(29, y + 13);
        c.closePath();
        c.fill();
      }
      images[species] = atlas;
    }
    function record(ix, iz) {
      const key = ix + ":" + iz;
      if (records.has(key)) {
        hits++;
        return records.get(key);
      }
      const value = forest.treeAt(ix, iz);
      if (records.size >= RECORD_LIMIT)
        records.delete(records.keys().next().value);
      records.set(key, value);
      built++;
      return value;
    }
    function primitive(c, t, x, y, height) {
      c.fillStyle = t.color;
      if (t.species === "spruce" || t.species === "pine") {
        c.beginPath();
        c.moveTo(x, y - height);
        c.lineTo(x - height * 0.32, y);
        c.lineTo(x + height * 0.32, y);
        c.closePath();
        c.fill();
        c.fillStyle = "#72917a";
        c.beginPath();
        c.moveTo(x, y - height);
        c.lineTo(x, y - height * 0.12);
        c.lineTo(x - height * 0.24, y - height * 0.12);
        c.closePath();
        c.fill();
      } else {
        c.beginPath();
        c.ellipse(
          x,
          y - height * 0.42,
          height * 0.38,
          height * 0.46,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    function finish(job) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE * SCALE + PAD * 2;
      const c = canvas.getContext("2d");
      for (const t of job.trees) {
        c.fillStyle = t.color;
        c.beginPath();
        c.ellipse(
          (t.x - job.x) * SCALE + PAD,
          (t.z - job.z) * SCALE + PAD,
          t.size * 0.65 * SCALE,
          t.size * 0.48 * SCALE,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      if (tiles.size >= CACHE_LIMIT) tiles.delete(tiles.keys().next().value);
      tiles.set(job.key, { ...job, canvas });
      tileRevision++;
      onChange();
    }
    function loop() {
      if (active && queue.length) {
        const start = performance.now();
        while (queue.length && performance.now() - start < 2) {
          const job = queue[0];
          if (!wanted.has(job.key)) {
            queue.shift();
            continue;
          }
          const ix = job.tx * 8 + (job.index % 8),
            iz = job.tz * 8 + Math.floor(job.index / 8);
          const tree = record(ix, iz);
          if (tree) job.trees.push(tree);
          if (++job.index === 64) {
            finish(job);
            queue.shift();
          }
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function draw(camera) {
      active = true;
      nowCamera = camera;
      const { x, z, zoom, width, height, originX, originZ } = camera;
      const shadows = window.mapGameRuntime?.scene?.shadowsEnabled !== false;
      // Padding includes crowns whose roots lie outside the viewport.
      const weights = forest.lod(zoom);
      // Large/high-DPI views fall back smoothly to cached coarse cover instead
      // of thrashing the fixed 120-tile cache. Candidate identities are unchanged.
      const cells = (width / (zoom * SIZE) + 3) * (height / (zoom * SIZE) + 3);
      let capacity = Math.max(0, Math.min(1, (120 - cells) / 30));
      capacity = capacity * capacity * (3 - 2 * capacity);
      weights.medium *= capacity;
      // Far canopy is already baked into the cached terrain raster. Avoid
      // requesting more tiles than the bounded detail cache can retain.
      if (weights.medium === 0) {
        active = false;
        queue.length = 0;
        drawn = 0;
        return;
      }
      let margin =
        weights.close === 1 && weights.medium === 1 ? 128 / zoom + 140 : 100;
      const tileCount = (pad) =>
        (Math.floor((x + width / (2 * zoom) + pad) / SIZE) -
          Math.floor((x - width / (2 * zoom) - pad) / SIZE) +
          1) *
        (Math.floor((z + height / (2 * zoom) + pad) / SIZE) -
          Math.floor((z - height / (2 * zoom) - pad) / SIZE) +
          1);
      if (tileCount(margin) > CACHE_LIMIT) {
        // A partial-detail view needs no translated viewport padding.
        weights.medium = Math.min(weights.medium, 0.999);
        margin = 100;
        if (tileCount(margin) > CACHE_LIMIT) {
          active = false;
          queue.length = 0;
          drawn = 0;
          return;
        }
      }
      const left = Math.max(originX, x - width / (2 * zoom) - margin),
        right = Math.min(
          originX + terrain.SIZE,
          x + width / (2 * zoom) + margin,
        ),
        top = Math.max(originZ, z - height / (2 * zoom) - margin),
        bottom = Math.min(
          originZ + terrain.SIZE,
          z + height / (2 * zoom) + margin,
        );
      const next = new Set(),
        visible = [];
      for (
        let tz = Math.floor(top / SIZE);
        tz <= Math.floor(bottom / SIZE);
        tz++
      )
        for (
          let tx = Math.floor(left / SIZE);
          tx <= Math.floor(right / SIZE);
          tx++
        ) {
          const key = tx + ":" + tz;
          next.add(key);
          const tile = tiles.get(key);
          if (tile) {
            tiles.delete(key);
            tiles.set(key, tile);
            visible.push(tile);
          } else if (!queue.some((j) => j.key === key))
            queue.push({
              key,
              tx,
              tz,
              x: tx * SIZE,
              z: tz * SIZE,
              index: 0,
              trees: [],
            });
        }
      wanted = next;
      const { medium, close } = weights,
        trees = [];
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        width / 2 + (originX - x) * zoom,
        height / 2 + (originZ - z) * zoom,
        terrain.SIZE * zoom,
        terrain.SIZE * zoom,
      );
      ctx.clip();
      if (medium < 1) {
        ctx.globalAlpha = 1 - medium;
        for (const tile of visible)
          ctx.drawImage(
            tile.canvas,
            width / 2 + (tile.x - x - PAD / SCALE) * zoom,
            height / 2 + (tile.z - z - PAD / SCALE) * zoom,
            (tile.canvas.width / SCALE) * zoom,
            (tile.canvas.height / SCALE) * zoom,
          );
      }
      if (
        close === 1 &&
        medium === 1 &&
        layer &&
        layer.zoom === zoom &&
        layer.width === width &&
        layer.height === height &&
        layer.revision === tileRevision &&
        layer.shadows === shadows &&
        Math.abs((x - layer.x) * zoom) < 96 &&
        Math.abs((z - layer.z) * zoom) < 96
      ) {
        ctx.globalAlpha = 1;
        ctx.drawImage(
          layer.canvas,
          -128 + (layer.x - x) * zoom,
          -128 + (layer.z - z) * zoom,
        );
        ctx.restore();
        return;
      }
      let target = ctx,
        offset = 0,
        newLayer = null;
      if (close === 1 && medium === 1) {
        newLayer = layer?.canvas || document.createElement("canvas");
        if (
          newLayer.width !== width + 256 ||
          newLayer.height !== height + 256
        ) {
          newLayer.width = width + 256;
          newLayer.height = height + 256;
        }
        target = newLayer.getContext("2d");
        target.clearRect(0, 0, newLayer.width, newLayer.height);
        offset = 128;
      }
      if (medium > 0) {
        for (const tile of visible)
          for (const t of tile.trees)
            if (
              t.x >= left &&
              t.x < right &&
              t.z >= top &&
              t.z < bottom &&
              t.x >= originX &&
              t.x < originX + terrain.SIZE &&
              t.z >= originZ &&
              t.z < originZ + terrain.SIZE
            )
              trees.push(t);
        trees.sort((a, b) => a.z - b.z || a.x - b.x);
        for (const t of trees) {
          const px = offset + width / 2 + (t.x - x) * zoom,
            py = offset + height / 2 + (t.z - z) * zoom,
            h = t.size * zoom * 1.16,
            img = images[t.species];
          if (shadows) {
            target.globalAlpha = medium * 0.19;
            target.fillStyle = "#0b2021";
            target.beginPath();
            target.ellipse(
              px + h * 0.14,
              py + h * 0.015,
              h * 0.32,
              h * 0.09,
              -0.25,
              0,
              Math.PI * 2,
            );
            target.fill();
          }
          if (close < 1) {
            target.globalAlpha = medium * (1 - close);
            primitive(target, t, px, py, h);
          }
          if (close > 0) {
            target.globalAlpha = medium * close;
            if (
              img &&
              (img.naturalWidth || img.width) &&
              (!(img instanceof HTMLImageElement) || img.complete)
            )
              target.drawImage(
                img,
                px -
                  (h * (img.naturalWidth || img.width)) /
                    (img.naturalHeight || img.height) /
                    2,
                py - h,
                (h * (img.naturalWidth || img.width)) /
                  (img.naturalHeight || img.height),
                h,
              );
            else primitive(target, t, px, py, h);
          }
        }
      }
      if (newLayer) {
        layer = {
          canvas: newLayer,
          x,
          z,
          zoom,
          width,
          height,
          revision: tileRevision,
          shadows,
        };
        ctx.globalAlpha = 1;
        ctx.drawImage(newLayer, -128, -128);
      }
      drawn = trees.length;
      ctx.restore();
    }
    return {
      draw,
      pause() {
        active = false;
        queue.length = 0;
      },
      reset() {
        active = false;
        layer = null;
        tiles.clear();
        records.clear();
        queue.length = 0;
        wanted.clear();
      },
      getState: () => ({
        records: records.size,
        tiles: tiles.size,
        queued: queue.length,
        built,
        hits,
        drawn,
        lod: nowCamera ? forest.lod(nowCamera.zoom) : null,
      }),
    };
  };
})();
