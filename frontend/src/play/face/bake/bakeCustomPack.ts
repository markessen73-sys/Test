/**
 * Bake a full playable face pack (damage + clown) from clean/ooh/KO ImageData.
 * Same painters as the offline Node bake scripts.
 */
// @ts-nocheck
import {
  W,
  H,
  LM,
  clamp,
  mix,
  copyImageData,
  sampleFaceSkin,
  setAllowClownSkin,
  applyCauliflowerEar,
  applyBlackEye,
  applyChinCrossPlaster,
  applyMissingTooth,
  applySwollenEye,
  applyBrokenNose,
  applyForeheadBandage,
  ellipseDist,
  softEdge,
  isIris,
  isGlassesFrame,
  isBlondeHair,
} from './faceDamageBake';
import { applyComedyClownMakeup, applyClownKnockout } from './clownMakeup';

export interface CustomBoxerPackBlobs {
  clean: Blob;
  ooh: Blob;
  knockout: Blob;
  damage: Record<string, Blob>;
  clown: Record<string, Blob>;
}

const DAMAGE_STEPS: { name: string; run: (face: ImageData, clean: ImageData, skin: number[]) => number }[] = [
  { name: '01-cauliflowerLeftEar.png', run: (f, c, s) => applyCauliflowerEar(f, c, 'left', s) },
  { name: '02-blackRightEye.png', run: (f) => applyBlackEye(f, 'right') },
  { name: '03-chinCrossPlaster.png', run: (f, c) => applyChinCrossPlaster(f, c) },
  { name: '04-cauliflowerRightEar.png', run: (f, c, s) => applyCauliflowerEar(f, c, 'right', s) },
  { name: '05-missingTooth.png', run: (f) => applyMissingTooth(f) },
  { name: '06-swollenLeftEye.png', run: (f) => applySwollenEye(f, 'left') },
  { name: '07-brokenNose.png', run: (f) => applyBrokenNose(f) },
  { name: '08-foreheadBandage.png', run: (f, c) => applyForeheadBandage(f, c) },
];

function canvasFromImageData(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

async function toPngBlob(img: ImageData): Promise<Blob> {
  const canvas = canvasFromImageData(img);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** Clown chin plaster that works with smile paint (mirrors Node bake). */
function applyClownChinPlaster(face: ImageData): number {
  let n = 0;
  const chin = LM.chin;
  const hLen = 0.07;
  const hWid = 0.018;
  const vLen = 0.065;
  const vWid = 0.017;
  const pad = 0.004;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = nx - chin.x;
      const dy = ny - chin.y;
      const inH =
        Math.abs(dx) <= hLen + pad &&
        Math.abs(dy) <= hWid + pad &&
        (Math.abs(dx) <= hLen || Math.hypot(Math.abs(dx) - hLen, dy) <= hWid);
      const inV =
        Math.abs(dy) <= vLen + pad &&
        Math.abs(dx) <= vWid + pad &&
        (Math.abs(dy) <= vLen || Math.hypot(dx, Math.abs(dy) - vLen) <= vWid);
      if (!inH && !inV) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 20) continue;
      if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      const inMouth = ellipseDist(nx, ny, LM.mouth.x, LM.mouth.y, 0.12, 0.06) < 1;
      if (inMouth) continue;
      let cr = 242;
      let cg = 228;
      let cb = 198;
      if (Math.abs(dx) < vWid * 1.1 && Math.abs(dy) < hWid * 1.1) {
        cr = 248;
        cg = 236;
        cb = 210;
      }
      if (Math.hypot(dx, dy) < 0.012) {
        const bt = 1 - Math.hypot(dx, dy) / 0.012;
        cr = mix(cr, 170, bt * 0.45);
        cg = mix(cg, 70, bt * 0.45);
        cb = mix(cb, 55, bt * 0.45);
      }
      face.data[i] = cr;
      face.data[i + 1] = cg;
      face.data[i + 2] = cb;
      face.data[i + 3] = 255;
      n++;
    }
  }
  return n;
}

