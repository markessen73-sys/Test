import sharp from "sharp";
import { writeFile } from "node:fs/promises";

export const LEVEL2_WALKABLE_MAX = 24;

export function isWalkablePixel(r, g, b, a = 255) {
  if (a <= 24) return true;
  return r <= LEVEL2_WALKABLE_MAX && g <= LEVEL2_WALKABLE_MAX && b <= LEVEL2_WALKABLE_MAX;
}

export function isSolidPixel(r, g, b, a = 255) {
  return !isWalkablePixel(r, g, b, a);
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
      const a = channels > 3 ? data[i + 3] : 255;
      if (isSolidPixel(r, g, b, a)) solid[y * width + x] = 1;
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

export function buildLevel2Track(solid, width, height, spawn, hw = 10, hh = 29, step = 12) {
  function fits(cx, cy) {
    for (let py = Math.floor(cy - hh); py <= Math.ceil(cy + hh); py++) {
      for (let px = Math.floor(cx - hw); px <= Math.ceil(cx + hw); px++) {
        if (px < 0 || py < 0 || px >= width || py >= height) return false;
        if (solid[py * width + px]) return false;
      }
    }
    return true;
  }

  const cols = Math.ceil(width / step);
  const grid = new Int32Array(cols * Math.ceil(height / step)).fill(-1);
  const nodes = [];

  function gridIndex(x, y) {
    return Math.floor(y / step) * cols + Math.floor(x / step);
  }

  for (let y = hh; y < height - hh; y += step) {
    for (let x = hw; x < width - hw; x += step) {
      if (!fits(x, y)) continue;
      const gi = gridIndex(x, y);
      grid[gi] = nodes.length;
      nodes.push({ x, y, gi, neighbors: [] });
    }
  }

  const dirs = [
    [step, 0],
    [-step, 0],
    [0, step],
    [0, -step],
  ];

  for (const node of nodes) {
    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      const gi = gridIndex(nx, ny);
      if (gi < 0 || gi >= grid.length) continue;
      const ni = grid[gi];
      if (ni < 0) continue;
      const other = nodes[ni];
      if (!other || other === node) continue;
      node.neighbors.push(other);
    }
  }

  let start = nodes[0] ?? null;
  let bestDist = Infinity;
  for (const node of nodes) {
    const d = Math.hypot(node.x - spawn.x, node.y - spawn.y);
    if (d < bestDist) {
      bestDist = d;
      start = node;
    }
  }
  if (!start) return [];

  const visitedEdge = new Set();
  const track = [{ x: start.x, y: start.y }];
  const stack = [start];

  function edgeKey(a, b) {
    return a.gi < b.gi ? `${a.gi}:${b.gi}` : `${b.gi}:${a.gi}`;
  }

  while (stack.length) {
    const node = stack[stack.length - 1];
    let next = null;
    for (const neighbor of node.neighbors) {
      const key = edgeKey(node, neighbor);
      if (visitedEdge.has(key)) continue;
      next = neighbor;
      visitedEdge.add(key);
      break;
    }
    if (!next) {
      stack.pop();
      if (stack.length) {
        const prev = stack[stack.length - 1];
        track.push({ x: prev.x, y: prev.y });
      }
      continue;
    }
    track.push({ x: next.x, y: next.y });
    stack.push(next);
  }

  return simplifyTrack(track, 5);
}

function simplifyTrack(points, minDist) {
  if (points.length < 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p);
  }
  const tail = points[points.length - 1];
  const end = out[out.length - 1];
  if (tail.x !== end.x || tail.y !== end.y) out.push(tail);
  return out;
}

export function encodeTrack(points) {
  if (!points.length) return "";
  const chunks = [points[0].x, points[0].y];
  let px = points[0].x;
  let py = points[0].y;
  for (let i = 1; i < points.length; i++) {
    chunks.push(points[i].x - px, points[i].y - py);
    px = points[i].x;
    py = points[i].y;
  }
  return Buffer.from(new Int16Array(chunks).buffer).toString("base64");
}

export function decodeTrack(b64) {
  if (!b64) return [];
  const view = new Int16Array(Buffer.from(b64, "base64").buffer);
  if (!view.length) return [];
  const out = [{ x: view[0], y: view[1] }];
  let x = view[0];
  let y = view[1];
  for (let i = 2; i < view.length; i += 2) {
    x += view[i];
    y += view[i + 1];
    out.push({ x, y });
  }
  return out;
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
