import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT_DIR = "/workspace/demo/assets";
const SKY_MAX = 12;

async function build() {
  await access(SRC, constants.R_OK);
  await mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const lum = new Float32Array(width * height);
  const solid = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    lum[i] = data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
  }

  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return lum[y * width + x];
  };

  for (let x = 0; x < width; x++) {
    let startY = -1;

    for (let y = 2; y < height - 1; y++) {
      const l = at(x, y);
      const above = at(x, y - 1);
      const below = at(x, y + 1);
      if (l >= 80 && above >= 75 && below < l - 40) {
        startY = y;
        break;
      }
    }

    if (startY < 0) {
      for (let y = 1; y < height; y++) {
        if (at(x, y) >= 95 && at(x, y - 1) < 35) {
          startY = y;
          break;
        }
      }
    }

    if (startY < 0) {
      for (let y = 0; y < height; y++) {
        if (at(x, y) < 65) continue;
        let sum = 0;
        const end = Math.min(y + 20, height);
        let n = 0;
        for (let yy = y; yy < end; yy++) {
          sum += at(x, yy);
          n++;
        }
        if (n >= 10 && sum / n >= 60) {
          startY = y;
          break;
        }
      }
    }

    if (startY < 0) continue;

    for (let y = startY; y < height; y++) {
      if (at(x, y) < SKY_MAX) break;
      solid[y * width + x] = 1;
    }
  }

  addMiddleCenterPlatform(solid, at, width, height);

  const collision = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (solid[i]) {
      const p = i * 4;
      collision[p] = 255;
      collision[p + 1] = 255;
      collision[p + 2] = 255;
      collision[p + 3] = 255;
    }
  }

  await sharp(collision, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT_DIR}/arena-collision.png`);

  console.log(`Built collision map ${width}x${height}`);
}

function addMiddleCenterPlatform(solid, at, width, height) {
  const X0 = 680;
  const X1 = 860;
  const Y0 = 635;
  const Y1 = 675;
  const GAP_RUN = 4;

  let bestY = -1;
  let bestCount = 0;
  for (let y = Y0; y <= Y1; y++) {
    let count = 0;
    for (let x = X0; x <= X1; x++) {
      if (at(x, y) >= 50 && at(x, y - 1) < 28) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestY = y;
    }
  }
  if (bestY < 0 || bestCount < 15) return;

  for (let x = X0; x <= X1; x++) {
    let startY = -1;
    for (let y = bestY - 10; y <= bestY + 6; y++) {
      if (at(x, y) >= 45 && at(x, y - 1) < 30) {
        startY = y;
        break;
      }
    }
    if (startY < 0) continue;

    let gap = 0;
    for (let y = startY; y < height; y++) {
      if (at(x, y) < SKY_MAX) {
        gap++;
        if (gap >= GAP_RUN) break;
      } else {
        gap = 0;
      }
      solid[y * width + x] = 1;
    }
  }
}

build().catch(console.error);
