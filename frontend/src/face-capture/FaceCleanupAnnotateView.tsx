import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { type CustomFaceFeatures, type CustomFaceSet, type FaceFeatureMark } from './customFace';
import { synthesizeFaceExpressions } from './faceExpressions';
import './FaceCleanupAnnotateView.css';

type AnnotateStep = 'erase' | 'eyes' | 'nose' | 'mouth' | 'ears';

type Props = {
  /** Initial clean cutout (after auto background removal). */
  cleanSrc: string;
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
    brush: 36,
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
const BRUSH_MIN = 8;
const BRUSH_MAX = 96;

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
  let n = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3] ?? 0;
      if (a < 40) continue;
      n++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 8) return null;
  // Use the geometric centre of the highlighted area (not alpha-weighted centroid)
  const cx = (minX + maxX) / 2 / w;
  const cy = (minY + maxY) / 2 / h;
  const rx = Math.max(0.03, ((maxX - minX) / w) * 0.5);
  const ry = Math.max(0.025, ((maxY - minY) / h) * 0.5);
  return { cx, cy, rx, ry };
}

/** Split a stroke mask into left/right eye clusters (2-means on x). */
function splitLeftRight(mask: ImageData): { left: FaceFeatureMark | null; right: FaceFeatureMark | null } {
  const { width: w, height: h, data } = mask;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) < 40) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < 8) return { left: null, right: null };

  let c0 = Math.min(...xs);
  let c1 = Math.max(...xs);
  for (let iter = 0; iter < 8; iter++) {
    let s0 = 0;
    let n0 = 0;
    let s1 = 0;
    let n1 = 0;
    for (const x of xs) {
      if (Math.abs(x - c0) <= Math.abs(x - c1)) {
        s0 += x;
        n0++;
      } else {
        s1 += x;
        n1++;
      }
    }
    if (n0) c0 = s0 / n0;
    if (n1) c1 = s1 / n1;
  }
  const leftCenter = Math.min(c0, c1);
  const rightCenter = Math.max(c0, c1);
  // If both eyes collapsed to one cluster, fall back to mid split
  const sep = rightCenter - leftCenter;
  const useMid = sep < w * 0.06;
  const midX = useMid ? xs.reduce((a, b) => a + b, 0) / xs.length : (leftCenter + rightCenter) / 2;

  const leftData = new ImageData(w, h);
  const rightData = new ImageData(w, h);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    const dest = x < midX ? leftData.data : rightData.data;
    const pi = (y * w + x) * 4;
    dest[pi] = data[pi]!;
    dest[pi + 1] = data[pi + 1]!;
    dest[pi + 2] = data[pi + 2]!;
    dest[pi + 3] = data[pi + 3]!;
  }
  return { left: markFromMask(leftData), right: markFromMask(rightData) };
}

