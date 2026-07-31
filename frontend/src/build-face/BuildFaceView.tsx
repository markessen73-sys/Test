import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_FACE_HAIR_COLOR,
  buildFaceBlankUrl,
  buildFaceHair,
} from './catalog';
import './BuildFaceView.css';

type Props = {
  onClose?: () => void;
};

/**
 * Step 1 of Build a Face: blank head + scrollable hair catalogue (same colour).
 */
export function BuildFaceView({ onClose }: Props) {
  const hairStyles = useMemo(() => buildFaceHair(), []);
  const blankUrl = useMemo(() => buildFaceBlankUrl(), []);
  const [hairId, setHairId] = useState(hairStyles[0]?.id ?? '');
  const previewRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => hairStyles.find((h) => h.id === hairId) ?? hairStyles[0],
    [hairId, hairStyles]
  );

  const paint = useCallback(
    async (hairSrc: string | undefined) => {
      const canvas = previewRef.current;
      if (!canvas || !hairSrc) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load ${src}`));
          img.src = src;
        });

      const [blank, hairImg] = await Promise.all([load(blankUrl), load(hairSrc)]);
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(blank, 0, 0, size, size);
      ctx.drawImage(hairImg, 0, 0, size, size);
    },
    [blankUrl]
  );

  useEffect(() => {
    void paint(selected?.src);
  }, [paint, selected]);

  const scrollStrip = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(280, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className="build-face">
      <header className="build-face-header">
        <div>
          <p className="build-face-kicker">Build a face</p>
          <h1 className="build-face-title">Pick a hair style</h1>
          <p className="build-face-sub">
            Starting from a blank gym face. All styles share the same colour
            <span className="build-face-swatch" style={{ background: BUILD_FACE_HAIR_COLOR }} />
            — scroll to choose the cut.
          </p>
        </div>
        {onClose && (
          <button type="button" className="build-face-close" onClick={onClose}>
            Back to gym
          </button>
        )}
      </header>

      <div className="build-face-stage">
        <canvas ref={previewRef} className="build-face-preview" aria-label="Face preview" />
        <p className="build-face-selected">{selected?.name ?? '—'}</p>
      </div>

      <section className="build-face-catalog" aria-label="Hair styles">
        <div className="build-face-catalog-bar">
          <h2 className="build-face-catalog-title">Hair</h2>
          <div className="build-face-catalog-nav">
            <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(-1)} aria-label="Scroll left">
              ‹
            </button>
            <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(1)} aria-label="Scroll right">
              ›
            </button>
          </div>
        </div>
        <div className="build-face-strip" ref={stripRef} role="listbox" aria-label="Hair catalogue">
          {hairStyles.map((style) => {
            const active = style.id === hairId;
            return (
              <button
                key={style.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`build-face-thumb ${active ? 'is-active' : ''}`}
                onClick={() => setHairId(style.id)}
              >
                <span className="build-face-thumb-art">
                  <img src={blankUrl} alt="" className="build-face-thumb-blank" draggable={false} />
                  <img src={style.src} alt="" className="build-face-thumb-hair" draggable={false} />
                </span>
                <span className="build-face-thumb-name">{style.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
