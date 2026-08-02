import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureMirroredVideoFrame,
  cutOutFace,
  detectFacesInImage,
  type DetectedFace,
} from './faceDetect';
import { writeCustomFaceSet, type CustomFaceSet } from './customFace';
import { FaceCleanupAnnotateView } from './FaceCleanupAnnotateView';
import './FaceCaptureView.css';

type Mode = 'choose' | 'camera' | 'pick-face' | 'annotate' | 'saving' | 'done' | 'error';

type Props = {
  onClose: () => void;
};

function selectDefaultCharacter() {
  try {
    localStorage.setItem('mickeys-gym-character', 'default');
  } catch {
    /* ignore */
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export function FaceCaptureView({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadImgRef = useRef<HTMLImageElement | null>(null);

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
      writeCustomFaceSet(faces);
      selectDefaultCharacter();
      stopCamera();
      setAnnotateClean(null);
      setPreviewSet(faces);
      setMode('done');
    },
    [stopCamera]
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
            {(
              [
                ['Smile', previewSet.clean],
                ['Ooh!', previewSet.ooh],
                ['Sad', previewSet.knockout],
              ] as const
            ).map(([label, src]) => (
              <figure key={label} className="face-capture-result-fig">
                <img src={src} alt={label} className="face-capture-result" />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="face-capture-hint">
            Saved — smile is normal, ooh! is punched, sad is knockout. Damage meter uses your marked
            features.
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
