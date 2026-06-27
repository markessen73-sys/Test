import sharp from "sharp";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSolidMask, solidToSegments } from "./solid-mask.mjs";

const SRC = "/workspace/demo/assets/arena-source.png";
const OUT = "/workspace/docs";
const ASSETS = `${OUT}/assets`;

function findPlatformSpawns(solid, width, height) {
  const caps = [];
  for (let x = 0; x < width; x++) {
    let prev = -1;
    for (let y = 0; y < height; y++) {
      if (!solid[y * width + x]) {
        prev = -1;
        continue;
      }
      if (prev < 0 || y > prev + 1) caps.push({ x, capY: y });
      prev = y;
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

  const segments = solidToSegments(solid, width, height);

  await writeFile(`${ASSETS}/arena-solid.bin`, solid);

  findPlatformSpawns(solid, width, height);

  let html = readFileSync("/workspace/demo/cloud-background.html", "utf8");
  const jpeg = readFileSync(`${ASSETS}/arena-bg.jpg`);
  const bgDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

  function embedPortable(source, bakedMode) {
    const copies = {
      drop: {
        title: "Gravity test — vertical drop in 3 seconds",
        desc: "Pixel collision: green = passable background, art = solid rock/platform pixels. Ball is a red pixel disc.",
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
