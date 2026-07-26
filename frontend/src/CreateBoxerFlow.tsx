import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import { detectFaces, type DetectedFace } from './play/face/custom/faceDetect';
import { createBoxerFromFaceSource } from './play/face/custom/createBoxerPipeline';
import { useCharacter } from './play/face/CharacterContext';
import type { CharacterId } from './play/face/characters';

type Step =
  | 'pick-source'
  | 'detecting'
  | 'pick-face'
  | 'confirm-face'
  | 'name'
  | 'creating'
  | 'error';

interface CreateBoxerFlowProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: CharacterId) => void;
}

export function CreateBoxerFlow({ open, onClose, onCreated }: CreateBoxerFlowProps) {
  const { addCustomPack } = useCharacter();
  const [step, setStep] = useState<Step>('pick-source');
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressRatio, setProgressRatio] = useState(0);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [selectedFace, setSelectedFace] = useState<DetectedFace | null>(null);
  const [name, setName] = useState('');
  const [cameraOn, setCameraOn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const reset = useCallback(() => {
    stopCamera();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setStep('pick-source');
    setError(null);
    setProgressMsg('');
    setProgressRatio(0);
    setSourceUrl(null);
    setSourceImage(null);
    setFaces([]);
    setSelectedFace(null);
    setName('');
    setCameraOn(false);
  }, [sourceUrl]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when closed
  }, [open]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const runDetect = async (img: HTMLImageElement) => {
    setStep('detecting');
    setError(null);
    try {
      const found = await detectFaces(img);
      if (found.length === 0) {
        setError('No face found. Try a clearer front-facing photo.');
        setStep('error');
        return;
      }
      setFaces(found);
      setSourceImage(img);
      if (found.length === 1) {
        setSelectedFace(found[0]);
        setStep('confirm-face');
      } else {
        setSelectedFace(null);
        setStep('pick-face');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Face detection failed');
      setStep('error');
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    stopCamera();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    const img = new Image();
    img.onload = () => void runDetect(img);
    img.onerror = () => {
      setError('Could not read that image.');
      setStep('error');
    };
    img.src = url;
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play();
        }
      });
    } catch {
      setError('Camera access denied or unavailable. Use a photo from your files instead.');
      setStep('error');
    }
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // Mirror selfie so it matches what the user saw.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob((blob) => {
      if (!blob) return;
      void handleFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const confirmSelectedFace = () => {
    if (!selectedFace) return;
    setName((n) => n || `Boxer ${(Math.random() * 90 + 10) | 0}`);
    setStep('name');
  };

  const startCreate = async () => {
    if (!sourceImage || !selectedFace) return;
    setStep('creating');
    setProgressMsg('Starting…');
    setProgressRatio(0);
    try {
      const pack = await createBoxerFromFaceSource({
        sourceImage,
        faceBox: selectedFace.box,
        name: name.trim() || 'Created Boxer',
        onProgress: (msg, ratio) => {
          setProgressMsg(msg);
          setProgressRatio(ratio);
        },
      });
      const def = addCustomPack(pack);
      onCreated(def.id);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create boxer');
      setStep('error');
    }
  };

  if (!open) return null;

  const overlayBox = (face: DetectedFace, idx: number) => {
    if (!sourceImage) return null;
    const w = sourceImage.naturalWidth || sourceImage.width;
    const h = sourceImage.naturalHeight || sourceImage.height;
    const style: CSSProperties = {
      left: `${(face.box.x / w) * 100}%`,
      top: `${(face.box.y / h) * 100}%`,
      width: `${(face.box.width / w) * 100}%`,
      height: `${(face.box.height / h) * 100}%`,
    };
    const selected = selectedFace === face;
    return (
      <button
        key={idx}
        type="button"
        className={`create-boxer-face-box ${selected ? 'is-selected' : ''}`}
        style={style}
        aria-label={`Face ${idx + 1}`}
        aria-pressed={selected}
        onClick={() => setSelectedFace(face)}
      />
    );
  };

  return (
    <div className="create-boxer-overlay" role="dialog" aria-modal="true" aria-label="Create boxer">
      <button type="button" className="options-backdrop" aria-label="Cancel" onClick={() => { reset(); onClose(); }} />
      <div className="create-boxer-panel">
        <header className="options-header">
          <h2 className="options-title">Create boxer</h2>
          <button
            type="button"
            className="options-close"
            onClick={() => {
              reset();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {step === 'pick-source' && (
          <div className="create-boxer-source">
            <p className="options-section-hint">
              Take a selfie or choose a photo. We detect the face, turn it into a cartoon
              caricature (same layout as the built-in boxers), then bake the full pack.
            </p>
            {cameraOn ? (
              <div className="create-boxer-camera">
                <video ref={videoRef} className="create-boxer-video" playsInline muted autoPlay />
                <div className="create-boxer-actions">
                  <button type="button" className="create-boxer-btn primary" onClick={captureSelfie}>
                    Capture
                  </button>
                  <button type="button" className="create-boxer-btn" onClick={stopCamera}>
                    Cancel camera
                  </button>
                </div>
              </div>
            ) : (
              <div className="create-boxer-actions-col">
                <button type="button" className="create-boxer-btn primary" onClick={() => void startCamera()}>
                  <Camera size={18} /> Take selfie
                </button>
                <button type="button" className="create-boxer-btn" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={18} /> Choose photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {step === 'detecting' && (
          <p className="options-section-hint">Detecting faces…</p>
        )}

        {(step === 'pick-face' || step === 'confirm-face') && sourceUrl && (
          <div className="create-boxer-pick">
            <p className="options-section-hint">
              {step === 'pick-face'
                ? 'Multiple faces found — tap the face you want to use.'
                : 'We found this face. Confirm to continue, or cancel and try another photo.'}
            </p>
            <div className="create-boxer-photo-wrap">
              <img ref={imgRef} src={sourceUrl} alt="Uploaded" className="create-boxer-photo" draggable={false} />
              <div className="create-boxer-face-layer">{faces.map((f, i) => overlayBox(f, i))}</div>
            </div>
            <div className="create-boxer-actions">
              <button
                type="button"
                className="create-boxer-btn primary"
                disabled={!selectedFace}
                onClick={confirmSelectedFace}
              >
                {step === 'confirm-face' ? 'Use this face' : 'Continue'}
              </button>
              <button
                type="button"
                className="create-boxer-btn"
                onClick={() => {
                  reset();
                }}
              >
                Different photo
              </button>
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="create-boxer-name">
            <p className="options-section-hint">Name your boxer. They’ll stay under Created Boxers until you delete them.</p>
            <label className="create-boxer-label">
              Name
              <input
                className="create-boxer-input"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <div className="create-boxer-actions">
              <button type="button" className="create-boxer-btn primary" onClick={() => void startCreate()}>
                Create boxer
              </button>
              <button type="button" className="create-boxer-btn" onClick={() => setStep(faces.length > 1 ? 'pick-face' : 'confirm-face')}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'creating' && (
          <div className="create-boxer-progress">
            <p className="options-section-hint">{progressMsg || 'Working…'}</p>
            <div className="create-boxer-progress-track" aria-hidden>
              <div className="create-boxer-progress-bar" style={{ width: `${Math.round(progressRatio * 100)}%` }} />
            </div>
            <p className="options-section-hint" style={{ marginTop: '0.75rem', opacity: 0.85 }}>
              Studio AI caricatures (same look as Default / The Don) need the transform API with
              Replicate or OpenAI keys. Without that, we draw an on-device boxing caricature instead.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="create-boxer-error">
            <p className="options-section-hint">{error || 'Something went wrong.'}</p>
            <div className="create-boxer-actions">
              <button type="button" className="create-boxer-btn primary" onClick={() => reset()}>
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreatedBoxerCardProps {
  id: CharacterId;
  name: string;
  cleanSrc: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function CreatedBoxerCard({ name, cleanSrc, selected, onSelect, onDelete }: CreatedBoxerCardProps) {
  return (
    <div className={`character-select-wrap ${selected ? 'is-selected' : ''}`}>
      <button
        type="button"
        className={`character-select-btn ${selected ? 'is-selected' : ''}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <img className="character-select-face" src={cleanSrc} alt="" draggable={false} />
        <span className="character-select-name">{name}</span>
      </button>
      <button
        type="button"
        className="character-delete-btn"
        aria-label={`Delete ${name}`}
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
