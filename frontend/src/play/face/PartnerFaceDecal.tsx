import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FACE_CONTAIN_PAD,
  drawFullFaceOnCanvas,
  fillClearInteriorBlack,
  loadFaceImage,
} from './composeFaceTexture';
import { useCharacter } from './CharacterContext';
import {
  FACE_NOSE_LANDMARK,
  FACE_SOURCE_SIZE,
  RING_PARTNER_FACE,
} from './faceTemplate';
import {
  landmarkOffsetInDecal,
  scalePlacement,
  scalePlacementFromPoint,
  spriteNormRectToLocal,
} from './spriteFacePlacement';
import { paintOohReaction, skinFromFaceImage, type PopEyePair } from './paintOohReaction';
import { paintKnockoutFace } from './paintKnockout';
import type { NormRect } from './types';
import type { Rgb } from '../../face-capture/popEyes';

const CANVAS_SIZE = 512;
/** Prior calibration: top-right pinned, +25%. */
const PARTNER_FACE_SCALE_TOP_RIGHT = 1.25;
/** Prior calibration: bottom-left pinned, +10% right and up. */
const PARTNER_FACE_SCALE_BOTTOM_LEFT = 1.1;
/** Nose pinned, +10% every direction (applied per user calibration step). */
const PARTNER_FACE_SCALE_NOSE = 1.1;
const PARTNER_FACE_NOSE_SCALE_STEPS = 2;
/** Final overall boost — active head ~20% larger. */
const PARTNER_FACE_SCALE_OVERALL = 1.2;
/** How long the "ooh!" face stays up (ms); eyes zoom for most of this. */
const OOH_MS = 720;
/** Body sprite sits at z≈0.02 — face front stays ahead; hair layer tucks behind. */
const FACE_FRONT_Z = 0.03;
const FACE_HAIR_BEHIND_Z = 0.01;

/** Warm tan / peach skin — keep neck stump on the front plane. */
function isNeckSkin(r: number, g: number, b: number) {
  if (r < 70 || g < 35 || b < 15) return false;
  if (r < g - 8 || g < b - 20) return false;
  return r - b > 25 && r > 90;
}

/** Dark brown / black hair strands that hang past the chin. */
function isHangingHair(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 140) return false;
  // Near-black outline or dark brown waves.
  if (max < 48) return true;
  return r >= g - 6 && g >= b - 18 && max - min < 70 && r > 25;
}

/**
 * Clear hanging side-hair below the chin so the front plane only keeps face +
 * neck; the full texture on the behind plane draws hair under the torso.
 */
function clearHangingHairForFront(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  let x0 = size,
    y0 = size,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (d[(y * size + x) * 4 + 3] < 40) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x0 >= x1 || y0 >= y1) return;
  const chinY = Math.floor(y0 + (y1 - y0) * 0.68);
  const cx = (x0 + x1) / 2;
  const neckHalf = (x1 - x0) * 0.16;
  for (let y = chinY; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * size + x) * 4;
      if (d[i + 3] < 40) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const inNeck = Math.abs(x - cx) <= neckHalf;
      // Keep only the skin neck column on the front plane; hair + collar go behind.
      if (inNeck && isNeckSkin(r, g, b) && !isHangingHair(r, g, b)) continue;
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function scaleFromNose(
  placement: ReturnType<typeof spriteNormRectToLocal>,
  scale: number
) {
  const [fw, fh] = placement.size;
  const [iw, ih] = FACE_SOURCE_SIZE;
  const noseOffset = landmarkOffsetInDecal(
    fw,
    fh,
    CANVAS_SIZE,
    CANVAS_SIZE,
    iw,
    ih,
    FACE_NOSE_LANDMARK,
    FACE_CONTAIN_PAD
  );
  return scalePlacementFromPoint(placement, scale, noseOffset);
}

interface PartnerFaceDecalProps {
  /** Sprite plane width in metres. */
  spriteWidth: number;
  /** Sprite plane height in metres. */
  spriteHeight: number;
  /** Head slot on the active body texture (defaults to generic ring partner). */
  faceRect?: NormRect;
  /** Body texture URL — unused for blending; kept for call-site compatibility. */
  bodyTextureSrc?: string;
  /** Latest landed punch time — swaps to the authored ooh face. */
  lastHitTime?: number;
  /** Damage meter at 100% — hold the knockout face. */
  knockedOut?: boolean;
}

