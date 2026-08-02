import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FACE_GUIDE_MASK_SRC,
  FACE_GUIDE_OUTLINE_SRC,
  FACE_GUIDE_SIZE,
} from './guide';
import { writeCustomFaceDataUrl } from './customFace';
import './FaceCaptureView.css';

type Mode = 'choose' | 'camera' | 'upload' | 'saving' | 'done' | 'error';

type Props = {
  onClose: () => void;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Cover-fit source into a square (mirrors selfie display). */
function drawCoverMirrored(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  size: number
) {
  const scale = Math.max(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  ctx.save();
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0, sw, sh, size - dx - dw, dy, dw, dh);
  ctx.restore();
}

/** Draw photo with pan/zoom into square guide space (center origin). */
function drawPhotoTransformed(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  scale: number,
  panX: number,
  panY: number
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max(size / iw, size / ih);
  const s = base * scale;
  const dw = iw * s;
  const dh = ih * s;
  const dx = (size - dw) / 2 + panX * size;
  const dy = (size - dh) / 2 + panY * size;
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
}

async function applyHeadMask(canvas: HTMLCanvasElement): Promise<string> {
  const mask = await loadImage(FACE_GUIDE_MASK_SRC);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0, FACE_GUIDE_SIZE, FACE_GUIDE_SIZE);
  ctx.globalCompositeOperation = 'source-over';
  return canvas.toDataURL('image/png');
}

export function FaceCaptureView({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [photoUrl, previewUrl]);

  const startCamera = useCallback(async () => {
    setError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode('camera');
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
      });
    } catch (err) {
      setMode('error');
      setError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Try uploading a photo instead.`
          : 'Camera unavailable. Try uploading a photo instead.'
      );
    }
  }, [stopCamera]);

  const onPickFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      stopCamera();
      setError(null);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setScale(1);
      setPanX(0);
      setPanY(0);
      setMode('upload');
      const img = new Image();
      img.onload = () => {
        photoRef.current = img;
      };
      img.src = url;
    },
    [photoUrl, stopCamera]
  );

  const saveFromCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setMode('saving');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = FACE_GUIDE_SIZE;
      canvas.height = FACE_GUIDE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      drawCoverMirrored(ctx, video, vw, vh, FACE_GUIDE_SIZE);
      const dataUrl = await applyHeadMask(canvas);
      writeCustomFaceDataUrl(dataUrl);
      try {
        localStorage.setItem('mickeys-gym-character', 'default');
      } catch {
        /* ignore */
      }
      stopCamera();
      setPreviewUrl(dataUrl);
      setMode('done');
    } catch (err) {
      setMode('error');
      setError(err instanceof Error ? err.message : 'Could not save face');
    }
  }, [stopCamera]);

  const saveFromUpload = useCallback(async () => {
    const img = photoRef.current;
    if (!img) return;
    setMode('saving');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = FACE_GUIDE_SIZE;
      canvas.height = FACE_GUIDE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      drawPhotoTransformed(ctx, img, FACE_GUIDE_SIZE, scale, panX, panY);
      const dataUrl = await applyHeadMask(canvas);
      writeCustomFaceDataUrl(dataUrl);
      try {
        localStorage.setItem('mickeys-gym-character', 'default');
      } catch {
        /* ignore */
      }
      setPreviewUrl(dataUrl);
      setMode('done');
    } catch (err) {
      setMode('error');
      setError(err instanceof Error ? err.message : 'Could not save face');
    }
  }, [panX, panY, scale]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'upload') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX, panY };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || mode !== 'upload') return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - drag.x) / rect.width;
    const dy = (e.clientY - drag.y) / rect.height;
    setPanX(drag.panX + dx);
    setPanY(drag.panY + dy);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const goGymWithFace = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('builder');
    window.location.href = url.pathname + url.search + url.hash;
  };

  const photoTransform =
    photoUrl && (mode === 'upload' || mode === 'saving')
      ? `translate(${panX * 100}%, ${panY * 100}%) scale(${scale})`
      : undefined;

  return (
    <div className="face-capture">
      <header className="face-capture-header">
        <button type="button" className="face-capture-back" onClick={onClose}>
          ← Back to gym
        </button>
        <div className="face-capture-titles">
          <h1 className="face-capture-title">Fit your face</h1>
          <p className="face-capture-sub">
            Line up your head inside the yellow outline — then save.
          </p>
        </div>
      </header>

      {mode === 'choose' && (
        <div className="face-capture-choose">
          <button type="button" className="face-capture-primary" onClick={() => void startCamera()}>
            Take selfie
          </button>
          <label className="face-capture-primary face-capture-file-label">
            Upload photo
            <input
              type="file"
              accept="image/*"
              className="face-capture-file"
              onChange={(e) => {
                onPickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {(mode === 'camera' || mode === 'upload' || mode === 'saving') && (
        <>
          <div
            ref={stageRef}
            className={`face-capture-stage ${mode === 'upload' ? 'is-draggable' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {mode === 'camera' || (mode === 'saving' && !photoUrl) ? (
              <video ref={videoRef} className="face-capture-video" playsInline muted autoPlay />
            ) : (
              photoUrl && (
                <img
                  src={photoUrl}
                  alt=""
                  className="face-capture-photo"
                  style={{ transform: photoTransform }}
                  draggable={false}
                />
              )
            )}
            <div className="face-capture-vignette" aria-hidden />
            <img src={FACE_GUIDE_OUTLINE_SRC} alt="" className="face-capture-guide" draggable={false} />
          </div>

          {mode === 'upload' && (
            <div className="face-capture-zoom">
              <label className="face-capture-zoom-label">
                Zoom
                <input
                  type="range"
                  min={0.6}
                  max={2.4}
                  step={0.01}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
              </label>
              <p className="face-capture-hint">Drag the photo to move it. Zoom until your head fills the outline.</p>
            </div>
          )}

          {mode === 'camera' && (
            <p className="face-capture-hint">Fit your face inside the outline, then capture.</p>
          )}

          <div className="face-capture-actions">
            {mode === 'camera' && (
              <button type="button" className="face-capture-primary" onClick={() => void saveFromCamera()}>
                Capture &amp; save
              </button>
            )}
            {mode === 'upload' && (
              <button type="button" className="face-capture-primary" onClick={() => void saveFromUpload()}>
                Save face
              </button>
            )}
            {mode === 'saving' && <span className="face-capture-hint">Saving…</span>}
            <button
              type="button"
              className="face-capture-secondary"
              onClick={() => {
                stopCamera();
                setMode('choose');
              }}
            >
              Start over
            </button>
          </div>
        </>
      )}

      {mode === 'done' && previewUrl && (
        <div className="face-capture-done">
          <img src={previewUrl} alt="Saved face" className="face-capture-result" />
          <p className="face-capture-hint">Saved. Your face will show on the gym boxer.</p>
          <button type="button" className="face-capture-primary" onClick={goGymWithFace}>
            Back to gym
          </button>
        </div>
      )}

      {mode === 'error' && (
        <div className="face-capture-done">
          <p className="face-capture-error">{error}</p>
          <button type="button" className="face-capture-primary" onClick={() => setMode('choose')}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
