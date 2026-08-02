import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { type CustomFaceFeatures, type CustomFaceSet, type FaceFeatureMark } from './customFace';
import { bakePhotoDamageStages } from './bakePhotoDamage';
import { synthesizeFaceExpressions } from './faceExpressions';
import './FaceCleanupAnnotateView.css';

type AnnotateStep = 'erase' | 'eyes' | 'nose' | 'mouth' | 'ears';

type Props = {
  /** Initial clean cutout (after auto background removal). */
  cleanSrc: string;
  /** Optional existing ooh/knockout — if omitted, synthesized from cleaned face. */
  oohSrc?: string;
  knockoutSrc?: string;
  onComplete: (faces: CustomFaceSet) => void;
  onCancel: () => void;
};

const STEPS: Array<{
  id: AnnotateStep;
  title: string;
  hint: string;
  color: string | null;
  brush: number;
}> = [
  {
    id: 'erase',
    title: 'Erase leftover background',
    hint: 'Rub out any room, neck, or fringe you don’t want. Leave head and hair.',
    color: null,
    brush: 28,
  },
  {
    id: 'eyes',
    title: 'Highlight both eyes',
    hint: 'Colour over both eyes with the marker — like a highlighter pen.',
    color: '#00e5ff',
    brush: 18,
  },
  {
    id: 'nose',
    title: 'Highlight your nose',
    hint: 'Colour over the nose bridge and tip.',
    color: '#ff9100',
    brush: 16,
  },
  {
    id: 'mouth',
    title: 'Highlight your mouth',
    hint: 'Colour over the lips / mouth opening.',
    color: '#ff1744',
    brush: 18,
  },
  {
    id: 'ears',
    title: 'Highlight both ears',
    hint: 'Colour over both ears (or where they sit at the side of the head).',
    color: '#76ff03',
    brush: 20,
  },
];

const FACE_SIZE = 1024;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load face'));
    img.src = src;
  });
}

function markFromMask(mask: ImageData): FaceFeatureMark | null {
  const { width: w, height: h, data } = mask;
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3] ?? 0;
      if (a < 40) continue;
      sumX += x;
      sumY += y;
      n++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 8) return null;
  const cx = sumX / n / w;
  const cy = sumY / n / h;
  const rx = Math.max(0.03, ((maxX - minX) / w) * 0.55);
  const ry = Math.max(0.025, ((maxY - minY) / h) * 0.55);
  return { cx, cy, rx, ry };
}

/** Split a stroke mask into left/right clusters by x. */
function splitLeftRight(mask: ImageData): { left: FaceFeatureMark | null; right: FaceFeatureMark | null } {
  const { width: w, height: h, data } = mask;
  let sumX = 0;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) < 40) continue;
    const idx = (i - 3) / 4;
    sumX += idx % w;
    n++;
  }
  if (n < 8) return { left: null, right: null };
  const midX = sumX / n;

  const leftData = new ImageData(w, h);
  const rightData = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a < 40) continue;
      const dest = x < midX ? leftData.data : rightData.data;
      dest[i] = data[i]!;
      dest[i + 1] = data[i + 1]!;
      dest[i + 2] = data[i + 2]!;
      dest[i + 3] = a;
    }
  }
  return { left: markFromMask(leftData), right: markFromMask(rightData) };
}

/**
 * Apply cleaned face alpha onto another expression so erased background stays gone.
 */
async function applyCleanAlpha(expressionSrc: string, cleanCanvas: HTMLCanvasElement): Promise<string> {
  const img = await loadImage(expressionSrc);
  const out = document.createElement('canvas');
  out.width = FACE_SIZE;
  out.height = FACE_SIZE;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return expressionSrc;
  ctx.drawImage(img, 0, 0, FACE_SIZE, FACE_SIZE);
  const face = ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE);
  const cleanCtx = cleanCanvas.getContext('2d', { willReadFrequently: true });
  if (!cleanCtx) return expressionSrc;
  const clean = cleanCtx.getImageData(0, 0, FACE_SIZE, FACE_SIZE);
  for (let i = 3; i < face.data.length; i += 4) {
    face.data[i] = Math.min(face.data[i]!, clean.data[i]!);
  }
  ctx.putImageData(face, 0, 0);
  return out.toDataURL('image/png');
}

