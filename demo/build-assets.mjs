import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT_DIR = "/workspace/demo/assets";
const DENSE_MIN = 52;
const ROCK_MAX = 108;
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

  for (let x = 0; x < width; x++) {
    let inMass = false;
    for (let y = 0; y < height; y++) {
      const i = y * width + x;
      const l = lum[i];
      if (!inMass && l >= DENSE_MIN && l <= ROCK_MAX) inMass = true;
      if (!inMass) continue;
      if (l < SKY_MAX) {
        inMass = false;
        continue;
      }
      solid[i] = 1;
    }
  }

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (solid[i] || lum[i] <= ROCK_MAX) continue;
      if (solid[(y + 1) * width + x]) solid[i] = 1;
    }
  }

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

build().catch(console.error);