export function FaceCleanupAnnotateView({ cleanSrc, onComplete, onCancel }: Props) {
  const faceRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const loadedSrc = useRef<string | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading face…');
  const [ready, setReady] = useState(false);
  const [brushSizes, setBrushSizes] = useState<Record<AnnotateStep, number>>(() =>
    Object.fromEntries(STEPS.map((s) => [s.id, s.brush])) as Record<AnnotateStep, number>,
  );
  const [wrapWidth, setWrapWidth] = useState(320);
  const [canvasCssSize, setCanvasCssSize] = useState(320);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Per-step stroke canvases (offscreen)
  const stepMasks = useRef<Partial<Record<AnnotateStep, HTMLCanvasElement>>>({});

  const step = STEPS[stepIndex]!;
  const isErase = step.id === 'erase';
  const brushSize = brushSizes[step.id] ?? step.brush;

  const setBrushSize = (value: number) => {
    setBrushSizes((prev) => ({ ...prev, [step.id]: value }));
  };

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
    for (const s of STEPS) {
      if (!s.color) continue;
      const m = stepMasks.current[s.id];
      if (!m) continue;
      ctx.globalAlpha = s.id === step.id ? 0.85 : 0.45;
      ctx.drawImage(m, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [step.id]);

  // Load face ONCE per cleanSrc — do not reload when step/overlay changes (that wiped erasures).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loadedSrc.current === cleanSrc && faceRef.current) {
        setReady(true);
        setStatus('');
        return;
      }
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
        loadedSrc.current = cleanSrc;
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
    // intentionally only cleanSrc — redrawOverlay/ensureStrokeCanvas must not retrigger a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanSrc]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sync = () => {
      const size = Math.max(160, Math.floor(Math.min(stage.clientWidth, stage.clientHeight, 520)));
      setCanvasCssSize(size);
      setWrapWidth(size);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [ready, stepIndex]);

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

  const updateCursorFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    });
  };

  const paintAt = (x: number, y: number) => {
    const brush = brushSize;
    if (isErase) {
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
    updateCursorFromEvent(e);
    const p = canvasPoint(e);
    lastPt.current = p;
    paintAt(p.x, p.y);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    updateCursorFromEvent(e);
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

  const onPointerLeave = () => {
    if (!drawing.current) setCursor((c) => ({ ...c, visible: false }));
  };

  const clearCurrentStroke = () => {
    if (isErase) return;
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

      setStatus('Making ooh & sad faces…');
      const synth = await synthesizeFaceExpressions(cleaned, features);

      onComplete({
        clean: cleaned,
        ooh: synth.ooh,
        knockout: synth.knockout,
        features,
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

  // Cursor ring size in CSS pixels (scale from canvas coords); keep a readable minimum
  const cursorPx = Math.max(22, (brushSize / FACE_SIZE) * wrapWidth * 2);
  const previewPx = Math.max(18, Math.min(72, brushSize * 0.85));

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
        <div className="face-annotate-brush-controls">
          <span
            className={`face-annotate-brush-preview ${isErase ? 'is-eraser' : 'is-marker'}`}
            style={{
              width: previewPx,
              height: previewPx,
              borderColor: isErase ? 'rgba(255,255,255,0.95)' : step.color || '#fff',
              background: isErase
                ? 'rgba(255, 80, 80, 0.28)'
                : step.color
                  ? `${step.color}55`
                  : 'rgba(255,255,255,0.2)',
              boxShadow: step.color ? `0 0 0 2px ${step.color}88` : undefined,
            }}
            title={`Brush size ${brushSize}`}
            aria-hidden
          />
          <label className="face-annotate-brush-label" htmlFor="brush-size">
            {isErase ? 'Eraser size' : 'Highlighter size'}
          </label>
          <input
            id="brush-size"
            className="face-annotate-brush-range"
            type="range"
            min={BRUSH_MIN}
            max={BRUSH_MAX}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={step.color ? { accentColor: step.color } : undefined}
          />
          <span className="face-annotate-brush-value">{brushSize}</span>
        </div>
      </div>

      <div ref={stageRef} className="face-annotate-stage">
        <div
          ref={wrapRef}
          className="face-annotate-canvas-wrap"
          style={{ width: canvasCssSize, height: canvasCssSize }}
        >
          <canvas ref={faceRef} className="face-annotate-face" />
          <canvas
            ref={overlayRef}
            className="face-annotate-overlay"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onPointerEnter={updateCursorFromEvent}
          />
          {cursor.visible && (
            <div
              className={`face-annotate-cursor ${isErase ? 'is-eraser' : 'is-marker'}`}
              style={{
                width: cursorPx,
                height: cursorPx,
                left: cursor.x,
                top: cursor.y,
                borderColor: isErase ? 'rgba(255,255,255,0.95)' : step.color || '#fff',
                background: isErase
                  ? 'rgba(255, 80, 80, 0.18)'
                  : step.color
                    ? `${step.color}33`
                    : 'transparent',
              }}
              aria-hidden
            />
          )}
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
