import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_NOSE_LANDMARK, FACE_SOURCE_SIZE, FACE_TEMPLATE_SRC, RING_PARTNER_FACE } from './faceTemplate';
import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { drawFaceDamageOverlays } from './drawFaceDamageOverlays';
import {
  compositeReferenceDamages,
  FACE_DAMAGE_BASELINE_SRC,
  proceduralDamagesOnly,
  proceduralReinforcements,
} from './compositeFaceDamage';
import { faceDamageAssetSrcs } from './faceDamageAssets';
import type { FaceDamageId } from './faceDamage';
import {
  landmarkOffsetInDecal,
  scalePlacement,
  scalePlacementFromPoint,
  spriteNormRectToLocal,
} from './spriteFacePlacement';

const CANVAS_SIZE = 512;
/** Prior calibration: top-right pinned, +25%. */
const PARTNER_FACE_SCALE_TOP_RIGHT = 1.25;
/** Prior calibration: bottom-left pinned, +10% right and up. */
const PARTNER_FACE_SCALE_BOTTOM_LEFT = 1.1;
/** Nose pinned, +10% every direction (applied per user calibration step). */
const PARTNER_FACE_SCALE_NOSE = 1.1;
const PARTNER_FACE_NOSE_SCALE_STEPS = 2;

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
  /** Accumulated face injuries from landed punches. */
  damages?: readonly FaceDamageId[];
}

/** Template face decal mapped onto the sparring partner head (ring play only). */
export function PartnerFaceDecal({
  spriteWidth,
  spriteHeight,
  damages = [],
}: PartnerFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  /** Undamaged male face the damage PNGs were authored against. */
  const maleBaselineRef = useRef<HTMLImageElement | null>(null);
  const damageImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const damagesRef = useRef(damages);
  damagesRef.current = damages;

  const placement = useMemo(() => {
    const base = spriteNormRectToLocal(RING_PARTNER_FACE, spriteWidth, spriteHeight, {
      scale: PARTNER_FACE_SCALE_TOP_RIGHT,
      anchor: 'top-right',
    });
    let current = scalePlacement(base, PARTNER_FACE_SCALE_BOTTOM_LEFT, 'bottom-left');
    for (let i = 0; i < PARTNER_FACE_NOSE_SCALE_STEPS; i++) {
      current = scaleFromNose(current, PARTNER_FACE_SCALE_NOSE);
    }
    return current;
  }, [spriteWidth, spriteHeight]);
  const [fw, fh] = placement.size;

  const redraw = useCallback(() => {
    const img = imgRef.current;
    const maleBaseline = maleBaselineRef.current;
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!img || !maleBaseline || !canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const applied = damagesRef.current;
    drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE);
    // Diff damage refs against the male baseline, then map those changes onto this face.
    compositeReferenceDamages(
      ctx,
      CANVAS_SIZE,
      CANVAS_SIZE,
      maleBaseline,
      applied,
      damageImgsRef.current
    );
    drawFaceDamageOverlays(ctx, CANVAS_SIZE, CANVAS_SIZE, [
      ...proceduralDamagesOnly(applied),
      ...proceduralReinforcements(applied),
    ]);
    tex.needsUpdate = true;
  }, []);

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

    const srcs = faceDamageAssetSrcs();

    Promise.all([
      loadFaceImage(FACE_TEMPLATE_SRC),
      loadFaceImage(FACE_DAMAGE_BASELINE_SRC),
      ...srcs.map(async (src) => {
        const loaded = await loadFaceImage(src);
        return [src, loaded] as const;
      }),
    ]).then(([liveFace, maleBaseline, ...pairs]) => {
      if (cancelled) return;
      imgRef.current = liveFace;
      maleBaselineRef.current = maleBaseline;
      const map = new Map<string, HTMLImageElement>();
      for (const [src, loaded] of pairs) map.set(src, loaded);
      // Baseline is also in srcs — keep it available but injury lookups use asset.src.
      damageImgsRef.current = map;
      setImageReady(true);
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

  const damagesKey = damages.join(',');

  useEffect(() => {
    if (!imageReady) return;
    redraw();
  }, [damagesKey, imageReady, redraw]);

  if (!texture) return null;

  return (
    <mesh position={placement.center} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
