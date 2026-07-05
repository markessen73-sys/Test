import { useCallback, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { useGloveControl } from './useGloveControl';
import type { GloveId } from '../types/game';

interface HeavyBagPlayViewProps {
  onBack: () => void;
}

export function HeavyBagPlayView({ onBack }: HeavyBagPlayViewProps) {
  const [punchCount, setPunchCount] = useState(0);
  const [punchImpulse, setPunchImpulse] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const onPunch = useCallback((glove: GloveId) => {
    setPunchCount((c) => c + 1);
    setPunchImpulse((v) => v + 1);
    setFlash(glove === 'left' ? 'LEFT!' : 'RIGHT!');
    setTimeout(() => setFlash(null), 300);
  }, []);

  const { left, right, handlePointerDown, handlePointerMove, handlePointerUp } =
    useGloveControl(onPunch);

  return (
    <div className="play-fullscreen">
      <div className="play-canvas">
        <HeavyBagPlayScene
          leftPos={left.position}
          rightPos={right.position}
          punchImpulse={punchImpulse}
        />
      </div>

      <SlugTrailCanvas left={left} right={right} />

      {/* Touch layer — drag gloves */}
      <div
        className="play-touch-layer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Glove grab hints (visible when not grabbed) */}
      <div className="play-glove-hints" aria-hidden>
        {!left.pointerId && (
          <div className="glove-hint glove-hint-left" style={{ left: `${left.position.x * 100}%`, top: `${left.position.y * 100}%` }} />
        )}
        {!right.pointerId && (
          <div className="glove-hint glove-hint-right" style={{ left: `${right.position.x * 100}%`, top: `${right.position.y * 100}%` }} />
        )}
      </div>

      <div className="play-ui">
        <header className="play-top">
          <button type="button" className="gym-back-btn" onClick={onBack}>
            ← Back
          </button>
          <span className="play-title">🎯 Heavy Bag</span>
          <span className="play-punch-count">{punchCount} punches</span>
        </header>

        {flash && <div className="punch-flash play-flash">{flash}</div>}

        <footer className="play-bottom">
          <p className="play-hint">
            Touch the <strong>gloves</strong> and drag — slow moves reposition, <strong>quick flicks</strong> punch
          </p>
        </footer>
      </div>
    </div>
  );
}
