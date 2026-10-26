// 0.3.3C: appearance only. Never changes samples, classification or vegetation.
(() => {
  "use strict";
  const terrain = window.mapGameSharedTerrain;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (v) => {
    v = clamp(v);
    return v * v * (3 - 2 * v);
  };
  function shade(w, e, n, s, c, step) {
    const dx = ((e - w) * 940 * 18) / (2 * step),
      dz = ((s - n) * 940 * 18) / (2 * step);
    const light =
      (0.55 * dx + 0.4 * dz + 0.733) / Math.sqrt(1 + dx * dx + dz * dz);
    const concavity =
      (Math.max(0, (w + e + n + s) / 4 - c) * 940 * 6000) / (step * step);
    return clamp(
      (light - 0.733) * 0.7 - clamp(concavity, 0, 0.065),
      -0.34,
      0.25,
    );
  }
  function color(s, r, g, b) {
    if (s.water) {
      const depth = smooth((0.32 - s.elevation) / 0.085);
      return [68 - 45 * depth, 139 - 67 * depth, 149 - 49 * depth];
    }
    // Tundra is cold vegetation/bare ground; permanent snow retains its old mask.
    const snow = Math.max(
      s.weights.snow,
      smooth((0.26 - s.biome.temperature) / 0.14),
    );
    const tundra = s.biome.weights.tundra_snow * (1 - snow) * 0.66;
    r += (137 - 193) * tundra;
    g += (149 - 205) * tundra;
    b += (127 - 194) * tundra;
    const exposure = s.weights.rock * (1 - s.weights.snow);
    r += exposure * 5;
    g += exposure * 7;
    b += exposure * 11;
    const moisture = s.moisture - 0.5;
    r -= moisture * 6;
    g += moisture * 5;
    b += moisture * 3;
    const shore = (1 - smooth((s.elevation - 0.32) / 0.009)) * 0.65;
    const warm = smooth((s.biome.temperature - 0.25) / 0.3);
    return [
      r * (1 - shore) + (120 + 51 * warm) * shore,
      g * (1 - shore) + (131 + 29 * warm) * shore,
      b * (1 - shore) + (121 - 8 * warm) * shore,
    ];
  }
  // No half-territory offset in raster/vector coordinates. strategic(i,j)
  // remains the public territory-center query for inspectors and game logic.
  function sampleWorld(gx, gy) {
    return terrain.sample(gx * terrain.SIZE, gy * terrain.SIZE);
  }
  async function grid(
    width,
    height,
    x0,
    z0,
    step,
    sampler,
    alive,
    colorAt = null,
  ) {
    const stride = width + 2,
      heights = new Float64Array(stride * (height + 2)),
      samples = colorAt ? null : new Array(width * height),
      colors = colorAt ? new Float64Array(width * height * 3) : null,
      water = new Uint8Array(width * height);
    let start = performance.now();
    for (let y = -1; y <= height; y++) {
      if (!alive()) return null;
      if (performance.now() - start >= 3) {
        await new Promise((r) => setTimeout(r, 0));
        start = performance.now();
        if (!alive()) return null;
      }
      for (let x = -1; x <= width; x++) {
        const wx = x0 + x * step,
          wz = z0 + y * step;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const s = sampler(wx, wz);
          const index = y * width + x;
          water[index] = s.water ? 1 : 0;
          if (colors) {
            const c = colorAt(s, wx, wz);
            colors[index * 3] = c[0];
            colors[index * 3 + 1] = c[1];
            colors[index * 3 + 2] = c[2];
          } else samples[index] = s;
          heights[(y + 1) * stride + x + 1] = s.elevation;
        } else heights[(y + 1) * stride + x + 1] = terrain.elevationAt(wx, wz);
      }
    }
    return {
      width,
      height,
      stride,
      heights,
      samples,
      colors,
      water,
      x0,
      z0,
      step,
    };
  }
  async function paint(grid, colorAt, alive) {
    const {
      width,
      height,
      stride,
      heights,
      samples,
      colors,
      water,
      x0,
      z0,
      step,
    } = grid;
    const data = new Uint8ClampedArray(width * height * 4);
    let start = performance.now();
    for (let y = 0; y < height; y++) {
      if (!alive()) return null;
      if (performance.now() - start >= 3) {
        await new Promise((r) => setTimeout(r, 0));
        start = performance.now();
        if (!alive()) return null;
      }
      for (let x = 0; x < width; x++) {
        const index = y * width + x,
          c = colors
            ? null
            : colorAt(samples[index], x0 + x * step, z0 + y * step),
          i = (y + 1) * stride + x + 1;
        const light = water[index]
          ? 0
          : shade(
              heights[i - 1],
              heights[i + 1],
              heights[i - stride],
              heights[i + stride],
              heights[i],
              step,
            ) * 255;
        const out = (y * width + x) * 4;
        data[out] = (colors ? colors[index * 3] : c[0]) + light;
        data[out + 1] = (colors ? colors[index * 3 + 1] : c[1]) + light;
        data[out + 2] = (colors ? colors[index * 3 + 2] : c[2]) + light;
        data[out + 3] = 255;
      }
    }
    return data;
  }
  window.mapGameEnvironment = Object.freeze({
    VERSION: "0.3.3C",
    shade,
    color,
    sampleWorld,
    grid,
    paint,
  });
})();
