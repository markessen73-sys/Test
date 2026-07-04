import sharp from "sharp";
import { readFileSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSolidMask, buildDebugCompositeRgba, solidToSegments } from "./solid-mask.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = join(ROOT, "demo");
const DEMO_ASSETS = join(DEMO, "assets");
const SRC = join(DEMO_ASSETS, "arena-source.png");
const BACKDROP = join(DEMO_ASSETS, "arena-backdrop.jpg");
const ENGINE_REV_SEARCH_DIRS = [DEMO_ASSETS, DEMO, ROOT];
const AUDIO_EXTS = new Set(["mp3", "m4a", "wav", "ogg", "aac", "caf", "aiff", "flac", "webm"]);
const ENGINE_REV_MIME = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  caf: "audio/x-caf",
  aiff: "audio/aiff",
  flac: "audio/flac",
  webm: "audio/webm",
};
const OUT = join(ROOT, "docs");
const ASSETS = `${OUT}/assets`;

function getBranchName() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "cursor/lunar-muskman-2ae2";
  }
}

function findNamedAudio(stem) {
  const target = `${stem.toLowerCase()}.`;
  for (const dir of ENGINE_REV_SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().startsWith(target)) continue;
      const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
      if (!AUDIO_EXTS.has(ext)) continue;
      return join(dir, name);
    }
  }
  return null;
}

function findAudioByNamePart(part) {
  const needle = part.toLowerCase();
  const ranked = [];
  for (const dir of ENGINE_REV_SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      let st;
      try {
        st = statSync(path);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
      if (!AUDIO_EXTS.has(ext)) continue;
      if (!name.toLowerCase().includes(needle)) continue;
      ranked.push({ path, mtime: st.mtimeMs, size: st.size });
    }
  }
  ranked.sort((a, b) => b.mtime - a.mtime || b.size - a.size);
  return ranked[0]?.path ?? null;
}

function copyAudioAsset(path, assetName) {
  if (!path) return "";
  copyFileSync(path, `${ASSETS}/${assetName}`);
  return `assets/${assetName}`;
}

function prepareMusicAsset(srcPath, assetName) {
  const dest = `${ASSETS}/${assetName}`;
  const demoDest = join(DEMO_ASSETS, assetName);
  const ffmpeg = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", srcPath, "-b:a", "96k", "-ac", "1", "-ar", "44100", dest],
    { stdio: "pipe" },
  );
  if (ffmpeg.status === 0) {
    copyFileSync(dest, demoDest);
    return { ref: `assets/${assetName}`, bytes: readFileSync(dest).length, optimized: true };
  }
  copyFileSync(srcPath, dest);
  copyFileSync(srcPath, demoDest);
  return { ref: `assets/${assetName}`, bytes: readFileSync(dest).length, optimized: false };
}

function prepareVegasMusic(srcPath) {
  return prepareMusicAsset(srcPath, "vegas-music.mp3");
}

