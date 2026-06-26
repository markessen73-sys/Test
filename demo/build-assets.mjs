import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "/opt/cursor/artifacts/assets/arena-foreground.png";
const OUT_DIR = "/workspace/demo/assets";

async function build() {
  await mkdir(OUT_DIR, { recursive: true });

  const { data, info } = await sharp(SRC)
    .resize(768, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rocks = Buffer.from(data);
  const cloudMask = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const px = i * channels;
    const r = rocks[px];
    const g = rocks[px + 1];
    const b = rocks[px + 2];
    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;

    if (lum < 22) {
      rocks[px + 3] = 0;
      cloudMask[px] = 255;
      cloudMask[px + 1] = 255;
      cloudMask[px + 2] = 255;
      cloudMask[px + 3] = 255;
    } else {
      rocks[px + 3] = 255;
      cloudMask[px] = 0;
      cloudMask[px + 1] = 0;
      cloudMask[px + 2] = 0;
      cloudMask[px + 3] = 0;
    }
  }

  await sharp(rocks, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(`${OUT_DIR}/arena-rocks.png`);

  await sharp(cloudMask, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT_DIR}/arena-cloud-mask.png`);

  const rocksInfo = await sharp(`${OUT_DIR}/arena-rocks.png`).metadata();
  console.log(`Built ${width}x${height} assets. Rocks size: ${rocksInfo.size} bytes`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
