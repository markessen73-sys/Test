import sharp from "sharp";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT = "/workspace/docs";
const ASSETS = `${OUT}/assets`;
const ROCK_MIN = 33;
const ROCK_MAX = 108;

function buildSolidMask(data, width, height, channels) {
  const lum = new Float32Array(width * height);
  const solid = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    lum[i] = data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
  }

  const isRock = (l) => l >= ROCK_MIN && l <= ROCK_MAX;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isRock(lum[i])) solid[i] = 1;
    }
  }

  // Bright inlays / metal strips sitting on rock — not atmospheric haze above platforms.
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (solid[i] || lum[i] <= ROCK_MAX) continue;
      if (isRock(lum[(y + 1) * width + x])) solid[i] = 1;
    }
  }

  return solid;
}

async function build() {
  await mkdir(ASSETS, { recursive: true });

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const solid = buildSolidMask(data, width, height, channels);

  let solidCount = 0;
  const collision = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (solid[i]) {
      solidCount++;
      const p = i * 4;
      collision[p] = 255;
      collision[p + 1] = 255;
      collision[p + 2] = 255;
      collision[p + 3] = 255;
    }
  }

  await sharp(SRC)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${ASSETS}/arena-bg.jpg`);

  await sharp(collision, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-collision.png`);

  const segments = [];
  for (let y = 0; y < height; y++) {
    let start = null;
    for (let x = 0; x < width; x++) {
      if (solid[y * width + x]) {
        if (start === null) start = x;
      } else if (start !== null) {
        segments.push([y, start, x - 1]);
        start = null;
      }
    }
    if (start !== null) segments.push([y, start, width - 1]);
  }

  await writeFile(`${ASSETS}/arena-solid.bin`, solid);

  let html = readFileSync("/workspace/demo/cloud-background.html", "utf8");
  html = html.replace("__SOLID_SEGMENTS__", JSON.stringify(segments));
  await writeFile(`${OUT}/index.html`, html);
  console.log(`Portable build: ${width}x${height}, solid ${solidCount} px (${(100 * solidCount / (width * height)).toFixed(1)}%)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