export function FaceCleanupAnnotateView({
  cleanSrc,
  oohSrc,
  knockoutSrc,
  onComplete,
  onCancel,
}: Props) {
  const faceRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading face…');
  const [ready, setReady] = useState(false);

  // Per-step stroke canvases (offscreen)
  const stepMasks = useRef<Partial<Record<AnnotateStep, HTMLCanvasElement>>>({});

  const step = STEPS[stepIndex]!;

  const ensureStrokeCanvas = useCallback((id: AnnotateStep) => {
    let c = stepMasks.current[id];
    if (!c) {
      c = document.createElement('canvas');
      c.width = FACE_SIZE;
      c.height = FACE_SIZE;
      stepMasks.current[id] = c;
    }
    strokeRef.current = c;
    return c;
  }, []);

  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
    // Draw all completed + current marker layers
    for (const s of STEPS) {
      if (!s.color) continue;
      const m = stepMasks.current[s.id];
      if (!m) continue;
      ctx.globalAlpha = s.id === step.id ? 0.85 : 0.45;
      ctx.drawImage(m, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [step.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(cleanSrc);
        if (cancelled) return;
        const face = faceRef.current;
        const overlay = overlayRef.current;
        if (!face || !overlay) return;
        face.width = FACE_SIZE;
        face.height = FACE_SIZE;
        overlay.width = FACE_SIZE;
        overlay.height = FACE_SIZE;
        const ctx = face.getContext('2d');
        ctx?.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
        ctx?.drawImage(img, 0, 0, FACE_SIZE, FACE_SIZE);
        ensureStrokeCanvas('erase');
        setReady(true);
        setStatus('');
        redrawOverlay();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load face');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cleanSrc, ensureStrokeCanvas, redrawOverlay]);

  useEffect(() => {
    ensureStrokeCanvas(step.id);
    redrawOverlay();
  }, [step.id, ensureStrokeCanvas, redrawOverlay]);

  const canvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FACE_SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * FACE_SIZE;
    return { x, y };
  };

  const paintAt = (x: number, y: number) => {
    const brush = step.brush;
    if (step.id === 'erase') {
      const face = faceRef.current;
      const ctx = face?.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, brush, 0, Math.PI * 2);
      ctx.fill();
      if (lastPt.current) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brush * 2;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(lastPt.current.x, lastPt.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const stroke = ensureStrokeCanvas(step.id);
    const ctx = stroke.getContext('2d');
    if (!ctx || !step.color) return;
    ctx.fillStyle = step.color;
    ctx.strokeStyle = step.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush * 2;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x, y, brush, 0, Math.PI * 2);
    ctx.fill();
    if (lastPt.current) {
      ctx.beginPath();
      ctx.moveTo(lastPt.current.x, lastPt.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    redrawOverlay();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = canvasPoint(e);
    lastPt.current = p;
    paintAt(p.x, p.y);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = canvasPoint(e);
    paintAt(p.x, p.y);
    lastPt.current = p;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    lastPt.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const clearCurrentStroke = () => {
    if (step.id === 'erase') return;
    const stroke = ensureStrokeCanvas(step.id);
    stroke.getContext('2d')?.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
    redrawOverlay();
  };

  const buildFeatures = (): CustomFaceFeatures => {
    const features: CustomFaceFeatures = {};
    const eyes = stepMasks.current.eyes;
    if (eyes) {
      const ctx = eyes.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const { left, right } = splitLeftRight(ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE));
        // image-left → leftEye, image-right → rightEye
        if (left) features.leftEye = left;
        if (right) features.rightEye = right;
      }
    }
    const nose = stepMasks.current.nose;
    if (nose) {
      const ctx = nose.getContext('2d', { willReadFrequently: true });
      const m = ctx && markFromMask(ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE));
      if (m) features.nose = m;
    }
    const mouth = stepMasks.current.mouth;
    if (mouth) {
      const ctx = mouth.getContext('2d', { willReadFrequently: true });
      const m = ctx && markFromMask(ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE));
      if (m) features.mouth = m;
    }
    const ears = stepMasks.current.ears;
    if (ears) {
      const ctx = ears.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const { left, right } = splitLeftRight(ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE));
        if (left) features.leftEar = left;
        if (right) features.rightEar = right;
      }
    }
    return features;
  };

  const finish = async () => {
    const face = faceRef.current;
    if (!face) return;
    setBusy(true);
    setError(null);
    setStatus('Saving cleaned face…');
    try {
      const cleaned = face.toDataURL('image/png');
      const features = buildFeatures();

      setStatus('Building expressions…');
      let ooh = oohSrc;
      let knockout = knockoutSrc;
      if (!ooh || !knockout) {
        const synth = await synthesizeFaceExpressions(cleaned);
        ooh = synth.ooh;
        knockout = synth.knockout;
      } else {
        ooh = await applyCleanAlpha(ooh, face);
        knockout = await applyCleanAlpha(knockout, face);
      }

      setStatus('Placing damage marks…');
      const baked = await bakePhotoDamageStages(cleaned, features, knockout);

      onComplete({
        clean: cleaned,
        ooh,
        knockout,
        features,
        damageStages: baked.stages,
        damageKnockout: baked.knockout,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish face');
      setBusy(false);
      setStatus('');
    }
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    void finish();
  };

  const back = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else onCancel();
  };

  return (
    <div className="face-annotate">
      <div className="face-annotate-copy">
        <p className="face-annotate-step-label">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h2 className="face-annotate-title">{step.title}</h2>
        <p className="face-annotate-hint">{step.hint}</p>
        {step.color && (
          <p className="face-annotate-swatch" style={{ color: step.color }}>
            <span className="face-annotate-swatch-dot" style={{ background: step.color }} />
            Marker ready — drag to colour
          </p>
        )}
      </div>

      <div className="face-annotate-stage">
        <div className="face-annotate-canvas-wrap">
          <canvas ref={faceRef} className="face-annotate-face" />
          <canvas
            ref={overlayRef}
            className="face-annotate-overlay"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>

      {error && <p className="face-capture-error">{error}</p>}
      {status && <p className="face-capture-hint">{status}</p>}

      <div className="face-annotate-bar">
        <button type="button" className="face-capture-secondary" disabled={busy} onClick={back}>
          {stepIndex === 0 ? 'Cancel' : 'Back'}
        </button>
        {step.color && (
          <button
            type="button"
            className="face-capture-secondary"
            disabled={busy || !ready}
            onClick={clearCurrentStroke}
          >
            Clear marks
          </button>
        )}
        <button
          type="button"
          className="face-capture-primary"
          disabled={busy || !ready}
          onClick={next}
        >
          {busy ? status || 'Working…' : stepIndex < STEPS.length - 1 ? 'Next' : 'Save face'}
        </button>
      </div>
    </div>
  );
}
