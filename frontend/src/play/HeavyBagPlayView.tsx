import { useCallback, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { useGloveControl } from './useGloveControl';
import type { GloveId } from '../types/game';

interface HeavyBagPlayViewProps {
  onBack: () => void;
}

function ScreenGlove({
  side,
  position,
  grabbed,
  onPointerDown,
}: {
  side: GloveId;
  position: { x: number; y: number };
  grabbed: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={`screen-glove screen-glove-${side} ${grabbed ? 'grabbed' : ''}`}
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`${side} glove`}
    >
      <div className="screen-glove-palm" />
      <div className="screen-glove-cuff" />
    </div>
  );
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

  const { left, right, rootRef, onGloveDown, onRootMove, onRootUp } = useGloveControl(onPunch);

  return (
    <div
      className="play-fullscreen"
      ref={rootRef}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      <div className="play-canvas">
        <HeavyBagPlayScene
          leftPos={left.position}
          rightPos={right.position}
          punchImpulse={punchImpulse}
        />
      </div>

      <SlugTrailCanvas left={left} right={right} />

      <div className="play-gloves-layer">
        <ScreenGlove
          side="left"
          position={left.position}
          grabbed={left.pointerId !== null}
          onPointerDown={onGloveDown('left')}
        />
        <ScreenGlove
          side="right"
          position={right.position}
          grabbed={right.pointerId !== null}
          onPointerDown={onGloveDown('right')}
        />
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
            Put fingers on the <strong>gloves</strong> — slow drags reposition, <strong>quick flicks</strong>{' '}
            punch
          </p>
        </footer>
      </div>
    </div>
  );
}
