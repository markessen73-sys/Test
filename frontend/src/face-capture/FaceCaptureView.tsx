import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureMirroredVideoFrame,
  cutOutFace,
  detectFacesInImage,
  type DetectedFace,
} from './faceDetect';
import { addCustomFace, type CustomFaceSet } from './customFace';
import { FaceCleanupAnnotateView } from './FaceCleanupAnnotateView';
import {
  drawPopEyesZoom,
  popEyeScaleForHit,
  sampleSkinNearEyes,
} from './popEyes';
import { useCharacter } from '../play/face/CharacterContext';
import './FaceCaptureView.css';

type Mode = 'choose' | 'camera' | 'pick-face' | 'annotate' | 'saving' | 'done' | 'error';

type Props = {
  onClose: () => void;
};

const PREVIEW_OOH_MS = 900;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Looping preview of ooh mouth + eyes zooming ½→full. */
function OohPopPreview({ faces }: { faces: CustomFaceSet }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const left = faces.features?.leftEye;
  const right = faces.features?.rightEye;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let frame = 0;
    let start = performance.now();

    void (async () => {
      const img = await loadImage(faces.ooh);
      if (cancelled) return;
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let skin = { r: 180, g: 140, b: 120 };
      if (left && right) {
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth || img.width;
        tmp.height = img.naturalHeight || img.height;
        const tctx = tmp.getContext('2d', { willReadFrequently: true });
        if (tctx) {
          tctx.drawImage(img, 0, 0);
          skin = sampleSkinNearEyes(
            tctx.getImageData(0, 0, tmp.width, tmp.height),
            left,
            right,
          );
        }
      }

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const age = (now - start) % PREVIEW_OOH_MS;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        if (left && right) {
          const scale = popEyeScaleForHit(age, PREVIEW_OOH_MS) ?? 1;
          drawPopEyesZoom(ctx, left, right, size, size, scale, skin);
        }
      };
      start = performance.now();
      frame = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [faces.ooh, left, right]);

  return <canvas ref={canvasRef} className="face-capture-result" aria-label="Ooh!" />;
}

