// 0.3.3B: deterministic vegetation. Coordinates and IDs never depend on a view.
(() => {
  "use strict";
  const terrain = window.mapGameSharedTerrain;
  const CELL = 72,
    TILE_CELLS = 8,
    TILE_SIZE = CELL * TILE_CELLS;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (v) => {
    v = clamp(v);
    return v * v * (3 - 2 * v);
  };
  const families = Object.freeze({
    temperate_forest: 0.94,
    grassland: 0.13,
    dry_plains: 0.05,
    taiga: 0.86,
    alpine: 0.12,
    tundra_snow: 0.025,
    wetlands: 0.72,
    coastal: 0.19,
  });
  const ids = Object.keys(families);
  const colors = {
    spruce: "#345e53",
    pine: "#486b56",
    scrub: "#71816a",
    willow: "#6e9880",
    olive: "#7e8e57",
    broadleaf: "#528347",
    flowering: "#a57987",
  };
  const sizeScale = {
    temperate_forest: 1.1,
    grassland: 0.82,
    dry_plains: 0.78,
    taiga: 1.05,
    alpine: 0.85,
    tundra_snow: 0.9,
    wetlands: 1.05,
    coastal: 0.85,
  };
  function hash(x, z, s) {
    let h =
      Math.imul(x ^ terrain.seed ^ s, 374761393) ^ Math.imul(z, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function field(x, z, scale, s) {
    const ix = Math.floor(x / scale),
      iz = Math.floor(z / scale),
      a = smooth(x / scale - ix),
      b = smooth(z / scale - iz);
    return (
      (hash(ix, iz, s) * (1 - a) + hash(ix + 1, iz, s) * a) * (1 - b) +
      (hash(ix, iz + 1, s) * (1 - a) + hash(ix + 1, iz + 1, s) * a) * b
    );
  }
  // Shared coarse cover potential. Uses the supplied sample, never resamples terrain.
  function coverage(s) {
    if (s.water || s.steepness >= 0.69) return 0;
    const temp = s.biome.temperature;
    const treeline = 0.7 + temp * 0.24;
    const limit =
      (1 - smooth((s.elevation - (treeline - 0.06)) / 0.06)) *
      smooth((temp - 0.16) / 0.12) *
      (1 - smooth((s.steepness - 0.48) / 0.21));
    let density = 0;
    for (const id of ids) density += (s.biome.weights[id] || 0) * families[id];
    return clamp(
      density *
        (0.62 +
          (typeof s.forest === "number" ? s.forest : s.forestDensity) * 0.65) *
        limit,
    );
  }
  function densityAt(s, x, z) {
    const cover = coverage(s);
    if (cover <= 0) return 0;
    const cluster = smooth((field(x, z, 1500, 901) - 0.22) / 0.5);
    const clearing = smooth((field(x, z, 420, 903) - 0.24) / 0.32);
    return cover * (0.1 + 0.9 * cluster) * (0.08 + 0.92 * clearing);
  }
  function treeAt(ix, iz) {
    const x = (ix + 0.12 + 0.76 * hash(ix, iz, 144)) * CELL,
      z = (iz + 0.12 + 0.76 * hash(ix, iz, 194)) * CELL;
    const s = terrain.sample(x, z);
    // Coherent stands and clearings, sampled only once per cached candidate.
    const density = densityAt(s, x, z);
    if (hash(ix, iz, 293) >= density) return null;
    let pick = hash(ix, iz, 294),
      total = 0;
    for (const id of ids) total += (s.biome.weights[id] || 0) * families[id];
    let family = "grassland";
    pick *= total;
    for (const id of ids) {
      const amount = (s.biome.weights[id] || 0) * families[id];
      if (amount <= 0) continue;
      family = id;
      pick -= amount;
      if (pick <= 0) break;
    }
    let species =
      family === "taiga"
        ? "spruce"
        : family === "alpine"
          ? "pine"
          : family === "tundra_snow"
            ? "scrub"
            : family === "wetlands"
              ? "willow"
              : family === "dry_plains"
                ? "olive"
                : "broadleaf";
    if (hash(ix, iz, 777) < 0.004 && family === "temperate_forest")
      species = "flowering";
    const size =
      (species === "scrub"
        ? 18
        : species === "pine"
          ? 39
          : species === "spruce"
            ? 65
            : 58) *
      (0.72 + hash(ix, iz, 411) * 0.62) *
      sizeScale[family];
    return {
      id: `${ix}:${iz}`,
      x,
      z,
      species,
      family,
      size,
      color: colors[species],
    };
  }
  function treesInBounds(left, top, right, bottom) {
    const trees = [];
    for (let iz = Math.floor(top / CELL); iz < Math.ceil(bottom / CELL); iz++)
      for (
        let ix = Math.floor(left / CELL);
        ix < Math.ceil(right / CELL);
        ix++
      ) {
        const t = treeAt(ix, iz);
        if (t && t.x >= left && t.x < right && t.z >= top && t.z < bottom)
          trees.push(t);
      }
    return trees;
  }
  // Presentation weights only; candidate IDs, density, species and sizes stay fixed.
  function lod(zoom) {
    return {
      medium: smooth((zoom - 0.18) / 0.1),
      close: smooth((zoom - 0.22) / 0.1),
    };
  }
  window.mapGameForest = Object.freeze({
    VERSION: "0.3.3B",
    CELL,
    TILE_CELLS,
    TILE_SIZE,
    families,
    coverage,
    densityAt,
    treeAt,
    treesInBounds,
    lod,
  });
})();
