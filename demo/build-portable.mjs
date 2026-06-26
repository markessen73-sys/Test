import sharp from "sharp";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT = "/workspace/docs";
const ASSETS = `${OUT}/assets`;
const SKY_MAX = 16;
const ROCK_MAX = 108;
const SUPPORT_SCAN = 4;

async function buildCollision(data, width, height, channels) {
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const l = lum[i];
      if (l < SKY_MAX) continue;
      if (l <= ROCK_MAX) {
        solid[i] = 1;
        continue;
      }
      for (let dy = 1; dy <= SUPPORT_SCAN; dy++) {
        const below = at(x, y + dy);
        if (below < SKY_MAX) break;
        if (below <= ROCK_MAX) {
          solid[i] = 1;
          break;
        }
      }
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
  return collision;
}

async function build() {
  await mkdir(ASSETS, { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  await sharp(SRC)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${ASSETS}/arena-bg.jpg`);

  const collision = await buildCollision(data, width, height, channels);
  await sharp(collision, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-collision.png`);

  const html = readFileSync("/workspace/demo/cloud-background.html", "utf8")
    .replace("arena-source.png", "arena-bg.jpg")
    .replace("<title>Arena Physics Preview</title>", "<title>Arena Physics Demo</title>");

  await writeFile(`${OUT}/index.html`, html);
  console.log(`Portable build: ${width}x${height} -> docs/`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
