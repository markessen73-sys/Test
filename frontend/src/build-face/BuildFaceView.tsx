import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_FACE_HAIR_COLORS,
  buildFaceBlankUrl,
  buildFaceEars,
  buildFaceHair,
  colorizeHairImageData,
  type HairColor,
} from './catalog';
import './BuildFaceView.css';

type Props = {
  onClose?: () => void;
};

type SwipeTarget = 'hair' | 'ears';

/**
 * Build a Face — colour → hair styles → ear styles.
 */
export function BuildFaceView({ onClose }: Props) {
  const hairStyles = useMemo(() => buildFaceHair(), []);
  const earStyles = useMemo(() => buildFaceEars(), []);
  const blankUrl = useMemo(() => buildFaceBlankUrl(), []);
  const [colorId, setColorId] = useState<string | null>(null);
  const [hairId, setHairId] = useState(hairStyles[0]?.id ?? '');
  const [earId, setEarId] = useState(earStyles[0]?.id ?? '');
  /** Ears unlock only after the user confirms a hair style. */
  const [hairConfirmed, setHairConfirmed] = useState(false);
  const [swipeTarget, setSwipeTarget] = useState<SwipeTarget>('hair');
  const previewRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hairStripRef = useRef<HTMLDivElement>(null);
  const earStripRef = useRef<HTMLDivElement>(null);
  const tintCache = useRef<Map<string, string>>(new Map());
  const swipeRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const selectedColor: HairColor | undefined = useMemo(
    () => BUILD_FACE_HAIR_COLORS.find((c) => c.id === colorId),
    [colorId]
  );

  const hairIndex = useMemo(() => {
    const idx = hairStyles.findIndex((h) => h.id === hairId);
    return idx >= 0 ? idx : 0;
  }, [hairId, hairStyles]);

  const earIndex = useMemo(() => {
    const idx = earStyles.findIndex((e) => e.id === earId);
    return idx >= 0 ? idx : 0;
  }, [earId, earStyles]);

  const selectedHair = hairStyles[hairIndex] ?? hairStyles[0];
  const selectedEar = earStyles[earIndex] ?? earStyles[0];
  /** Placeholder ears while browsing hair (before confirm). */
  const previewEar = hairConfirmed ? selectedEar : earStyles[0];
  const earsUnlocked = Boolean(selectedColor && hairConfirmed);

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });

  const tintedHairUrl = useCallback(async (hairSrc: string, hex: string) => {
    const key = `${hairSrc}|${hex}`;
    const cached = tintCache.current.get(key);
    if (cached) return cached;

    const img = await loadImage(hairSrc);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 1024;
    c.height = img.naturalHeight || 1024;
    const ctx = c.getContext('2d');
    if (!ctx) return hairSrc;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    colorizeHairImageData(imageData, hex);
    ctx.putImageData(imageData, 0, 0);
    const url = c.toDataURL('image/png');
    tintCache.current.set(key, url);
    return url;
  }, []);

  const paint = useCallback(
    async (
      hairSrc: string | undefined,
      earSrc: string | undefined,
      hex: string | undefined
    ) => {
      const canvas = previewRef.current;
      if (!canvas || !hairSrc || !hex) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const loads: Promise<HTMLImageElement>[] = [
        loadImage(blankUrl),
        tintedHairUrl(hairSrc, hex).then(loadImage),
      ];
      if (earSrc) loads.push(loadImage(earSrc));
      const [blank, hairImg, earImg] = await Promise.all(loads);
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(blank, 0, 0, size, size);
      if (earImg) ctx.drawImage(earImg, 0, 0, size, size);
      ctx.drawImage(hairImg, 0, 0, size, size);
    },
    [blankUrl, tintedHairUrl]
  );

  useEffect(() => {
    if (!selectedColor) return;
    void paint(selectedHair?.src, previewEar?.src, selectedColor.hex);
  }, [paint, selectedHair, previewEar, selectedColor]);

  const goHair = useCallback(
    (dir: -1 | 1) => {
      if (!hairStyles.length) return;
      const next = (hairIndex + dir + hairStyles.length) % hairStyles.length;
      setHairId(hairStyles[next].id);
      setSwipeTarget('hair');
    },
    [hairStyles, hairIndex]
  );

  const goEar = useCallback(
    (dir: -1 | 1) => {
      if (!earsUnlocked || !earStyles.length) return;
      const next = (earIndex + dir + earStyles.length) % earStyles.length;
      setEarId(earStyles[next].id);
      setSwipeTarget('ears');
    },
    [earStyles, earIndex, earsUnlocked]
  );

  const confirmHair = useCallback(() => {
    if (!selectedColor || !selectedHair) return;
    setHairConfirmed(true);
    setSwipeTarget('ears');
  }, [selectedColor, selectedHair]);

  useEffect(() => {
    const el = hairStripRef.current;
    if (!el) return;
    el.querySelector<HTMLElement>(`[data-hair-id="${hairId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [hairId]);

  useEffect(() => {
    const el = earStripRef.current;
    if (!el) return;
    el.querySelector<HTMLElement>(`[data-ear-id="${earId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [earId]);

  useEffect(() => {
    if (!selectedColor) return;
    const el = stageRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.build-face-stage-nav')) return;
      swipeRef.current = { x: e.clientX, y: e.clientY, active: true };
      el.setPointerCapture(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!swipeRef.current.active) return;
      const dx = e.clientX - swipeRef.current.x;
      const dy = e.clientY - swipeRef.current.y;
      swipeRef.current.active = false;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const dir: -1 | 1 = dx < 0 ? 1 : -1;
      if (swipeTarget === 'ears' && earsUnlocked) goEar(dir);
      else goHair(dir);
    };
    const onPointerCancel = () => {
      swipeRef.current.active = false;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [selectedColor, swipeTarget, earsUnlocked, goHair, goEar]);

  const scrollStrip = (ref: React.RefObject<HTMLDivElement | null>, dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(280, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const onPickColor = (id: string) => {
    setColorId(id);
    if (!hairId) setHairId(hairStyles[0]?.id ?? '');
    if (!earId) setEarId(earStyles[0]?.id ?? '');
    setHairConfirmed(false);
    setSwipeTarget('hair');
  };

  const statusLine = (() => {
    if (!selectedColor) return 'Select a colour to preview styles';
    if (swipeTarget === 'ears' && earsUnlocked) {
      return `${earIndex + 1}/9 · Ears: ${selectedEar?.name ?? '—'} · ${selectedColor.name}`;
    }
    return `${hairIndex + 1}/30 · ${selectedHair?.name ?? '—'} · ${selectedColor.name}`;
  })();

  return (
    <div className="build-face">
      <header className="build-face-header">
        <div>
          <p className="build-face-kicker">Build a face</p>
          <h1 className="build-face-title">
            {!selectedColor
              ? 'Pick a hair colour'
              : earsUnlocked && swipeTarget === 'ears'
                ? 'Pick ear style'
                : 'Pick a hair style'}
          </h1>
          <p className="build-face-sub">
            {!selectedColor
              ? 'Choose a colour first. Hair unlocks once selected.'
              : !hairConfirmed
                ? 'Browse cuts, then tap Select this hair when you are happy — ears unlock next.'
                : 'Swipe for the active catalogue — hair or ears — or tap a thumbnail.'}
          </p>
        </div>
        {onClose && (
          <button type="button" className="build-face-close" onClick={onClose}>
            Back to gym
          </button>
        )}
      </header>

      <section className="build-face-colors" aria-label="Hair colours">
        <h2 className="build-face-catalog-title">Colour</h2>
        <div className="build-face-color-row" role="listbox" aria-label="Hair colour options">
          {BUILD_FACE_HAIR_COLORS.map((c) => {
            const active = c.id === colorId;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`build-face-color-chip ${active ? 'is-active' : ''}`}
                onClick={() => onPickColor(c.id)}
                title={c.name}
              >
                <span className="build-face-color-swatch" style={{ background: c.hex }} />
                <span className="build-face-color-name">{c.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        ref={stageRef}
        className={`build-face-stage ${selectedColor ? 'is-swipeable' : 'is-dimmed'}`}
        aria-label={
          selectedColor
            ? `Swipe left or right to change ${swipeTarget === 'ears' ? 'ear' : 'hair'} style`
            : undefined
        }
      >
        {selectedColor && (
          <button
            type="button"
            className="build-face-stage-nav is-prev"
            aria-label="Previous style"
            onClick={() => (swipeTarget === 'ears' && earsUnlocked ? goEar(-1) : goHair(-1))}
          >
            ‹
          </button>
        )}
        <div className="build-face-stage-main">
          <canvas ref={previewRef} className="build-face-preview" aria-label="Face preview" />
          <p className="build-face-selected">{statusLine}</p>
          {selectedColor && (
            <p className="build-face-swipe-hint">
              Swipe {swipeTarget === 'ears' && earsUnlocked ? 'ears' : 'hair'} · left / right
            </p>
          )}
          {selectedColor && !hairConfirmed && (
            <button type="button" className="build-face-confirm" onClick={confirmHair}>
              Select this hair
            </button>
          )}
        </div>
        {selectedColor && (
          <button
            type="button"
            className="build-face-stage-nav is-next"
            aria-label="Next style"
            onClick={() => (swipeTarget === 'ears' && earsUnlocked ? goEar(1) : goHair(1))}
          >
            ›
          </button>
        )}
      </div>

      {selectedColor && (
        <section
          className={`build-face-catalog ${swipeTarget === 'hair' ? 'is-active-layer' : ''}`}
          aria-label="Hair styles"
          onFocus={() => setSwipeTarget('hair')}
          onPointerDown={() => setSwipeTarget('hair')}
        >
          <div className="build-face-catalog-bar">
            <h2 className="build-face-catalog-title">Hair</h2>
            <div className="build-face-catalog-nav">
              <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(hairStripRef, -1)} aria-label="Scroll hair left">
                ‹
              </button>
              <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(hairStripRef, 1)} aria-label="Scroll hair right">
                ›
              </button>
            </div>
          </div>
          <div className="build-face-strip" ref={hairStripRef} role="listbox" aria-label="Hair catalogue">
            {hairStyles.map((style) => (
              <StyleThumb
                key={style.id}
                dataId={style.id}
                dataAttr="data-hair-id"
                blankUrl={blankUrl}
                overlaySrc={style.src}
                earSrc={previewEar?.src}
                name={style.name}
                active={style.id === hairId}
                colorHex={selectedColor.hex}
                tintedHairUrl={tintedHairUrl}
                onSelect={() => {
                  setHairId(style.id);
                  setSwipeTarget('hair');
                }}
              />
            ))}
          </div>
        </section>
      )}

      {earsUnlocked && (
        <section
          className={`build-face-catalog ${swipeTarget === 'ears' ? 'is-active-layer' : ''}`}
          aria-label="Ear styles"
          onFocus={() => setSwipeTarget('ears')}
          onPointerDown={() => setSwipeTarget('ears')}
        >
          <div className="build-face-catalog-bar">
            <h2 className="build-face-catalog-title">Ears</h2>
            <div className="build-face-catalog-nav">
              <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(earStripRef, -1)} aria-label="Scroll ears left">
                ‹
              </button>
              <button type="button" className="build-face-nav-btn" onClick={() => scrollStrip(earStripRef, 1)} aria-label="Scroll ears right">
                ›
              </button>
            </div>
          </div>
          <div className="build-face-strip" ref={earStripRef} role="listbox" aria-label="Ear catalogue">
            {earStyles.map((style) => (
              <StyleThumb
                key={style.id}
                dataId={style.id}
                dataAttr="data-ear-id"
                blankUrl={blankUrl}
                overlaySrc={selectedHair?.src}
                earSrc={style.src}
                name={style.name}
                active={style.id === earId}
                colorHex={selectedColor!.hex}
                tintedHairUrl={tintedHairUrl}
                onSelect={() => {
                  setEarId(style.id);
                  setSwipeTarget('ears');
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StyleThumb({
  dataId,
  dataAttr,
  blankUrl,
  overlaySrc,
  earSrc,
  name,
  active,
  colorHex,
  tintedHairUrl,
  onSelect,
}: {
  dataId: string;
  dataAttr: 'data-hair-id' | 'data-ear-id';
  blankUrl: string;
  overlaySrc: string | undefined;
  earSrc: string | undefined;
  name: string;
  active: boolean;
  colorHex: string;
  tintedHairUrl: (src: string, hex: string) => Promise<string>;
  onSelect: () => void;
}) {
  const [tintSrc, setTintSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!overlaySrc) {
      setTintSrc(null);
      return;
    }
    void tintedHairUrl(overlaySrc, colorHex).then((url) => {
      if (!cancelled) setTintSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [overlaySrc, colorHex, tintedHairUrl]);

  const attr = { [dataAttr]: dataId };

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      {...attr}
      className={`build-face-thumb ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      <span className="build-face-thumb-art">
        <img src={blankUrl} alt="" className="build-face-thumb-blank" draggable={false} />
        {earSrc && (
          <img src={earSrc} alt="" className="build-face-thumb-hair" draggable={false} />
        )}
        {tintSrc && (
          <img src={tintSrc} alt="" className="build-face-thumb-hair" draggable={false} />
        )}
      </span>
      <span className="build-face-thumb-name">{name}</span>
    </button>
  );
}