/**
 * Clean 2D caricature on the moving sparring partner.
 * Injuries live on the HUD damage meter. On hit, swap to ooh; at 100% show KO.
 * Photo faces with eye marks animate pop-eyes zooming ½→full.
 * Stock faces: interior clear holes fill black; hard chin edge (no bottom fade).
 */
export function PartnerFaceDecal({
  spriteWidth,
  spriteHeight,
  faceRect = RING_PARTNER_FACE,
  bodyTextureSrc: _bodyTextureSrc,
  lastHitTime = 0,
  knockedOut = false,
}: PartnerFaceDecalProps) {
  const { character } = useCharacter();
  const hairBehind = !!character.hairBehindBody;
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [hairTexture, setHairTexture] = useState<THREE.CanvasTexture | null>(null);
  const normalRef = useRef<HTMLImageElement | null>(null);
  const oohRef = useRef<HTMLImageElement | null>(null);
  const koRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hairCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const hairTexRef = useRef<THREE.CanvasTexture | null>(null);
  const popEyesRef = useRef<PopEyePair | null>(null);
  const skinRef = useRef<Rgb | null>(null);
  const stockFaceRef = useRef(!character.isPhotoFace);
  const hairBehindRef = useRef(hairBehind);
  hairBehindRef.current = hairBehind;
  const knockedOutRef = useRef(knockedOut);
  knockedOutRef.current = knockedOut;
  stockFaceRef.current = !character.isPhotoFace;
  const lastPaintedAgeRef = useRef(-1);
  const hitTimeRef = useRef(lastHitTime);
  if (hitTimeRef.current !== lastHitTime) {
    hitTimeRef.current = lastHitTime;
    lastPaintedAgeRef.current = -1;
  }

  const placement = useMemo(() => {
    const base = spriteNormRectToLocal(faceRect, spriteWidth, spriteHeight, {
      scale: PARTNER_FACE_SCALE_TOP_RIGHT,
      anchor: 'top-right',
    });
    let current = scalePlacement(base, PARTNER_FACE_SCALE_BOTTOM_LEFT, 'bottom-left');
    for (let i = 0; i < PARTNER_FACE_NOSE_SCALE_STEPS; i++) {
      current = scaleFromNose(current, PARTNER_FACE_SCALE_NOSE);
    }
    current = scaleFromNose(current, PARTNER_FACE_SCALE_OVERALL);
    const packScale = character.faceScale ?? 1;
    if (packScale !== 1) {
      current = scaleFromNose(current, packScale);
    }
    const nudgeX = character.faceNudgeX ?? 0;
    const nudgeY = character.faceNudgeY ?? 0;
    if (nudgeX !== 0 || nudgeY !== 0) {
      const [cx, cy, cz] = current.center;
      current = {
        center: [
          cx + nudgeX * current.size[0],
          cy + nudgeY * current.size[1],
          cz,
        ],
        size: current.size,
      };
    }
    // Keep face front Z explicit so hair-behind plane can sit under the body.
    const [cx, cy] = current.center;
    return {
      center: [cx, cy, FACE_FRONT_Z] as [number, number, number],
      size: current.size,
    };
  }, [
    spriteWidth,
    spriteHeight,
    faceRect,
    character.faceScale,
    character.faceNudgeX,
    character.faceNudgeY,
  ]);
  const [fw, fh] = placement.size;
  const hairCenter: [number, number, number] = [
    placement.center[0],
    placement.center[1],
    FACE_HAIR_BEHIND_Z,
  ];

  const finishPaint = (ctx: CanvasRenderingContext2D) => {
    if (stockFaceRef.current) {
      fillClearInteriorBlack(ctx, CANVAS_SIZE, CANVAS_SIZE);
    }
  };

  const syncHairBehind = (frontCtx: CanvasRenderingContext2D) => {
    if (!hairBehindRef.current) return;
    const hairCanvas = hairCanvasRef.current;
    const hairTex = hairTexRef.current;
    if (!hairCanvas || !hairTex) return;
    const hctx = hairCanvas.getContext('2d');
    if (!hctx) return;
    // Full face (with hanging hair) goes behind the body.
    hctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    hctx.drawImage(frontCtx.canvas, 0, 0);
    hairTex.needsUpdate = true;
    // Front plane keeps face + neck only.
    clearHangingHairForFront(frontCtx, CANVAS_SIZE);
  };

  const paint = (img: HTMLImageElement, hitAgeMs?: number) => {
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (hitAgeMs != null && popEyesRef.current) {
      paintOohReaction(ctx, CANVAS_SIZE, img, {
        popEyes: popEyesRef.current,
        skin: skinRef.current,
        hitAgeMs,
        oohMs: OOH_MS,
      });
    } else {
      drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE);
    }
    finishPaint(ctx);
    syncHairBehind(ctx);
    tex.needsUpdate = true;
  };

  const paintKo = (ko: HTMLImageElement, timeMs: number) => {
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintKnockoutFace(ctx, CANVAS_SIZE, ko, timeMs);
    finishPaint(ctx);
    syncHairBehind(ctx);
    tex.needsUpdate = true;
  };

  // Keep marks in sync every render (not only on image reload).
  popEyesRef.current = character.popEyes ?? null;

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;
    setTexture(tex);

    let hairTex: THREE.CanvasTexture | null = null;
    if (hairBehind) {
      const hairCanvas = document.createElement('canvas');
      hairCanvas.width = CANVAS_SIZE;
      hairCanvas.height = CANVAS_SIZE;
      hairCanvasRef.current = hairCanvas;
      hairTex = new THREE.CanvasTexture(hairCanvas);
      hairTex.colorSpace = THREE.SRGBColorSpace;
      hairTexRef.current = hairTex;
      setHairTexture(hairTex);
    } else {
      hairCanvasRef.current = null;
      hairTexRef.current = null;
      setHairTexture(null);
    }

    skinRef.current = null;
    const marks = character.popEyes ?? null;
    popEyesRef.current = marks;

    Promise.all([
      loadFaceImage(character.cleanSrc),
      loadFaceImage(character.oohSrc),
      loadFaceImage(character.knockoutSrc),
    ]).then(([normal, ooh, ko]) => {
      if (cancelled) return;
      normalRef.current = normal;
      oohRef.current = ooh;
      koRef.current = ko;
      if (marks) {
        skinRef.current = skinFromFaceImage(ooh, marks);
      }
      paint(knockedOutRef.current ? ko : normal);
    });

    return () => {
      cancelled = true;
      tex.dispose();
      hairTex?.dispose();
    };
  }, [
    character.id,
    character.cleanSrc,
    character.oohSrc,
    character.knockoutSrc,
    character.popEyes,
    hairBehind,
  ]);

  // Hold knockout face once the meter hits 100%.
  useEffect(() => {
    lastPaintedAgeRef.current = -1;
    const ko = koRef.current;
    const normal = normalRef.current;
    if (knockedOut) {
      if (ko) {
        if (character.isPhotoFace) paintKo(ko, performance.now());
        else paint(ko);
      }
      return;
    }
    if (normal) paint(normal);
  }, [knockedOut, character.isPhotoFace]);

  // Ooh + pop-eye zoom, or spinning KO stars — driven by the R3F frame loop.
  useFrame(() => {
    if (knockedOutRef.current) {
      if (!character.isPhotoFace) return;
      const ko = koRef.current;
      if (!ko) return;
      const bucket = Math.floor(performance.now() / 32);
      if (bucket === lastPaintedAgeRef.current) return;
      lastPaintedAgeRef.current = bucket;
      paintKo(ko, performance.now());
      return;
    }
    const hitT = hitTimeRef.current;
    if (!hitT) return;
    const normal = normalRef.current;
    const ooh = oohRef.current;
    if (!normal || !ooh) return;

    const age = performance.now() - hitT;
    if (age >= 0 && age < OOH_MS) {
      // Throttle redraws slightly but keep zoom smooth (~every frame while zooming)
      const bucket = Math.floor(age / 16);
      if (bucket === lastPaintedAgeRef.current) return;
      lastPaintedAgeRef.current = bucket;
      paint(ooh, popEyesRef.current ? age : undefined);
    } else if (lastPaintedAgeRef.current !== -2) {
      lastPaintedAgeRef.current = -2;
      paint(normal);
    }
  });

  if (!texture) return null;

  return (
    <group>
      {hairBehind && hairTexture ? (
        <mesh position={hairCenter} renderOrder={0}>
          <planeGeometry args={[fw, fh]} />
          <meshBasicMaterial map={hairTexture} transparent depthWrite={false} />
        </mesh>
      ) : null}
      <mesh position={placement.center} renderOrder={2}>
        <planeGeometry args={[fw, fh]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
