import sharp from "sharp";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT = "/workspace/docs";
const ASSETS = `${OUT}/assets`;
const SKY_MAX = 12;

function buildSolidMask(data, width, height, channels) {
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

    // Side-view deck cap: last bright row before a sharp drop into shadow/gap.
    for (let y = 2; y < height - 1; y++) {
      const l = at(x, y);
      const above = at(x, y - 1);
      const below = at(x, y + 1);
      if (l >= 80 && above >= 75 && below < l - 40) {
        startY = y;
        break;
      }
    }

    // Sharp top edge against open sky.
    if (startY < 0) {
      for (let y = 1; y < height; y++) {
        if (at(x, y) >= 95 && at(x, y - 1) < 35) {
          startY = y;
          break;
        }
      }
    }

    // Plain rock tops without a bright cap.
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

  return solid;
}

function findPlatformSpawns(solid, width, height) {
  const caps = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (solid[y * width + x]) {
        caps.push({ x, capY: y });
        break;
      }
    }
  }

  const groups = [];
  const Y_TOL = 30;
  const MIN_SPAN = 45;

  for (const cap of caps) {
    let group = groups.find(
      (g) =>
        Math.abs(g.capY - cap.capY) <= Y_TOL &&
        cap.x >= g.x0 - 20 &&
        cap.x <= g.x1 + 20,
    );
    if (group) {
      group.x0 = Math.min(group.x0, cap.x);
      group.x1 = Math.max(group.x1, cap.x);
      group.capY = Math.round((group.capY + cap.capY) / 2);
    } else {
      groups.push({ x0: cap.x, x1: cap.x, capY: cap.capY });
    }
  }

  return groups
    .filter((g) => g.x1 - g.x0 >= MIN_SPAN)
    .map((g) => ({ x: Math.round((g.x0 + g.x1) / 2), capY: g.capY }))
    .sort((a, b) => a.capY - b.capY || a.x - b.x);
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

  const platformSpawns = findPlatformSpawns(solid, width, height);

  let html = readFileSync("/workspace/demo/cloud-background.html", "utf8");
  const jpeg = readFileSync(`${ASSETS}/arena-bg.jpg`);
  const bgDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  html = html.replace("__SOLID_SEGMENTS__", JSON.stringify(segments));
  html = html.replace("__PLATFORM_SPAWNS__", JSON.stringify(platformSpawns));
  html = html.replace("__BG_DATA_URL__", bgDataUrl);
  await writeFile(`${OUT}/index.html`, html);
  await writeFile(`${OUT}/.nojekyll`, "");
  console.log(
    `Portable build: ${width}x${height}, solid ${solidCount} px (${(100 * solidCount / (width * height)).toFixed(1)}%), ${platformSpawns.length} platforms`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