export function FaceCaptureView({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadImgRef = useRef<HTMLImageElement | null>(null);
  const { setCharacterId, refreshPhotoFaces } = useCharacter();

  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState<string | null>(null);
  const [previewSet, setPreviewSet] = useState<CustomFaceSet | null>(null);
  const [candidateFaces, setCandidateFaces] = useState<DetectedFace[]>([]);
  const [status, setStatus] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  /** Clean cutout ready for erase + marker annotate (ooh/sad made after). */
  const [annotateClean, setAnnotateClean] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    stopCamera();
    setPreviewSet(null);
    setAnnotateClean(null);
    setStatus('Starting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setMode('camera');
      setStatus('');
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

  const beginAnnotate = useCallback(
    (clean: string) => {
      stopCamera();
      setAnnotateClean(clean);
      setMode('annotate');
      setStatus('');
    },
    [stopCamera]
  );

  const finishWithFaces = useCallback(
    (faces: CustomFaceSet) => {
      const entry = addCustomFace(faces);
      // Select in React state + storage, then reload library so popEyes are live.
      setCharacterId(entry.id);
      refreshPhotoFaces();
      stopCamera();
      setAnnotateClean(null);
      setPreviewSet(faces);
      setMode('done');
    },
    [stopCamera, setCharacterId, refreshPhotoFaces]
  );

  const captureSelfie = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setMode('saving');
    setStatus('Finding your face…');
    setError(null);
    try {
      const frame = captureMirroredVideoFrame(video);
      setStatus('Removing background…');
      const dataUrl = await cutOutFace(frame);
      beginAnnotate(dataUrl);
    } catch (err) {
      setMode('camera');
      setStatus('');
      setError(err instanceof Error ? err.message : 'Could not capture face');
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (v && streamRef.current) {
          v.srcObject = streamRef.current;
          void v.play();
        }
      });
    }
  }, [beginAnnotate]);

  const onPickFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      stopCamera();
      setError(null);
      setPreviewSet(null);
      setAnnotateClean(null);
      setMode('saving');
      setStatus('Looking for faces…');
      try {
        const url = URL.createObjectURL(file);
        const img = await loadImage(url);
        URL.revokeObjectURL(url);
        uploadImgRef.current = img;
        const faces = await detectFacesInImage(img);
        if (!faces.length) {
          throw new Error('No face found in that photo. Try another one.');
        }
        if (faces.length === 1) {
          setStatus('Removing background…');
          const cut = await cutOutFace(img, faces[0]);
          beginAnnotate(cut);
          return;
        }
        setCandidateFaces(faces);
        setStatus('');
        setMode('pick-face');
      } catch (err) {
        setMode('error');
        setError(err instanceof Error ? err.message : 'Could not read that photo');
        setStatus('');
      }
    },
    [beginAnnotate, stopCamera]
  );

  const chooseUploadFace = useCallback(
    async (face: DetectedFace) => {
      const img = uploadImgRef.current;
      if (!img) return;
      setMode('saving');
      setStatus('Removing background…');
      try {
        const cut = await cutOutFace(img, face);
        setCandidateFaces([]);
        beginAnnotate(cut);
      } catch (err) {
        setMode('error');
        setError(err instanceof Error ? err.message : 'Could not cut out that face');
        setStatus('');
      }
    },
    [beginAnnotate]
  );

  const goGymWithFace = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('builder');
    window.location.href = url.pathname + url.search + url.hash;
  };

  const showCameraChrome = cameraActive && (mode === 'camera' || mode === 'saving');

  return (
    <div
      className={`face-capture ${showCameraChrome ? 'has-confirm-bar' : ''} ${mode === 'annotate' ? 'is-annotating' : ''}`}
    >
      <header className="face-capture-header">
        <button type="button" className="face-capture-back" onClick={onClose}>
          ← Back to gym
        </button>
        <div className="face-capture-titles">
          <h1 className="face-capture-title">Your face</h1>
          <p className="face-capture-sub">
            Take a selfie or upload a photo. Erase leftovers, mark eyes, nose, mouth, and ears — then
            we build your punched and knockout faces.
          </p>
        </div>
      </header>

      {mode === 'choose' && (
        <div className="face-capture-choose">
          <button type="button" className="face-capture-primary" onClick={() => void startCamera()}>
            Take a selfie
          </button>
          <label className="face-capture-primary face-capture-file-label">
            Upload photo
            <input
              type="file"
              accept="image/*"
              className="face-capture-file"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {showCameraChrome && (
        <>
          <div className="face-capture-stage">
            <video ref={videoRef} className="face-capture-video" playsInline muted autoPlay />
          </div>

          <div className="face-capture-selfie-steps">
            <p className="face-capture-hint face-capture-selfie-prompt">
              {mode === 'saving' ? status || 'Saving…' : 'Look at the camera — smile for your normal face.'}
            </p>
            {error && mode === 'camera' && <p className="face-capture-error">{error}</p>}
          </div>

          <div className="face-capture-confirm-bar">
            <button
              type="button"
              className="face-capture-ok"
              disabled={mode === 'saving'}
              onClick={() => void captureSelfie()}
            >
              {mode === 'saving' ? status || 'Working…' : 'Capture smile'}
            </button>
            <div className="face-capture-confirm-secondary">
              <button
                type="button"
                className="face-capture-secondary"
                disabled={mode === 'saving'}
                onClick={() => {
                  stopCamera();
                  setError(null);
                  setMode('choose');
                }}
              >
                Start over
              </button>
            </div>
          </div>
        </>
      )}

      {mode === 'pick-face' && (
        <div className="face-capture-pick">
          <p className="face-capture-selfie-prompt">We found {candidateFaces.length} faces — tap yours.</p>
          <div className="face-capture-pick-grid">
            {candidateFaces.map((face, i) => (
              <button
                key={`${face.x}-${face.y}-${i}`}
                type="button"
                className="face-capture-pick-card"
                onClick={() => void chooseUploadFace(face)}
              >
                <img src={face.previewUrl} alt={`Face ${i + 1}`} />
                <span>Face {i + 1}</span>
              </button>
            ))}
          </div>
          <button type="button" className="face-capture-secondary" onClick={() => setMode('choose')}>
            Start over
          </button>
        </div>
      )}

      {mode === 'annotate' && annotateClean && (
        <FaceCleanupAnnotateView
          cleanSrc={annotateClean}
          onComplete={finishWithFaces}
          onCancel={() => {
            setAnnotateClean(null);
            setMode('choose');
          }}
        />
      )}

      {mode === 'saving' && !cameraActive && (
        <div className="face-capture-actions">
          <span className="face-capture-hint">{status || 'Saving…'}</span>
        </div>
      )}

      {mode === 'done' && previewSet && (
        <div className="face-capture-done">
          <div className="face-capture-result-row">
            <figure className="face-capture-result-fig">
              <img src={previewSet.clean} alt="Smile" className="face-capture-result" />
              <figcaption>Smile</figcaption>
            </figure>
            <figure className="face-capture-result-fig">
              <OohPopPreview faces={previewSet} />
              <figcaption>Ooh!</figcaption>
            </figure>
            <figure className="face-capture-result-fig">
              <img src={previewSet.knockout} alt="Sad" className="face-capture-result" />
              <figcaption>Sad</figcaption>
            </figure>
          </div>
          <p className="face-capture-hint">
            Saved as a new photo face — on a punch, eyes zoom forward from half size. Pick or delete
            faces anytime in Options.
          </p>
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
