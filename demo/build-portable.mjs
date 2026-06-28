import sharp from "sharp";
import { readFileSync, copyFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSolidMask, buildDebugCompositeRgba, solidToSegments } from "./solid-mask.mjs";

const SRC = "/workspace/demo/assets/arena-source.png";
const BACKDROP = "/workspace/demo/assets/arena-backdrop.jpg";
const OUT = "/workspace/docs";
const ASSETS = `${OUT}/assets`;

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

  copyFileSync(SRC, `${ASSETS}/arena-foreground.png`);
  copyFileSync("/workspace/demo/manifest.webmanifest", `${OUT}/manifest.webmanifest`);

  const iconSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111"/><rect x="96" y="176" width="320" height="128" rx="18" fill="#6eb8e4"/><rect x="128" y="208" width="72" height="40" rx="6" fill="#243848"/><circle cx="160" cy="336" r="44" fill="#111"/><circle cx="352" cy="336" r="44" fill="#111"/></svg>`,
  );
  await sharp(iconSvg).resize(192, 192).png().toFile(`${ASSETS}/icon-192.png`);
  await sharp(iconSvg).resize(512, 512).png().toFile(`${ASSETS}/icon-512.png`);

  const debugComposite = buildDebugCompositeRgba(data, width, height, channels);
  await sharp(debugComposite, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-debug.png`);

  await sharp(collision, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-collision.png`);

  const segments = solidToSegments(solid, width, height);
  await writeFile(`${ASSETS}/arena-solid.bin`, solid);

  const titleFontSize = Math.round(width * 0.105);
  const titleY = Math.round(height * 0.17);
  const titleSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="lvGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff8e8" stop-opacity="0.68"/>
          <stop offset="55%" stop-color="#ffd6a0" stop-opacity="0.36"/>
          <stop offset="100%" stop-color="#c88850" stop-opacity="0.1"/>
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <text x="50%" y="${titleY}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${titleFontSize}" font-weight="700"
        letter-spacing="${Math.round(width * 0.006)}" fill="url(#lvGrad)" filter="url(#soft)" opacity="0.82">Las Vegas</text>
    </svg>`,
  );

  const backdropJpegFull = await sharp(BACKDROP)
    .resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: titleSvg, top: 0, left: 0 }])
    .jpeg({ quality: 84 })
    .toBuffer();

  await writeFile(`${ASSETS}/arena-backdrop.jpg`, backdropJpegFull);
  await writeFile("/workspace/demo/assets/arena-backdrop.jpg", backdropJpegFull);

  const backdropDataUrl = `data:image/jpeg;base64,${backdropJpegFull.toString("base64")}`;

  const foregroundPng = await sharp(SRC).png({ compressionLevel: 9 }).toBuffer();
  const bgDataUrl = `data:image/png;base64,${foregroundPng.toString("base64")}`;

  let html = readFileSync("/workspace/demo/cloud-background.html", "utf8");

  function embedPortable(source, bakedMode) {
    const copies = {
      drop: {
        title: "Ford Capri Arena",
        desc:
          "Tap ← / lift / → to drive your Capri. A Zoox robotaxi patrols left→right from the middle-left deck, weaving around the rocks.",
        btnDrop: "active",
        btnWrapRight: "",
        btnWrapLeft: "",
        badgeClass: "",
        badgeText: "DROP ↓",
      },
      "wrap-right": {
        title: "Wrap test — exits right, re-enters left",
        desc: "Single red ball at the top moves right. When it leaves the right edge it wraps to the left.",
        btnDrop: "",
        btnWrapRight: "active-wrap",
        btnWrapLeft: "",
        badgeClass: "",
        badgeText: "WRAP →",
      },
      "wrap-left": {
        title: "Wrap test — exits left, re-enters right",
        desc: "Single red ball at the top moves left. When it leaves the left edge it wraps to the right.",
        btnDrop: "",
        btnWrapRight: "",
        btnWrapLeft: "active-wrap",
        badgeClass: "",
        badgeText: "WRAP ←",
      },
    };
    const copy = copies[bakedMode];

    return source
      .replace("__SOLID_SEGMENTS__", JSON.stringify(segments))
      .replace("__BG_DATA_URL__", bgDataUrl)
      .replace("__BACKDROP_DATA_URL__", backdropDataUrl)
      .replace("__BAKED_MODE__", bakedMode)
      .replace("__TITLE_TEXT__", copy.title)
      .replace("__DESC_TEXT__", copy.desc)
      .replace("__BTN_DROP_CLASS__", copy.btnDrop)
      .replace("__BTN_WRAP_RIGHT_CLASS__", copy.btnWrapRight)
      .replace("__BTN_WRAP_LEFT_CLASS__", copy.btnWrapLeft)
      .replace("__BADGE_CLASS__", copy.badgeClass)
      .replace("__BADGE_TEXT__", copy.badgeText);
  }

  await writeFile(`${OUT}/index.html`, embedPortable(html, "drop"));
  await writeFile(`${OUT}/wrap-right.html`, embedPortable(html, "wrap-right"));
  await writeFile(`${OUT}/wrap-left.html`, embedPortable(html, "wrap-left"));
  await writeFile(`${OUT}/.nojekyll`, "");
  console.log(
    `Portable build: ${width}x${height}, solid ${solidCount} px (${((100 * solidCount) / (width * height)).toFixed(1)}%)`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
