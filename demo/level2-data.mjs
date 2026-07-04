import sharp from "sharp";
import { writeFile } from "node:fs/promises";

export const LEVEL2_WALKABLE_MAX = 24;

export function isWalkablePixel(r, g, b) {
  return r <= LEVEL2_WALKABLE_MAX && g <= LEVEL2_WALKABLE_MAX && b <= LEVEL2_WALKABLE_MAX;
}

export function isSolidPixel(r, g, b) {
  return !isWalkablePixel(r, g, b);
}

export async function buildLevel2Data(imagePath) {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const solid = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isSolidPixel(r, g, b)) solid[y * width + x] = 1;
    }
  }

  const cones = [];
  let spawn = null;
  const midX = Math.floor(width / 2);
  const targetY = height * 0.82;
  const SPAWN_HW = 10;
  const SPAWN_HH = 29;
  const MIN_VERT_CLEARANCE = 100;
  const MIN_HORIZ_CLEARANCE = 36;

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
    solid,
    cones,
    spawn,
    spawnCone: spawn,
    coneCount: cones.length,
    solidPct: ((solid.reduce((a, b) => a + b, 0) / (width * height)) * 100).toFixed(1),
  };
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
