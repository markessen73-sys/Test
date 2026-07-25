/**
 * Bake cumulative damage-stage faces for the ring HUD.
 *
 * Usage (from frontend/):
 *   npm install canvas   # once, if needed
 *   node scripts/bake-damage-stage-faces.mjs
 *
 * Writes public/faces/damage-stages/00-clean.png … 08-foreheadBandage.png
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '../public/faces');
const male = await loadImage(`${BASE}/test-template-face-male.png`);

// Regions in MALE / damage-ref space (image coords). mirror=true flips after align for subject-left.
const sequence = [
  {
    name: '01-cauliflowerLeftEar',
    path: `${BASE}/damage/cauliflower-ear.png`,
    mirror: true,
    // extract from native right-ear area of unmirrored ref, then mirror places on subject left
    region: { cx: 0.13, cy: 0.42, rx: 0.22, ry: 0.28 },
    thr: 14,
  },
  {
    name: '02-blackRightEye',
    path: `${BASE}/damage/black-right-eye.png`,
    mirror: false,
    region: { cx: 0.35, cy: 0.34, rx: 0.16, ry: 0.15 },
    thr: 18,
  },
  {
    name: '03-swollenBottomLip',
    path: `${BASE}/damage/swollen-lip.png`,
    mirror: false,
    region: { cx: 0.5, cy: 0.66, rx: 0.22, ry: 0.12 },
    thr: 14,
  },
  {
    name: '04-cauliflowerRightEar',
    path: `${BASE}/damage/cauliflower-ear.png`,
    mirror: false,
    region: { cx: 0.13, cy: 0.42, rx: 0.22, ry: 0.28 },
    thr: 14,
  },
  {
    name: '05-missingTooth',
    path: `${BASE}/damage/missing-tooth.png`,
    mirror: false,
    region: { cx: 0.55, cy: 0.58, rx: 0.12, ry: 0.08 },
    thr: 12,
  },
  {
    name: '06-swollenLeftEye',
    path: `${BASE}/damage/swollen-left-eye.png`,
    mirror: false,
    region: { cx: 0.65, cy: 0.34, rx: 0.16, ry: 0.15 },
    thr: 16,
  },
  {
    name: '07-brokenNose',
    path: `${BASE}/damage/broken-nose.png`,
    mirror: false,
    region: { cx: 0.5, cy: 0.45, rx: 0.14, ry: 0.16 },
    thr: 20,
  },
  {
    name: '08-foreheadBandage',
    path: `${BASE}/damage/forehead-bandage.png`,
    mirror: false,
    region: { cx: 0.5, cy: 0.2, rx: 0.46, ry: 0.16 },
    thr: 10,
  },
];

const W = 1024, H = 1024;
function isBackdrop(r,g,b,a) {
  if (a < 20) return true;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  if (max < 22) return true;
  if (min > 232) return true;
  if (min > 200 && max - min < 14) return true;
  return false;
}
function clamp(v){return Math.max(0,Math.min(255,Math.round(v)));}

function drawImg(img, mirror=false) {
  const c=createCanvas(W,H); const ctx=c.getContext('2d');
  if (mirror) { ctx.translate(W,0); ctx.scale(-1,1); }
  ctx.drawImage(img,0,0,W,H);
  return ctx.getImageData(0,0,W,H);
}

function contentBBox(data) {
  let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    if(isBackdrop(data[i],data[i+1],data[i+2],data[i+3])) continue;
    if(x<x0)x0=x; if(y<y0)y0=y; if(x>x1)x1=x; if(y>y1)y1=y;
  }
  return x1<x0?null:{x0,y0,x1,y1};
}

function sampleBilinear(data,x,y){
  const x0=Math.max(0,Math.min(W-1,Math.floor(x)));
  const y0=Math.max(0,Math.min(H-1,Math.floor(y)));
  const x1=Math.min(W-1,x0+1), y1=Math.min(H-1,y0+1);
  const tx=x-Math.floor(x), ty=y-Math.floor(y);
  const out=[0,0,0,0];
  for(let c=0;c<4;c++){
    const i00=(y0*W+x0)*4, i10=(y0*W+x1)*4, i01=(y1*W+x0)*4, i11=(y1*W+x1)*4;
    const top=data[i00+c]+(data[i10+c]-data[i00+c])*tx;
    const bot=data[i01+c]+(data[i11+c]-data[i01+c])*tx;
    out[c]=top+(bot-top)*ty;
  }
  return out;
}

function alignToMale(dmgData, maleData) {
  const mb = contentBBox(maleData);
  const db = contentBBox(dmgData);
  const out = createCanvas(W,H).getContext('2d').createImageData(W,H);
  if (!mb || !db) return dmgData;
  const mw=mb.x1-mb.x0+1, mh=mb.y1-mb.y0+1;
  const dw=db.x1-db.x0+1, dh=db.y1-db.y0+1;
  for(let y=mb.y0;y<=mb.y1;y++) for(let x=mb.x0;x<=mb.x1;x++){
    const u=(x-mb.x0+0.5)/mw, v=(y-mb.y0+0.5)/mh;
    const [r,g,b,a]=sampleBilinear(dmgData.data, db.x0+u*dw-0.5, db.y0+v*dh-0.5);
    if(isBackdrop(r,g,b,a)) continue;
    const i=(y*W+x)*4;
    out.data[i]=clamp(r); out.data[i+1]=clamp(g); out.data[i+2]=clamp(b); out.data[i+3]=255;
  }
  return out;
}

function regionWeight(nx, ny, region) {
  const dx=(nx-region.cx)/region.rx, dy=(ny-region.cy)/region.ry;
  const d=Math.sqrt(dx*dx+dy*dy);
  if (d>=1) return 0;
  if (d<0.55) return 1;
  return 1-(d-0.55)/0.45;
}

const outDir = '/workspace/frontend/public/faces/damage-stages';
fs.mkdirSync(outDir, {recursive:true});

const maleData = drawImg(male, false);
const canvas = createCanvas(W,H);
const ctx = canvas.getContext('2d');
ctx.putImageData(maleData, 0, 0);
fs.writeFileSync(`${outDir}/00-clean.png`, canvas.toBuffer('image/png'));

for (const step of sequence) {
  const dmgImg = await loadImage(step.path);
  // For mirrored injuries: region is defined in native (unmirrored) space;
  // we mirror the source image, and also mirror the region cx.
  const region = { ...step.region };
  if (step.mirror) region.cx = 1 - region.cx;

  const dmgRaw = drawImg(dmgImg, step.mirror);
  const aligned = alignToMale(dmgRaw, maleData);
  const cur = ctx.getImageData(0,0,W,H);
  let painted=0;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const nx=(x+0.5)/W, ny=(y+0.5)/H;
    const w = regionWeight(nx, ny, region);
    if (w <= 0.05) continue;
    const i=(y*W+x)*4;
    const dr=aligned.data[i], dg=aligned.data[i+1], db=aligned.data[i+2], da=aligned.data[i+3];
    if (da < 20) continue;
    const mr=maleData.data[i], mg=maleData.data[i+1], mb=maleData.data[i+2], ma=maleData.data[i+3];
    const maleClear = isBackdrop(mr,mg,mb,ma);
    const diff = Math.abs(dr-mr)+Math.abs(dg-mg)+Math.abs(db-mb);
    if (!maleClear && diff < step.thr) continue;
    if (maleClear && diff < 10) continue;
    const t = Math.min(1, w * Math.max(0.65, Math.min(1, (diff - step.thr * 0.5) / 60)));
    cur.data[i] = clamp(cur.data[i]*(1-t)+dr*t);
    cur.data[i+1] = clamp(cur.data[i+1]*(1-t)+dg*t);
    cur.data[i+2] = clamp(cur.data[i+2]*(1-t)+db*t);
    if (maleClear) cur.data[i+3] = 255;
    painted++;
  }
  ctx.putImageData(cur,0,0);
  fs.writeFileSync(`${outDir}/${step.name}.png`, canvas.toBuffer('image/png'));
  console.log(step.name, 'painted', painted);
}
console.log('done');
