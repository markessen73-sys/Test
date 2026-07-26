import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import {
  buildLevel2Data,
  encodeSolidRle,
  erodeSolid,
  isSolidPixel,
  isWalkablePixel,
  LEVEL2_WALL_CLEARANCE,
} from "./level2-data.mjs";

export { encodeSolidRle, isSolidPixel, isWalkablePixel };

function isConePixel(r, g, b, a = 255) {
  if (a <= 24) return false;
  return r >= 200 && g >= 70 && g <= 170 && b <= 70 && r > g + 30;
}

function isLevel3Walkable(r, g, b, a = 255) {
  return isWalkablePixel(r, g, b, a) || isConePixel(r, g, b, a);
}

export function detectCones(data, width, height, channels) {
  const grid = new Map();
  const cell = 24;
  const minPixels = 25;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels > 3 ? data[i + 3] : 255;
      if (!isConePixel(r, g, b, a)) continue;
      const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
      const bucket = grid.get(key) ?? { x: 0, y: 0, n: 0 };
      bucket.x += x;
      bucket.y += y;
      bucket.n += 1;
      grid.set(key, bucket);
    }
  }

  const raw = [...grid.values()]
    .filter((bucket) => bucket.n >= minPixels)
    .map((bucket) => ({
      x: Math.round(bucket.x / bucket.n),
      y: Math.round(bucket.y / bucket.n),
    }));

  const merged = [];
  for (const cone of raw) {
    const existing = merged.find((entry) => Math.hypot(entry.x - cone.x, entry.y - cone.y) < 18);
    if (existing) {
      existing.x = Math.round((existing.x + cone.x) / 2);
      existing.y = Math.round((existing.y + cone.y) / 2);
    } else {
      merged.push({ ...cone });
    }
  }

  merged.sort((a, b) => a.y - b.y || a.x - b.x);
  return merged.map((cone, id) => ({ ...cone, id }));
}

async function buildLevel3Solid(imagePath) {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const solid = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels > 3 ? data[i + 3] : 255;
      if (!isLevel3Walkable(r, g, b, a)) solid[y * width + x] = 1;
    }
  }

  return { data, info, solid: erodeSolid(solid, width, height, LEVEL2_WALL_CLEARANCE) };
}

export async function buildLevel3Data(imagePath) {
  const level = await buildLevel2Data(imagePath);
  const { data, info, solid } = await buildLevel3Solid(imagePath);
  level.solid = solid;
  level.solidPct = ((solid.reduce((a, b) => a + b, 0) / (info.width * info.height)) * 100).toFixed(1);
  level.cones = detectCones(data, info.width, info.height, info.channels);
  level.coneCount = level.cones.length;
  return level;
}

export async function writeLevel3Assets(data, assetsDir) {
  await writeFile(`${assetsDir}/level3-solid.bin`, data.solid);
  return {
    width: data.width,
    height: data.height,
    spawn: data.spawn,
    cones: data.cones.map(({ x, y, id }) => ({ x, y, id })),
  };
}
