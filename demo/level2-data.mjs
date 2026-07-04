import sharp from "sharp";
import { writeFile } from "node:fs/promises";

function isConePixel(r, g, b) {
  if (r > 170 && g > 70 && g < 210 && b < 90) return true;
  if (r > 205 && g > 205 && b > 190 && Math.max(r, g, b) - Math.min(r, g, b) < 35) return true;
  return false;
}

function isBrickWallPixel(r, g, b) {
  return r > 130 && r > g * 1.35 && b < 80 && g < 100;
}

function isWallPixel(r, g, b) {
  return isBrickWallPixel(r, g, b);
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
      }
    }
  }

  const expandedConeMask = coneMask.slice();
  for (let pass = 0; pass < 3; pass++) {
    const next = expandedConeMask.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pi = y * width + x;
        if (!expandedConeMask[pi]) continue;
        for (const ni of [pi - 1, pi + 1, pi - width, pi + width]) {
          next[ni] = 1;
        }
      }
    }
    expandedConeMask.set(next);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const pi = y * width + x;
      if (expandedConeMask[pi]) continue;
      if (isWallPixel(r, g, b)) {
        solid[pi] = 1;
      }
    }
  }

  // Trim one pixel from exposed brick edges so channels match playable clearance.
  const eroded = solid.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pi = y * width + x;
      if (!solid[pi]) continue;
      if (
        !solid[pi - 1] ||
        !solid[pi + 1] ||
        !solid[pi - width] ||
        !solid[pi + width]
      ) {
        eroded[pi] = 0;
      }
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
  const SPAWN_HW = 15;
  const SPAWN_HH = 29;

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
    let best = null;
    for (let dy = 0; dy <= 120; dy++) {
      for (let dx = 0; dx <= 96; dx++) {
        const xs = dx === 0 ? [0] : [-dx, dx];
        for (const sx of xs) {
          const tryX = anchorCone.x + sx;
          const tryY = anchorCone.y - dy;
          if (tryY < bottomHalfY || tryY > anchorCone.y - 24) continue;
          if (!carFitsAt(eroded, tryX, tryY)) continue;
          const clearance = horizontalClearance(eroded, tryX, tryY);
          const score = dy * 2 + Math.abs(sx) + Math.abs(tryX - midX) * 0.1 - clearance * 0.35;
          if (!best || score < best.score) best = { x: tryX, y: tryY, score };
        }
      }
      if (best && best.score <= dy * 2) break;
    }
    if (best) {
      spawn = { x: best.x, y: best.y };
    }
  }

  if (!spawn) {
    for (let y = Math.floor(height * 0.55); y < height - SPAWN_HH - 4; y += 2) {
      for (let x = midX - 160; x < midX + 160; x += 2) {
        if (!carFitsAt(eroded, x, y)) continue;
        const score = Math.hypot(x - midX, y - targetY);
        if (!spawn || score < spawn.score) spawn = { x, y, score };
      }
    }
    if (spawn) delete spawn.score;
  }

  if (!spawn) spawn = { x: midX, y: Math.floor(height * 0.76) };

  return {
    width,
    height,
    solid: eroded,
    cones,
    spawn,
    spawnCone,
    coneCount: cones.length,
    solidPct: ((eroded.reduce((a, b) => a + b, 0) / (width * height)) * 100).toFixed(1),
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
