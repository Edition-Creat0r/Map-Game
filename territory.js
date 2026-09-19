// ============================================================
// MAP GAME — territory.js
// Alpha 0.2.2B1.2 huge territory planning + terrain rules
//
// This file is deliberately data/math focused.
// Babylon meshes remain in game.js for now; this module owns:
// - deterministic large-scale height shaping
// - water / edge / slope placement rules
// - clustered vegetation planning
// - separated future city-site candidates
// - rock/debris planning
//
// Later, territory rendering itself can move here without changing saves.
// ============================================================

(() => {
  "use strict";

  // Cache deterministic city-site layouts per territory/biome/size.
  // This declaration was accidentally dropped during the 0.2.2B1 size/streaming migration,
  // which caused heightAt() -> citySites() to throw before the first sector could render.
  const citySiteCache = new Map();

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  function hash(x, y, salt = 0) {
    const n =
      Math.sin(
        x * 127.1 +
        y * 311.7 +
        salt * 74.7
      ) * 43758.5453123;
    return fract(n);
  }

  function smoothNoise(x, z, seedX, seedY, scale, salt) {
    const ax = (x + seedX * 113.7) * scale;
    const az = (z - seedY * 97.3) * scale;

    return (
      Math.sin(ax + salt * 0.13) * 0.42 +
      Math.cos(az - salt * 0.17) * 0.34 +
      Math.sin((ax + az) * 0.61 + salt) * 0.24
    );
  }

  function ridgeNoise(x, z, seedX, seedY, scale, salt) {
    const n = smoothNoise(x, z, seedX, seedY, scale, salt);
    return 1 - Math.abs(n);
  }

  function biomeProfile(biome) {
    const profiles = {
      plains:   { macro: 0.62, detail: 0.48, ridge: 0.10, amp: 15, trees: 0.42 },
      forest:   { macro: 0.72, detail: 0.54, ridge: 0.16, amp: 20, trees: 1.00 },
      mountain: { macro: 0.96, detail: 0.64, ridge: 1.00, amp: 54, trees: 0.34 },
      desert:   { macro: 0.58, detail: 0.72, ridge: 0.18, amp: 22, trees: 0.05 },
      coast:    { macro: 0.38, detail: 0.34, ridge: 0.08, amp: 12, trees: 0.28 },
      wetland:  { macro: 0.22, detail: 0.22, ridge: 0.02, amp: 7, trees: 0.52 },
      tundra:   { macro: 0.66, detail: 0.44, ridge: 0.28, amp: 24, trees: 0.20 }
    };
    return profiles[biome] || profiles.plains;
  }

  function waterBandAt(x, z, biome, chunkSize) {
    const half = chunkSize / 2;

    if (biome === "coast") {
      const coastLine =
        half * 0.60 +
        Math.sin(x * 0.006) * 70 +
        Math.sin(x * 0.014 + 1.2) * 24;
      return {
        isWater: z > coastLine,
        depth: Math.max(0, z - coastLine),
        shoreZ: coastLine
      };
    }

    if (biome === "wetland") {
      const channel =
        Math.sin(x * 0.008 + 0.8) * 72 +
        Math.sin(x * 0.0027 - 1.7) * 105;
      const riverZ = channel + chunkSize * 0.13;
      const width = 34 + Math.abs(Math.sin(x * 0.013)) * 28;
      return {
        isWater: Math.abs(z - riverZ) < width,
        depth: Math.max(0, width - Math.abs(z - riverZ)),
        shoreZ: riverZ
      };
    }

    return { isWater: false, depth: 0, shoreZ: null };
  }

  function heightAt(x, z, biome, cellX, cellY, chunkSize = 32768) {
    const p = biomeProfile(biome);
    const scaleFix = 1800 / Math.max(1800, chunkSize);

    const macro =
      smoothNoise(x, z, cellX, cellY, 0.0026 * scaleFix, 4) * p.macro;

    const broad =
      smoothNoise(x, z, cellX, cellY, 0.0056 * scaleFix, 9) * 0.52;

    const medium =
      smoothNoise(x, z, cellX, cellY, 0.0135 * scaleFix, 17) * p.detail;

    const tiny =
      smoothNoise(x, z, cellX, cellY, 0.031 * scaleFix, 29) * 0.11;

    let height =
      (macro * 0.62 + broad * 0.25 + medium * 0.11 + tiny * 0.02) *
      p.amp;

    if (biome === "mountain") {
      const ridgeA = Math.pow(
        clamp(ridgeNoise(x, z, cellX, cellY, 0.0038, 37), 0, 1),
        2.1
      );
      const ridgeB = Math.pow(
        clamp(ridgeNoise(x + 260, z - 190, cellX, cellY, 0.0051, 43), 0, 1),
        3.2
      );
      height += (ridgeA * 72 + ridgeB * 46) * p.ridge - 20;
    }

    if (biome === "desert") {
      height += Math.sin((x + z) * 0.0105) * 2.6;
    }

    const water = waterBandAt(x, z, biome, chunkSize);
    if (water.isWater) {
      height -= Math.min(24, 5 + water.depth * 0.08);
    } else if (biome === "coast" && water.shoreZ !== null) {
      const shoreDistance = water.shoreZ - z;
      if (shoreDistance < 120) {
        height -= (120 - shoreDistance) * 0.035;
      }
    }

    // Keep several broad naturally-buildable basins around the territory.
    // This does NOT flatten the entire chunk.
    for (const site of citySites({ x: cellX, y: cellY }, biome, chunkSize)) {
      const dx = x - site.x;
      const dz = z - site.z;
      const d = Math.hypot(dx, dz);
      if (d < site.radius) {
        const influence = 1 - clamp(d / site.radius, 0, 1);
        height *= 1 - influence * 0.56;
      }
    }

    return height;
  }

  function slopeAt(x, z, biome, cellX, cellY, chunkSize = 32768, sample = 22) {
    const h = heightAt(x, z, biome, cellX, cellY, chunkSize);
    const hx = heightAt(x + sample, z, biome, cellX, cellY, chunkSize);
    const hz = heightAt(x, z + sample, biome, cellX, cellY, chunkSize);
    return Math.max(Math.abs(hx - h), Math.abs(hz - h));
  }

  function citySites(cell, biome, chunkSize = 32768) {
    const cacheKey = `${cell.x}:${cell.y}:${biome}:${chunkSize}`;
    if (citySiteCache.has(cacheKey)) return citySiteCache.get(cacheKey);
    const half = chunkSize / 2;
    const margin = Math.max(220, chunkSize * 0.17);

    const anchors = [
      [-0.28, -0.20],
      [ 0.26, -0.25],
      [-0.23,  0.27],
      [ 0.29,  0.22],
      [ 0.00,  0.02]
    ];

    const result = anchors.map((pair, i) => {
      const jitterX = (hash(cell.x, cell.y, 100 + i * 7) - 0.5) * chunkSize * 0.08;
      const jitterZ = (hash(cell.x, cell.y, 103 + i * 7) - 0.5) * chunkSize * 0.08;

      let x = pair[0] * chunkSize + jitterX;
      let z = pair[1] * chunkSize + jitterZ;

      x = clamp(x, -half + margin, half - margin);
      z = clamp(z, -half + margin, half - margin);

      if (biome === "coast") {
        z = Math.min(z, chunkSize * 0.18);
      }

      return {
        id: `site_${i}`,
        x,
        z,
        radius: chunkSize * (i === 4 ? 0.085 : 0.070),
        recommended:
          i === 4 ||
          hash(cell.x, cell.y, 200 + i) > 0.34
      };
    });
    citySiteCache.set(cacheKey, result);
    return result;
  }

  function terrainClassAt(x, z, biome, cellX, cellY, chunkSize = 32768) {
    const slope = slopeAt(x, z, biome, cellX, cellY, chunkSize, 18);
    const h = heightAt(x, z, biome, cellX, cellY, chunkSize);
    const rocky =
      biome === "mountain" ||
      slope > 9 ||
      (biome === "tundra" && h > 10);

    return {
      rocky,
      slope,
      height: h,
      label: rocky ? "rocky terrain" : "soil terrain"
    };
  }

  function analyzeSite({
    x,
    z,
    biome,
    cellX,
    cellY,
    chunkSize = 32768,
    footprint = 90
  }) {
    const half = chunkSize / 2;
    const edgeBuffer = Math.max(60, footprint * 0.80);
    const water = waterBandAt(x, z, biome, chunkSize);
    const slope = slopeAt(x, z, biome, cellX, cellY, chunkSize, 24);

    const reasons = [];
    let score = 100;

    if (
      Math.abs(x) > half - edgeBuffer ||
      Math.abs(z) > half - edgeBuffer
    ) {
      reasons.push("Too close to the territory boundary");
      score -= 100;
    }

    if (water.isWater) {
      reasons.push("Water / flood channel");
      score -= 100;
    }

    if (slope > 18) {
      reasons.push("Terrain is too steep");
      score -= 80;
    } else if (slope > 10) {
      reasons.push("Uneven terrain");
      score -= 28;
    } else {
      reasons.push("Stable terrain");
    }

    if (!water.isWater) {
      reasons.push("Dry build area");
    }

    const nearest = citySites({ x: cellX, y: cellY }, biome, chunkSize)
      .map(site => ({ site, d: Math.hypot(site.x - x, site.z - z) }))
      .sort((a, b) => a.d - b.d)[0];

    if (nearest && nearest.d < nearest.site.radius * 0.92) {
      reasons.push("Inside a broad development basin");
      score += 12;
    }

    const status =
      score >= 84 ? "excellent" :
      score >= 58 ? "usable" :
      "blocked";

    return {
      allowed: status !== "blocked",
      status,
      score: clamp(score, 0, 100),
      slope,
      water: water.isWater,
      reasons,
      nearestDevelopmentSite: nearest?.site || null
    };
  }

  function vegetationPoints(cell, biome, chunkSize = 32768, graphics = "BASIC") {
    const p = biomeProfile(biome);
    const baseCount = graphics === "REGULAR" ? 420 : 250;
    const target = Math.round(baseCount * p.trees);
    const half = chunkSize / 2;
    const points = [];

    // Cluster centers produce real forest stands with open meadows between.
    const clusterCount =
      biome === "forest" ? 24 :
      biome === "wetland" ? 18 :
      biome === "plains" ? 16 :
      10;

    const clusters = [];
    for (let c = 0; c < clusterCount; c++) {
      clusters.push({
        x: (hash(cell.x, cell.y, 400 + c * 5) - 0.5) * chunkSize * 0.82,
        z: (hash(cell.x, cell.y, 402 + c * 5) - 0.5) * chunkSize * 0.82,
        radius:
          chunkSize *
          (0.045 + hash(cell.x, cell.y, 404 + c * 5) * 0.065)
      });
    }

    for (let i = 0; i < target; i++) {
      const c = clusters[i % clusters.length];
      const angle = hash(cell.x, cell.y, 800 + i * 3) * Math.PI * 2;
      const rr = Math.sqrt(hash(cell.x, cell.y, 801 + i * 3)) * c.radius;
      const x = clamp(c.x + Math.cos(angle) * rr, -half + 55, half - 55);
      const z = clamp(c.z + Math.sin(angle) * rr, -half + 55, half - 55);

      const water = waterBandAt(x, z, biome, chunkSize);
      if (water.isWater) continue;

      const nearCitySite = citySites(cell, biome, chunkSize)
        .some(site => Math.hypot(site.x - x, site.z - z) < site.radius * 0.58);
      if (nearCitySite) continue;

      points.push({
        x,
        z,
        scale: 0.68 + hash(cell.x, cell.y, 900 + i) * 0.72,
        conifer:
          biome === "tundra" ||
          biome === "mountain" ||
          hash(cell.x, cell.y, 1000 + i) > 0.80
      });
    }

    return points;
  }

  function rockPoints(cell, biome, chunkSize = 32768, graphics = "BASIC") {
    const count =
      biome === "mountain"
        ? (graphics === "REGULAR" ? 90 : 56)
        : (graphics === "REGULAR" ? 44 : 26);

    const half = chunkSize / 2;
    const result = [];

    for (let i = 0; i < count; i++) {
      const x = (hash(cell.x, cell.y, 1300 + i * 3) - 0.5) * chunkSize * 0.90;
      const z = (hash(cell.x, cell.y, 1301 + i * 3) - 0.5) * chunkSize * 0.90;
      if (waterBandAt(x, z, biome, chunkSize).isWater) continue;

      result.push({
        x: clamp(x, -half + 35, half - 35),
        z: clamp(z, -half + 35, half - 35),
        scale: 0.75 + hash(cell.x, cell.y, 1302 + i * 3) * 2.4
      });
    }

    return result;
  }

  window.mapGameTerritory = {
    VERSION: "0.2.2B1.2",
    heightAt,
    slopeAt,
    waterBandAt,
    citySites,
    analyzeSite,
    vegetationPoints,
    rockPoints,
    terrainClassAt
  };

  console.log("Map Game territory planner 0.2.2B1.2 city-site cache hotfix ready.");
})();
