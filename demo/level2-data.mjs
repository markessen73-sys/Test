import sharp from "sharp";
import { writeFile } from "node:fs/promises";

export const LEVEL2_WALL_CLEARANCE = 2;
export const LEVEL2_WALKABLE_MAX = 24;
export const LEVEL2_FRAME_COMPONENT_MAX = 5000;

export function isWalkablePixel(r, g, b, a = 255) {
  if (a <= 24) return true;
  return r <= LEVEL2_WALKABLE_MAX && g <= LEVEL2_WALKABLE_MAX && b <= LEVEL2_WALKABLE_MAX;
}

export function isBrickPixel(r, g, b, a = 255) {
  if (isWalkablePixel(r, g, b, a)) return false;
  return r > 80 && r > g * 1.3 && r > b * 1.3 && g < 120 && b < 120;
}

export function isSolidPixel(r, g, b, a = 255) {
  return !isWalkablePixel(r, g, b, a);
}

export function removeLandmarkFrameBricks(data, width, height, channels, frameMax = LEVEL2_FRAME_COMPONENT_MAX) {
  const brick = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels > 3 ? data[i + 3] : 255;
      if (isBrickPixel(r, g, b, a)) brick[y * width + x] = 1;
    }
  }

  const comp = new Int32Array(width * height).fill(-1);
  const sizes = new Map();
  let compId = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!brick[idx] || comp[idx] >= 0) continue;
      let size = 0;
      const q = [[x, y]];
      comp[idx] = compId;
      while (q.length) {
        const [cx, cy] = q.pop();
        size++;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (brick[ni] && comp[ni] < 0) {
            comp[ni] = compId;
            q.push([nx, ny]);
          }
        }
      }
      sizes.set(compId, size);
      compId++;
    }
  }

  const out = Buffer.from(data);
  let removed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!brick[idx]) continue;
      if (sizes.get(comp[idx]) >= frameMax) continue;
      const o = idx * channels;
      out[o] = 0;
      out[o + 1] = 0;
      out[o + 2] = 0;
      if (channels > 3) out[o + 3] = 255;
      removed++;
    }
  }

  return { data: out, removed, frameComponents: [...sizes.values()].filter((s) => s < frameMax).length };
}

export function erodeSolid(solid, width, height, passes = 1) {
  let map = solid;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Uint8Array(map);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!map[i]) continue;
        let keep = true;
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !map[ny * width + nx]) {
            keep = false;
            break;
          }
        }
        if (!keep) next[i] = 0;
      }
    }
    map = next;
  }
  return map;
}

export async function buildLevel2Data(imagePath) {
  const { data: rawData, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const { data, removed: framesRemoved } = removeLandmarkFrameBricks(rawData, width, height, channels);
  const solid = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels > 3 ? data[i + 3] : 255;
      if (isSolidPixel(r, g, b, a)) solid[y * width + x] = 1;
    }
  }

  const cones = [];
  let spawn = null;
  const midX = Math.floor(width / 2);
  const targetY = height * 0.82;
  const SPAWN_HW = 20;
  const SPAWN_HH = 58;
  const MIN_VERT_CLEARANCE = 100;
  const MIN_HORIZ_CLEARANCE = 72;

  function carFitsAt(map, x, y) {
    for (let py = Math.floor(y - SPAWN_HH); py <= Math.ceil(y + SPAWN_HH); py++) {
      for (let px = Math.floor(x - SPAWN_HW); px <= Math.ceil(x + SPAWN_HW); px++) {
        if (px < 0 || py < 0 || px >= width || py >= height) return false;
        if (map[py * width + px]) return false;
      }
    }
    return true;
  }

  function horizontalClearance(map, x, y) {
    let left = x;
    let right = x;
    while (left > 0 && carFitsAt(map, left - 1, y)) left--;
    while (right < width - 1 && carFitsAt(map, right + 1, y)) right++;
    return right - left + 1;
  }

  function verticalClearance(map, x, y) {
    let top = y;
    let bottom = y;
    while (top > 0 && carFitsAt(map, x, top - 1)) top--;
    while (bottom < height - 1 && carFitsAt(map, x, bottom + 1)) bottom++;
    return bottom - top + 1;
  }

  function spawnScore(x, y, vClear, hClear) {
    return Math.abs(x - midX) * 0.35 + Math.abs(y - targetY) * 0.25 - vClear * 0.55 - hClear * 0.08;
  }

  for (let y = Math.floor(height * 0.45); y < height - SPAWN_HH - 4; y += 2) {
    for (let x = 40; x < width - 40; x += 2) {
      if (!carFitsAt(solid, x, y)) continue;
      const vClear = verticalClearance(solid, x, y);
      const hClear = horizontalClearance(solid, x, y);
      if (vClear < MIN_VERT_CLEARANCE || hClear < MIN_HORIZ_CLEARANCE) continue;
      const score = spawnScore(x, y, vClear, hClear);
      if (!spawn || score < spawn.score) spawn = { x, y, score };
    }
  }

  if (!spawn) spawn = { x: midX, y: Math.floor(height * 0.76) };
  else if (spawn.score !== undefined) delete spawn.score;

  return {
    width,
    height,
    channels,
    imageData: data,
    framesRemoved,
    solid,
    cones,
    spawn,
    spawnCone: spawn,
    coneCount: cones.length,
    solidPct: ((solid.reduce((a, b) => a + b, 0) / (width * height)) * 100).toFixed(1),
  };
}

export async function writeProcessedLevel2Background(imagePath, data) {
  await sharp(data.imageData, { raw: { width: data.width, height: data.height, channels: data.channels } })
    .png()
    .toFile(imagePath);
}

export function encodeSolidRle(solid) {
  const chunks = [];
  let i = 0;
  while (i < solid.length) {
    const v = solid[i];
    let n = 1;
    while (i + n < solid.length && solid[i + n] === v && n < 65535) n++;
    chunks.push(v, n & 0xff, (n >> 8) & 0xff);
    i += n;
  }
  return Buffer.from(chunks).toString("base64");
}

export function shrinkPixels(pixels, insetX, insetY) {
  if (!pixels.length || (insetX <= 0 && insetY <= 0)) return pixels;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [dx, dy] of pixels) {
    minX = Math.min(minX, dx);
    maxX = Math.max(maxX, dx);
    minY = Math.min(minY, dy);
    maxY = Math.max(maxY, dy);
  }
  return pixels.filter(
    ([dx, dy]) =>
      dx > minX + insetX && dx < maxX - insetX && dy > minY + insetY && dy < maxY - insetY,
  );
}

export async function buildBusPixels(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx = width / 2;
  const cy = height / 2;
  const full = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = channels > 3 ? data[i + 3] : 255;
      if (a > 32) full.push([Math.round(x - cx), Math.round(y - cy)]);
    }
  }
  const move = shrinkPixels(full, LEVEL2_WALL_CLEARANCE, LEVEL2_WALL_CLEARANCE);
  return { full, move: move.length ? move : full };
}

export async function writeLevel2Assets(data, assetsDir) {
  await writeFile(`${assetsDir}/level2-solid.bin`, data.solid);
  return {
    width: data.width,
    height: data.height,
    spawn: data.spawn,
    spawnCone: data.spawnCone ?? data.spawn,
    cones: data.cones,
  };
}