function findEngineRevSource() {
  const revMp3Paths = [
    join(DEMO_ASSETS, "rev.mp3"),
    join(ROOT, "rev.mp3"),
  ];
  for (const path of revMp3Paths) {
    if (existsSync(path)) return path;
  }

  const ranked = [];

  for (const dir of ENGINE_REV_SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      let st;
      try {
        st = statSync(path);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;

      const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
      if (!AUDIO_EXTS.has(ext)) continue;

      const lower = name.toLowerCase();
      let score = 0;
      if (lower === "rev.mp3") score += 200;
      if (/rev|engine|petrol|motor|throttle|accel|v8|car/.test(lower)) score += 100;
      if (lower.includes("freesound_community")) score -= 80;
      if (lower === "engine-rev.mp3" && st.size <= 7000) score -= 40;
      score += Math.min(st.size / 2000, 30);
      ranked.push({ path, score, mtime: st.mtimeMs, size: st.size });
    }
  }

  ranked.sort((a, b) => b.score - a.score || b.mtime - a.mtime || b.size - a.size);
  return ranked[0]?.path ?? null;
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

  copyFileSync(SRC, `${ASSETS}/arena-foreground.png`);
  copyFileSync(join(DEMO, "manifest.webmanifest"), `${OUT}/manifest.webmanifest`);

  const INTRO_SOURCES = [
    [join(DEMO_ASSETS, "intro-server.png"), "intro-server.png"],
    [join(DEMO_ASSETS, "intro-smoke.png"), "intro-smoke.png"],
    [join(DEMO_ASSETS, "intro-capri.png"), "intro-capri.png"],
    [join(ROOT, "file_00000000c3987246bb410932dd4c3a33.png"), "intro-server.png"],
    [join(ROOT, "file_00000000502471f4961279e1dcfd9ef2.png"), "intro-smoke.png"],
    [join(ROOT, "file_0000000001cc724381f0d7d1368fa96e.png"), "intro-capri.png"],
  ];
  const copiedIntro = new Set();
  for (const [src, name] of INTRO_SOURCES) {
    if (copiedIntro.has(name) || !existsSync(src)) continue;
    copyFileSync(src, `${ASSETS}/${name}`);
    copyFileSync(src, join(DEMO_ASSETS, name));
    copiedIntro.add(name);
    console.log(`Intro asset: ${name} (${readFileSync(src).length} bytes)`);
  }

  const LEVEL2_BG = join(DEMO_ASSETS, "level2-background.png");
  const LEVEL2_BG_ROOT = join(ROOT, "file_000000007298724693505eed12bd3d5c.png");
  if (!existsSync(LEVEL2_BG) && existsSync(LEVEL2_BG_ROOT)) {
    copyFileSync(LEVEL2_BG_ROOT, LEVEL2_BG);
  }
  if (existsSync(LEVEL2_BG)) {
    copyFileSync(LEVEL2_BG, `${ASSETS}/level2-background.png`);
    console.log(`Level two background: level2-background.png (${readFileSync(LEVEL2_BG).length} bytes)`);
  } else {
    console.log("Level two background: none found");
  }

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
  await writeFile(join(DEMO_ASSETS, "arena-backdrop.jpg"), backdropJpegFull);

  const portableAssetBase = `https://raw.githubusercontent.com/markessen73-sys/Test/${getBranchName()}/docs/assets/`;

  function toPortableUrl(ref) {
    if (!ref) return "";
    if (ref.startsWith("http")) return ref;
    if (ref.startsWith("assets/")) return portableAssetBase + ref.slice("assets/".length);
    return ref;
  }

  const bgDataUrl = toPortableUrl("assets/arena-foreground.png");
  const backdropDataUrl = toPortableUrl("assets/arena-backdrop.jpg");

  let pewDataUrl = "";
  const pewPath = findNamedAudio("pew");
  if (pewPath) {
    pewDataUrl = copyAudioAsset(pewPath, "pew.mp3");
    console.log(`Zoox zap SFX: ${pewDataUrl} (${readFileSync(pewPath).length} bytes)`);
  } else {
    console.log("Zoox zap SFX: none found (procedural fallback)");
  }

  let beepDataUrl = "";
  const beepPath = findNamedAudio("beep");
  if (beepPath) {
    beepDataUrl = copyAudioAsset(beepPath, "beep.mp3");
    console.log(`Lightning beep SFX: ${beepDataUrl} (${readFileSync(beepPath).length} bytes)`);
  } else {
    console.log("Lightning beep SFX: none found (procedural fallback)");
  }

  let vegasMusicDataUrl = "";
  const vegasMusicPath = findNamedAudio("vegas");
  if (vegasMusicPath) {
    const vegas = prepareVegasMusic(vegasMusicPath);
    vegasMusicDataUrl = vegas.ref;
    console.log(
      `Vegas music: ${vegasMusicDataUrl} (${vegas.bytes} bytes${vegas.optimized ? ", 96k mono" : ""})`,
    );
  } else {
    console.log("Vegas music: none found");
  }

  let hypnotizedMusicDataUrl = "";
  const hypnotizedMusicPath =
    findAudioByNamePart("hypnotized") ?? findAudioByNamePart("hypnotised");
  if (hypnotizedMusicPath) {
    const hypnotized = prepareMusicAsset(hypnotizedMusicPath, "hypnotized-music.mp3");
    hypnotizedMusicDataUrl = hypnotized.ref;
    console.log(
      `Title music: ${hypnotizedMusicDataUrl} (${hypnotized.bytes} bytes${hypnotized.optimized ? ", 96k mono" : ""})`,
    );
  } else {
    console.log("Title music: none found (hypnotized)");
  }

  let carCrashDataUrl = "";
  const carCrashPath = findAudioByNamePart("car_crash");
  if (carCrashPath) {
    carCrashDataUrl = copyAudioAsset(carCrashPath, "car-crash.mp3");
    copyFileSync(carCrashPath, join(DEMO_ASSETS, "car-crash.mp3"));
    console.log(`Car crash SFX: ${carCrashDataUrl} (${readFileSync(carCrashPath).length} bytes)`);
  } else {
    console.log("Car crash SFX: none found (procedural fallback)");
  }

  let royalBaroqueMusicDataUrl = "";
  const royalBaroquePath =
    findAudioByNamePart("royal-baroque") ??
    findAudioByNamePart("royal_baroque") ??
    findAudioByNamePart("royal");
  if (royalBaroquePath) {
    const royal = prepareMusicAsset(royalBaroquePath, "royal-baroque-music.mp3");
    royalBaroqueMusicDataUrl = royal.ref;
    console.log(
      `Level two music: ${royalBaroqueMusicDataUrl} (${royal.bytes} bytes${royal.optimized ? ", 96k mono" : ""})`,
    );
  } else {
    console.log("Level two music: none found (royal baroque)");
  }

  let html = readFileSync(join(DEMO, "cloud-background.html"), "utf8");

  function embedPortable(source) {
    return source
      .replace("__SOLID_SEGMENTS__", JSON.stringify(segments))
      .replace("__BG_DATA_URL__", bgDataUrl)
      .replace("__BACKDROP_DATA_URL__", backdropDataUrl)
      .replace("__PEW_DATA_URL__", toPortableUrl(pewDataUrl))
      .replace("__BEEP_DATA_URL__", toPortableUrl(beepDataUrl))
      .replace("__VEGAS_MUSIC_DATA_URL__", toPortableUrl(vegasMusicDataUrl))
      .replace("__HYPNOTIZED_MUSIC_DATA_URL__", toPortableUrl(hypnotizedMusicDataUrl))
      .replace("__ROYAL_BAROQUE_MUSIC_DATA_URL__", toPortableUrl(royalBaroqueMusicDataUrl))
      .replace("__CAR_CRASH_DATA_URL__", toPortableUrl(carCrashDataUrl))
      .replace("__PORTABLE_ASSET_BASE__", portableAssetBase)
      .replace(
        'const INTRO_SERVER_URL = "assets/intro-server.png";',
        `const INTRO_SERVER_URL = "${portableAssetBase}intro-server.png";`,
      )
      .replace(
        'const INTRO_SMOKE_URL = "assets/intro-smoke.png";',
        `const INTRO_SMOKE_URL = "${portableAssetBase}intro-smoke.png";`,
      )
      .replace(
        'const INTRO_CAPRI_URL = "assets/intro-capri.png";',
        `const INTRO_CAPRI_URL = "${portableAssetBase}intro-capri.png";`,
      )
      .replace(
        'const LEVEL2_BACKGROUND_URL = "assets/level2-background.png";',
        `const LEVEL2_BACKGROUND_URL = "${portableAssetBase}level2-background.png";`,
      )
      .replace("__BAKED_MODE__", "drop")
      .replace("__TITLE_TEXT__", "Adventures Of Crappy Capri")
      .replace(
        "__DESC_TEXT__",
        "Hold ← or → on the stick to steer while falling, then tap fire to boost up and sideways. Three Zoox robotaxis patrol the decks. You have three lives.",
      )
      .replace("__BADGE_TEXT__", "");
  }

  await writeFile(`${OUT}/index.html`, embedPortable(html));
  await writeFile(`${OUT}/.nojekyll`, "");
  console.log(
    `Portable build: ${width}x${height}, solid ${solidCount} px (${((100 * solidCount) / (width * height)).toFixed(1)}%)`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
