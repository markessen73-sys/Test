import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { runFaceEngineCaricature } from './api';

type Phase = 'idle' | 'camera' | 'preview' | 'busy' | 'done' | 'error';

/**
 * Options-panel tester for the standalone face caricature engine.
 * Capture a selfie (or pick a photo) → POST /api/face-engine/caricature → show result.
 */
export function FaceEngineSelfieTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [photoUrl, resultUrl]);

  const startCamera = useCallback(async () => {
    setError(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('camera');
      // Wait a tick so the video element mounts.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
      });
    } catch (err) {
      setPhase('error');
      setError(
        err instanceof Error
          ? `Camera unavailable: ${err.message}. Try “Choose photo” instead.`
          : 'Camera unavailable. Try “Choose photo” instead.'
      );
    }
  }, []);

  const captureSelfie = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror so it matches what the user saw in the preview.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhotoFile(file);
        setPhotoUrl(URL.createObjectURL(blob));
        setPhase('preview');
      },
      'image/jpeg',
      0.92
    );
  }, [photoUrl, stopCamera]);

  const onPickFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      stopCamera();
      setError(null);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoFile(file);
      setPhotoUrl(URL.createObjectURL(file));
      setPhase('preview');
    },
    [photoUrl, stopCamera]
  );

  const runEngine = useCallback(async () => {
    if (!photoFile) return;
    setPhase('busy');
    setError(null);
    setStatus('Sending photo to face engine…');
    try {
      const { blob } = await runFaceEngineCaricature(photoFile, setStatus);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setPhase('done');
      setStatus('Done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Face engine failed');
    }
  }, [photoFile]);

  const reset = useCallback(() => {
    stopCamera();
    setError(null);
    setStatus('');
    setPhotoFile(null);
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhase('idle');
  }, [stopCamera]);

  return (
    <section className="options-section face-engine-test">
      <h3 className="options-section-title">Test face engine</h3>
      <p className="options-section-hint">
        Take a selfie (or choose a photo). The background engine converts facial features into a
        Mickey&apos;s Gym flat caricature — no OpenAI required.
      </p>

      <div className="face-engine-actions">
        {phase !== 'camera' && (
          <button type="button" className="face-engine-btn" onClick={() => void startCamera()}>
            Take selfie
          </button>
        )}
        <button
          type="button"
          className="face-engine-btn face-engine-btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose photo
        </button>
        {(phase === 'preview' || phase === 'done' || phase === 'error') && (
          <button type="button" className="face-engine-btn face-engine-btn-secondary" onClick={reset}>
            Reset
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={onPickFile}
        />
      </div>

      {phase === 'camera' && (
        <div className="face-engine-camera">
          <video ref={videoRef} className="face-engine-video" playsInline muted autoPlay />
          <button type="button" className="face-engine-btn" onClick={captureSelfie}>
            Capture
          </button>
          <button type="button" className="face-engine-btn face-engine-btn-secondary" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      <canvas ref={canvasRef} hidden />

      {(photoUrl || resultUrl) && (
        <div className="face-engine-compare">
          {photoUrl && (
            <figure className="face-engine-shot">
              <img src={photoUrl} alt="Your photo" />
              <figcaption>Photo</figcaption>
            </figure>
          )}
          {resultUrl && (
            <figure className="face-engine-shot">
              <img src={resultUrl} alt="Caricature result" />
              <figcaption>Caricature</figcaption>
            </figure>
          )}
        </div>
      )}

      {phase === 'preview' && (
        <button type="button" className="face-engine-btn face-engine-btn-primary" onClick={() => void runEngine()}>
          Run face engine
        </button>
      )}

      {phase === 'busy' && <p className="face-engine-status">{status || 'Working…'}</p>}
      {error && <p className="face-engine-error">{error}</p>}
    </section>
  );
}
