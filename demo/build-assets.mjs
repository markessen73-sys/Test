import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT_DIR = "/workspace/demo/assets";
const BLACK_THRESHOLD = 14;

async function build() {
  await access(SRC, constants.R_OK);
  await mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rocks = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const px = i * channels;
    const r = rocks[px];
    const g = rocks[px + 1];
    const b = rocks[px + 2];
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
    rocks[px + 3] = lum < BLACK_THRESHOLD ? 0 : 255;
  }

  await sharp(rocks, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true, colors: 256 })
    .toFile(`${OUT_DIR}/arena-rocks.png`);

  const meta = await sharp(`${OUT_DIR}/arena-rocks.png`).metadata();
  console.log(`Built ${width}x${height} rocks layer (${meta.size ?? "?"} bytes)`);
}

build().catch((err) => {
  if (err.code === "ENOENT") {
    console.error("Missing demo/assets/arena-source.png — add your foreground image there first.");
  } else {
    console.error(err);
  }
  process.exit(1);
});
