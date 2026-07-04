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

  // Thicken wall edges so the larger car cannot clip through brick corners.
  const dilated = solid.slice();
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const pi = y * width + x;
      if (!solid[pi]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 6) continue;
          dilated[(y + dy) * width + (x + dx)] = 1;
        }
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
  for (let y = height - 20; y > height - 220; y--) {
    for (let x = Math.floor(width * 0.48); x < Math.floor(width * 0.52); x++) {
      if (!dilated[y * width + x]) {
        spawn = { x, y };
        break;
      }
    }
    if (spawn) break;
  }
  if (!spawn) spawn = { x: Math.floor(width / 2), y: height - 40 };

  return {
    width,
    height,
    solid: dilated,
    cones,
    spawn,
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
    cones: data.cones,
  };
}
