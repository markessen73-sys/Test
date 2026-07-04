import sharp from "sharp";
import { writeFile } from "node:fs/promises";

function isConePixel(r, g, b) {
  return r > 170 && g > 70 && g < 210 && b < 90;
}

function isBrickWallPixel(r, g, b) {
  return r > 110 && r > g * 1.25 && b < 90 && g < 110;
}

function isMortarPixel(r, g, b) {
  return (
    r >= 75 &&
    r <= 125 &&
    g >= 68 &&
    g <= 118 &&
    b >= 68 &&
    b <= 118 &&
    Math.max(r, g, b) - Math.min(r, g, b) < 32
  );
}

function isWallPixel(r, g, b) {
  return isBrickWallPixel(r, g, b) || isMortarPixel(r, g, b);
}

export async function buildLevel2Data(imagePath) {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const solid = new Uint8Array(width * height);
  const coneMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const pi = y * width + x;
      if (isConePixel(r, g, b)) {
        coneMask[pi] = 1;
      } else if (isWallPixel(r, g, b)) {
        solid[pi] = 1;
      }
    }
  }

  // Nudge wall edges outward slightly so the car cannot clip brick corners.
  const dilated = solid.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pi = y * width + x;
      if (!solid[pi]) continue;
      dilated[(y - 1) * width + x] = 1;
      dilated[(y + 1) * width + x] = 1;
      dilated[y * width + (x - 1)] = 1;
      dilated[y * width + (x + 1)] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const cones = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!coneMask[start] || visited[start]) continue;
      const queue = [[x, y]];
      visited[start] = 1;
      let sx = 0;
      let sy = 0;
      let n = 0;
      while (queue.length) {
        const [cx, cy] = queue.pop();
        sx += cx;
        sy += cy;
        n++;
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
          if (!coneMask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push([nx, ny]);
        }
      }
      if (n > 20) cones.push({ x: Math.round(sx / n), y: Math.round(sy / n) });
    }
  }

  let spawn = null;
  let spawnCone = null;
  const midX = Math.floor(width / 2);
  const bottomHalfY = height * 0.5;
  const targetY = height * 0.82;
  const SPAWN_HW = 24;
  const SPAWN_HH = 14;

  function carFitsAt(map, x, y) {
    for (let py = Math.floor(y - SPAWN_HH); py <= Math.ceil(y + SPAWN_HH); py++) {
      for (let px = Math.floor(x - SPAWN_HW); px <= Math.ceil(x + SPAWN_HW); px++) {
        if (px < 0 || py < 0 || px >= width || py >= height) return false;
        if (map[py * width + px]) return false;
      }
    }
    return true;
  }

  const anchorCone =
    cones
      .filter((c) => c.y >= bottomHalfY)
      .sort(
        (a, b) =>
          Math.abs(a.x - midX) - Math.abs(b.x - midX) ||
          Math.abs(a.y - targetY) - Math.abs(b.y - targetY),
      )[0] ?? null;

  if (anchorCone) {
    spawnCone = { x: anchorCone.x, y: anchorCone.y };
    if (carFitsAt(dilated, anchorCone.x, anchorCone.y)) {
      spawn = { x: anchorCone.x, y: anchorCone.y };
    } else {
      for (let dy = 0; dy <= 96; dy++) {
        const tryY = anchorCone.y - dy;
        if (tryY < bottomHalfY) break;
        if (carFitsAt(dilated, anchorCone.x, tryY)) {
          spawn = { x: anchorCone.x, y: tryY };
          break;
        }
      }
      if (!spawn) {
        for (let dy = 1; dy <= 48; dy++) {
          const tryY = anchorCone.y + dy;
          if (tryY >= height - SPAWN_HH - 2) break;
          if (carFitsAt(dilated, anchorCone.x, tryY)) {
            spawn = { x: anchorCone.x, y: tryY };
            break;
          }
        }
      }
    }
  }

  if (!spawn) {
    for (let y = Math.floor(height * 0.55); y < height - SPAWN_HH - 4; y += 2) {
      for (let x = midX - 120; x < midX + 120; x += 2) {
        if (!carFitsAt(dilated, x, y)) continue;
        const score = Math.hypot(x - midX, y - targetY);
        if (!spawn || score < spawn.score) spawn = { x, y, score };
      }
    }
    if (spawn) delete spawn.score;
  }

  if (!spawn) spawn = { x: midX, y: Math.floor(height * 0.72) };

  return {
    width,
    height,
    solid: dilated,
    cones,
    spawn,
    spawnCone,
    coneCount: cones.length,
    solidPct: ((dilated.reduce((a, b) => a + b, 0) / (width * height)) * 100).toFixed(1),
  };
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
