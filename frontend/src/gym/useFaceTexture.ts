import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  drawFaceOnCanvas,
  loadImage,
  lerpState,
  reactionForPunch,
  type FaceCanvasState,
} from './faceReactions';
import type { PunchType } from '../types/game';

const DEFAULT_STATE: FaceCanvasState = {
  squashX: 1,
  squashY: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  stars: false,
  spiral: false,
  redCheeks: false,
  blackEye: false,
  tongueOut: false,
};

interface UseFaceTextureOptions {
  caricatureUrl: string;
  punchType: PunchType | null;
  combo: number;
}

export function useFaceTexture({ caricatureUrl, punchType, combo }: UseFaceTextureOptions) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<FaceCanvasState>(DEFAULT_STATE);
  const targetRef = useRef<FaceCanvasState>(DEFAULT_STATE);
  const animRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    loadImage(caricatureUrl).then((img) => {
      if (!cancelled) imageRef.current = img;
    });
    return () => {
      cancelled = true;
    };
  }, [caricatureUrl]);

  useEffect(() => {
    if (punchType) {
      targetRef.current = reactionForPunch(punchType, combo);
    } else {
      targetRef.current = DEFAULT_STATE;
    }
  }, [punchType, combo]);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    setTexture(tex);

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const img = imageRef.current;
      const c = canvasRef.current;
      if (!img || !c) return;

      stateRef.current = lerpState(stateRef.current, targetRef.current, 0.12);
      const ctx = c.getContext('2d')!;
      drawFaceOnCanvas(ctx, img, stateRef.current, 512);
      tex.needsUpdate = true;
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      tex.dispose();
    };
  }, [caricatureUrl]);

  return texture;
}
