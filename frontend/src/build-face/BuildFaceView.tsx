import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_FACE_HAIR_COLORS,
  buildFaceBlankUrl,
  buildFaceHair,
  colorizeHairImageData,
  type HairColor,
} from './catalog';
import './BuildFaceView.css';

type Props = {
  onClose?: () => void;
};

type HairTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_TRANSFORM: HairTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Build a Face — colour → style → stretch / shrink / move into place.
 */
export function BuildFaceView({ onClose }: Props) {
  const hairStyles = useMemo(() => buildFaceHair(), []);
  const blankUrl = useMemo(() => buildFaceBlankUrl(), []);
  const [colorId, setColorId] = useState<string | null>(null);
  const [hairId, setHairId] = useState(hairStyles[0]?.id ?? '');
  const [xform, setXform] = useState<HairTransform>(DEFAULT_TRANSFORM);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const tintCache = useRef<Map<string, string>>(new Map());
  const dragRef = useRef<{
    mode: 'none' | 'swipe' | 'move';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ mode: 'none', startX: 0, startY: 0, origX: 0, origY: 0 });
  const xformRef = useRef(xform);
  xformRef.current = xform;

  const selectedColor: HairColor | undefined = useMemo(
    () => BUILD_FACE_HAIR_COLORS.find((c) => c.id === colorId),
    [colorId]
  );

  const selectedIndex = useMemo(() => {
    const idx = hairStyles.findIndex((h) => h.id === hairId);
    return idx >= 0 ? idx : 0;
  }, [hairId, hairStyles]);

  const selected = hairStyles[selectedIndex] ?? hairStyles[0];

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
      hex: string | undefined,
      transform: HairTransform
    ) => {
      const canvas = previewRef.current;
      if (!canvas || !hairSrc || !hex) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const [blank, tintedSrc] = await Promise.all([
        loadImage(blankUrl),
        tintedHairUrl(hairSrc, hex),
      ]);
      const hairImg = await loadImage(tintedSrc);
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(blank, 0, 0, size, size);

      // Transform around canvas centre so scale/move feel natural.
      const cx = size / 2 + transform.offsetX;
      const cy = size / 2 + transform.offsetY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(hairImg, -size / 2, -size / 2, size, size);
      ctx.restore();
    },
    [blankUrl, tintedHairUrl]
  );

  useEffect(() => {
    if (!selectedColor) return;
    void paint(selected?.src, selectedColor.hex, xform);
  }, [paint, selected, selectedColor, xform]);

  const goStyle = useCallback(
    (dir: -1 | 1) => {
      if (!hairStyles.length) return;
      const next = (selectedIndex + dir + hairStyles.length) % hairStyles.length;
      setHairId(hairStyles[next].id);
      setXform(DEFAULT_TRANSFORM);
    },
    [hairStyles, selectedIndex]
  );

  const selectStyle = (id: string) => {
    setHairId(id);
    setXform(DEFAULT_TRANSFORM);
  };

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const thumb = el.querySelector<HTMLElement>(`[data-hair-id="${hairId}"]`);
    thumb?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [hairId]);

  // Pointer: drag to move hair; short horizontal flick still changes style.
  useEffect(() => {
    if (!selectedColor) return;
    const el = stageRef.current;
    if (!el) return;

    const canvasScale = () => {
      const canvas = previewRef.current;
      if (!canvas) return 1;
      const rect = canvas.getBoundingClientRect();
      return canvas.width / Math.max(rect.width, 1);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore clicks on nav buttons
      if ((e.target as HTMLElement).closest('.build-face-stage-nav')) return;
      const cur = xformRef.current;
      dragRef.current = {
        mode: 'none',
        startX: e.clientX,
        startY: e.clientY,
        origX: cur.offsetX,
        origY: cur.offsetY,
      };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d.mode === 'none' && (Math.abs(e.clientX - d.startX) > 6 || Math.abs(e.clientY - d.startY) > 6)) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        // Prefer move; only treat as swipe if clearly horizontal and little vertical
        d.mode = Math.abs(dx) > Math.abs(dy) * 2.2 && Math.abs(dy) < 14 ? 'swipe' : 'move';
      }
      if (d.mode !== 'move') return;
      const s = canvasScale();
      setXform((prev) => ({
        ...prev,
        offsetX: d.origX + (e.clientX - d.startX) * s,
        offsetY: d.origY + (e.clientY - d.startY) * s,
      }));
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === 'swipe' || (d.mode === 'none' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)) {
        goStyle(dx < 0 ? 1 : -1);
      }
      d.mode = 'none';
    };

    const onPointerCancel = () => {
      dragRef.current.mode = 'none';
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [selectedColor, goStyle]);

  const scrollStrip = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(280, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const onPickColor = (id: string) => {
    setColorId(id);
    if (!hairId) setHairId(hairStyles[0]?.id ?? '');
    setXform(DEFAULT_TRANSFORM);
  };

  return (
    <div className="build-face">
      <header className="build-face-header">
        <div>
          <p className="build-face-kicker">Build a face</p>
          <h1 className="build-face-title">
            {!selectedColor
              ? 'Pick a hair colour'
              : 'Pick a style, then fit it'}
          </h1>
          <p className="build-face-sub">
            {!selectedColor
              ? 'Choose a colour first. Styles unlock once selected.'
              : 'Cycle styles, then stretch, shrink, or drag the hair into place on the head.'}
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
        aria-label={selectedColor ? 'Drag hair to move; swipe to change style' : undefined}
      >
        {selectedColor && (
          <button
            type="button"
            className="build-face-stage-nav is-prev"
            aria-label="Previous style"
            onClick={() => goStyle(-1)}
          >
            ‹
          </button>
        )}
        <div className="build-face-stage-main">
          <canvas ref={previewRef} className="build-face-preview" aria-label="Face preview" />
          <p className="build-face-selected">
            {selectedColor
              ? `${selectedIndex + 1}/30 · ${selected?.name ?? '—'} · ${selectedColor.name}`
              : 'Select a colour to preview styles'}
          </p>
          {selectedColor && (
            <p className="build-face-swipe-hint">Drag to move · swipe for next style</p>
          )}
        </div>
        {selectedColor && (
          <button
            type="button"
            className="build-face-stage-nav is-next"
            aria-label="Next style"
            onClick={() => goStyle(1)}
          >
            ›
          </button>
        )}
      </div>

      {selectedColor && (
        <section className="build-face-fit" aria-label="Fit hair on head">
          <div className="build-face-fit-bar">
            <h2 className="build-face-catalog-title">Fit</h2>
            <button
              type="button"
              className="build-face-nav-btn"
              onClick={() => setXform(DEFAULT_TRANSFORM)}
            >
              Reset
            </button>
          </div>
          <label className="build-face-slider">
            <span>Size</span>
            <input
              type="range"
              min={0.45}
              max={2.4}
              step={0.01}
              value={xform.scale}
              onChange={(e) =>
                setXform((prev) => ({ ...prev, scale: Number(e.target.value) }))
              }
            />
            <span className="build-face-slider-val">{xform.scale.toFixed(2)}×</span>
          </label>
          <label className="build-face-slider">
            <span>Move X</span>
            <input
              type="range"
              min={-280}
              max={280}
              step={1}
              value={xform.offsetX}
              onChange={(e) =>
                setXform((prev) => ({ ...prev, offsetX: Number(e.target.value) }))
              }
            />
            <span className="build-face-slider-val">{Math.round(xform.offsetX)}</span>
          </label>
          <label className="build-face-slider">
            <span>Move Y</span>
            <input
              type="range"
              min={-280}
              max={280}
              step={1}
              value={xform.offsetY}
              onChange={(e) =>
                setXform((prev) => ({ ...prev, offsetY: Number(e.target.value) }))
              }
            />
            <span className="build-face-slider-val">{Math.round(xform.offsetY)}</span>
          </label>
        </section>
      )}

      {selectedColor && (
        <section className="build-face-catalog" aria-label="Hair styles">
          <div className="build-face-catalog-bar">
            <h2 className="build-face-catalog-title">Styles</h2>
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
            {hairStyles.map((style) => (
              <HairThumb
                key={style.id}
                hairId={style.id}
                blankUrl={blankUrl}
                hairSrc={style.src}
                name={style.name}
                active={style.id === hairId}
                colorHex={selectedColor.hex}
                tintedHairUrl={tintedHairUrl}
                onSelect={() => selectStyle(style.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HairThumb({
  hairId,
  blankUrl,
  hairSrc,
  name,
  active,
  colorHex,
  tintedHairUrl,
  onSelect,
}: {
  hairId: string;
  blankUrl: string;
  hairSrc: string;
  name: string;
  active: boolean;
  colorHex: string;
  tintedHairUrl: (src: string, hex: string) => Promise<string>;
  onSelect: () => void;
}) {
  const [tintSrc, setTintSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tintedHairUrl(hairSrc, colorHex).then((url) => {
      if (!cancelled) setTintSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [hairSrc, colorHex, tintedHairUrl]);

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-hair-id={hairId}
      className={`build-face-thumb ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      <span className="build-face-thumb-art">
        <img src={blankUrl} alt="" className="build-face-thumb-blank" draggable={false} />
        {tintSrc && (
          <img src={tintSrc} alt="" className="build-face-thumb-hair" draggable={false} />
        )}
      </span>
      <span className="build-face-thumb-name">{name}</span>
    </button>
  );
}
