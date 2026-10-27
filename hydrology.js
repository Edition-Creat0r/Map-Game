// Bounded potential drainage, not an authoritative flood/erosion simulation.
(() => {
  "use strict";
  const terrain = window.mapGameSharedTerrain,
    GRID = 2048,
    TILE = 131072,
    MAX_STEPS = 16,
    HALO = (MAX_STEPS + 1) * GRID;
  const nodes = new Map(),
    edges = new Map(),
    LIMIT = 65536;
  function hash(x, z, s) {
    let h =
      Math.imul(x ^ terrain.seed ^ s, 374761393) ^ Math.imul(z, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function put(cache, key, value) {
    if (cache.size >= LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return value;
  }
  function node(ix, iz) {
    const key = ix + ":" + iz;
    if (nodes.has(key)) return nodes.get(key);
    const x = (ix + 0.5 + (hash(ix, iz, 1201) - 0.5) * 0.4) * GRID,
      z = (iz + 0.5 + (hash(ix, iz, 1202) - 0.5) * 0.4) * GRID;
    return put(nodes, key, { key, ix, iz, x, z, h: terrain.elevationAt(x, z) });
  }
  const width = (h) => Math.max(10, 10 + (0.9 - h) * 100);
  function edge(ix, iz) {
    const a = node(ix, iz);
    if (edges.has(a.key)) return edges.get(a.key);
    if (a.h < 0.32) return put(edges, a.key, null);
    const neighbors = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx || dz) {
          const n = node(ix + dx, iz + dz);
          if (n.h < a.h) neighbors.push(n);
        }
      }
    neighbors.sort((a, b) => a.h - b.h || a.iz - b.iz || a.ix - b.ix);
    for (const b of neighbors) {
      const length = Math.hypot(b.x - a.x, b.z - a.z),
        nx = -(b.z - a.z) / length,
        nz = (b.x - a.x) / length;
      const sign = hash(ix, iz, 1401) < 0.5 ? -1 : 1;
      // Curvature is accepted only when every finer probe still descends.
      for (const bend of [sign * 0.16, -sign * 0.16, sign * 0.06, 0]) {
        const points = [{ x: a.x, z: a.z, h: a.h, width: width(a.h) }];
        let last = a.h,
          valid = true,
          left = a.x,
          right = a.x,
          top = a.z,
          bottom = a.z;
        for (let i = 1; i <= 8; i++) {
          const t = i / 8,
            offset = Math.sin(Math.PI * t) * length * bend;
          const x = i === 8 ? b.x : a.x + (b.x - a.x) * t + nx * offset,
            z = i === 8 ? b.z : a.z + (b.z - a.z) * t + nz * offset;
          const h = i === 8 ? b.h : terrain.elevationAt(x, z);
          if (h > last + 1e-12) {
            valid = false;
            break;
          }
          points.push({ x, z, h, width: width(h) });
          last = h;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, z);
          bottom = Math.max(bottom, z);
        }
        if (valid)
          return put(edges, a.key, {
            id: a.key,
            to: b.key,
            ix: b.ix,
            iz: b.iz,
            points,
            bounds: { left, right, top, bottom },
          });
      }
    }
    return put(edges, a.key, null);
  }
  function* buildTile(tx, tz) {
    const result = new Map(),
      sources = [];
    for (let sz = tz * 16; sz < (tz + 1) * 16; sz++)
      for (let sx = tx * 16; sx < (tx + 1) * 16; sx++) {
        if (hash(sx, sz, 1301) > 0.25) continue;
        let ix = sx * 4 + Math.floor(hash(sx, sz, 1302) * 4),
          iz = sz * 4 + Math.floor(hash(sx, sz, 1303) * 4);
        if (node(ix, iz).h < 0.38) continue;
        const route = [];
        let termination = "budget";
        for (let step = 0; step < MAX_STEPS; step++) {
          const e = edge(ix, iz);
          yield null;
          if (!e) {
            termination = node(ix, iz).h < 0.32 ? "water" : "closed-basin";
            break;
          }
          route.push(e);
          ix = e.ix;
          iz = e.iz;
        }
        if (termination === "budget") {
          if (node(ix, iz).h < 0.32) termination = "water";
          else if (!edge(ix, iz)) termination = "closed-basin";
        }
        // Never publish a channel ending at an arbitrary trace-budget cutoff.
        if (route.length >= 3 && termination !== "budget") {
          for (const e of route) result.set(e.id, e);
          sources.push({
            id: sx + ":" + sz,
            termination,
            edges: route.map((e) => e.id),
          });
        }
      }
    return { tx, tz, edges: [...result.values()], sources };
  }
  function tile(tx, tz) {
    const iterator = buildTile(tx, tz);
    let n;
    do {
      n = iterator.next();
    } while (!n.done);
    return n.value;
  }
  function sourceTiles(left, top, right, bottom) {
    const out = [];
    for (
      let tz = Math.floor((top - HALO) / TILE);
      tz <= Math.floor((bottom + HALO) / TILE);
      tz++
    )
      for (
        let tx = Math.floor((left - HALO) / TILE);
        tx <= Math.floor((right + HALO) / TILE);
        tx++
      )
        out.push({ tx, tz, key: tx + ":" + tz });
    return out;
  }
  window.mapGameHydrology = Object.freeze({
    VERSION: "0.3.3C",
    GRID,
    TILE,
    MAX_STEPS,
    HALO,
    edge,
    tile,
    buildTile,
    sourceTiles,
    cacheStats: () => ({ nodes: nodes.size, edges: edges.size, limit: LIMIT }),
  });
})();