function applyClownForeheadBandage(face: ImageData, clownClean: ImageData): number {
  let n = 0;
  const fh = LM.forehead;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const d = ellipseDist(nx, ny, fh.x, fh.y, 0.2, 0.055);
      if (d >= 1 || ny < 0.23 || ny > 0.35) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 40) continue;
      if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
      if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      const r0 = clownClean.data[i];
      const g0 = clownClean.data[i + 1];
      const b0 = clownClean.data[i + 2];
      if (isBlondeHair(r0, g0, b0, clownClean.data[i + 3]) && ny < 0.24) continue;
      if (Math.max(r0, g0, b0) - Math.min(r0, g0, b0) > 80 && ny < 0.26) continue;
      const edge = softEdge(d, 0.85);
      if (edge < 0.1) continue;
      let cr = 245;
      let cg = 232;
      let cb = 200;
      const fold = Math.abs(((nx * 36) % 1) - 0.5);
      if (fold < 0.07) {
        cr = mix(cr, 210, 0.3);
        cg = mix(cg, 190, 0.3);
        cb = mix(cb, 155, 0.3);
      }
      face.data[i] = clamp(mix(face.data[i], cr, edge));
      face.data[i + 1] = clamp(mix(face.data[i + 1], cg, edge));
      face.data[i + 2] = clamp(mix(face.data[i + 2], cb, edge));
      n++;
    }
  }
  return n;
}

export type BakeProgress = (message: string, ratio: number) => void;

export async function bakeCustomBoxerPack(
  clean: ImageData,
  ooh: ImageData,
  knockout: ImageData,
  onProgress?: BakeProgress
): Promise<CustomBoxerPackBlobs> {
  if (clean.width !== W || clean.height !== H) {
    throw new Error(`Clean face must be ${W}×${H}`);
  }

  onProgress?.('Baking damage stages…', 0.55);
  const damage: Record<string, Blob> = {};
  let face = copyImageData(clean);
  const skin = sampleFaceSkin(clean);
  damage['00-clean.png'] = await toPngBlob(face);

  for (let i = 0; i < DAMAGE_STEPS.length; i++) {
    const step = DAMAGE_STEPS[i];
    step.run(face, clean, skin);
    damage[step.name] = await toPngBlob(face);
    onProgress?.(`Damage ${i + 1}/${DAMAGE_STEPS.length}…`, 0.55 + (i / DAMAGE_STEPS.length) * 0.15);
    await yieldFrame();
  }
  damage['09-hold.png'] = await toPngBlob(face);
  damage['10-knockout.png'] = await toPngBlob(knockout);

  onProgress?.('Baking clown faces…', 0.72);
  setAllowClownSkin(false);
  const clown: Record<string, Blob> = {};

  let clownFace = copyImageData(clean);
  applyComedyClownMakeup(clownFace, clean);
  const clownClean = copyImageData(clownFace);
  const peachSkin = sampleFaceSkin(clean);
  clown['00-clean.png'] = await toPngBlob(clownFace);
  await yieldFrame();

  const clownSteps: { name: string; run: () => number }[] = [
    { name: '01-cauliflowerLeftEar.png', run: () => applyCauliflowerEar(clownFace, clownClean, 'left', peachSkin) },
    { name: '02-blackRightEye.png', run: () => applyBlackEye(clownFace, 'right') },
    { name: '03-chinCrossPlaster.png', run: () => applyClownChinPlaster(clownFace) },
    { name: '04-cauliflowerRightEar.png', run: () => applyCauliflowerEar(clownFace, clownClean, 'right', peachSkin) },
    { name: '05-missingTooth.png', run: () => applyMissingTooth(clownFace) },
    { name: '06-swollenLeftEye.png', run: () => applySwollenEye(clownFace, 'left') },
    { name: '07-brokenNose.png', run: () => applyBrokenNose(clownFace) },
    { name: '08-foreheadBandage.png', run: () => applyClownForeheadBandage(clownFace, clownClean) },
  ];

  for (let i = 0; i < clownSteps.length; i++) {
    clownSteps[i].run();
    clown[clownSteps[i].name] = await toPngBlob(clownFace);
    onProgress?.(`Clown ${i + 1}/${clownSteps.length}…`, 0.72 + (i / clownSteps.length) * 0.15);
    await yieldFrame();
  }
  clown['09-hold.png'] = await toPngBlob(clownFace);
  applyClownKnockout(clownFace, clownClean);
  clown['10-knockout.png'] = await toPngBlob(clownFace);

  const oohClown = copyImageData(ooh);
  applyComedyClownMakeup(oohClown, ooh);
  clown['ooh.png'] = await toPngBlob(oohClown);

  const koClown = copyImageData(knockout);
  applyComedyClownMakeup(koClown, knockout);
  clown['knockout-clean.png'] = await toPngBlob(koClown);

  onProgress?.('Packaging…', 0.95);
  return {
    clean: await toPngBlob(clean),
    ooh: await toPngBlob(ooh),
    knockout: await toPngBlob(knockout),
    damage,
    clown,
  };
}
