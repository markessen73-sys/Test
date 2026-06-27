import sharp from "sharp";
import { readFileSync, copyFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSolidMask, buildDebugCompositeRgba, solidToSegments } from "./solid-mask.mjs";

const SRC = "/workspace/demo/assets/arena-source.png";
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

  const debugComposite = buildDebugCompositeRgba(data, width, height, channels);
  await sharp(debugComposite, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-debug.png`);

  await sharp(collision, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`${ASSETS}/arena-collision.png`);

  const segments = solidToSegments(solid, width, height);
  await writeFile(`${ASSETS}/arena-solid.bin`, solid);

  const foregroundPng = await sharp(SRC).png({ compressionLevel: 9 }).toBuffer();
  const bgDataUrl = `data:image/png;base64,${foregroundPng.toString("base64")}`;

  let html = readFileSync("/workspace/demo/cloud-background.html", "utf8");

  function embedPortable(source, bakedMode) {
    const copies = {
      drop: {
        title: "Gravity test — vertical drop in 3 seconds",
        desc:
          "Tap ← / lift / → for velocity kicks. Platforms are frictionless sideways; landings bounce half a ball height.",
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
