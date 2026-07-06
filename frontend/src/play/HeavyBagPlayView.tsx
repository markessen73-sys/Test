import { useCallback, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { ScreenGlove } from './ScreenGlove';
import { useElasticGloves } from './useElasticGloves';
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

  const { left, right, leftTransform, rightTransform, rootRef, onGloveDown, onRootMove, onRootUp } =
    useElasticGloves(onPunch);

  return (
    <div
      className="play-fullscreen"
      ref={rootRef}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      <div className="play-canvas">
        <HeavyBagPlayScene punchImpulse={punchImpulse} />
      </div>

      <SlugTrailCanvas left={left} right={right} />

      <div className="play-gloves-layer">
        <ScreenGlove
          side="left"
          position={left.position}
          grabbed={left.pointerId !== null}
          transform={leftTransform}
          onPointerDown={onGloveDown('left')}
        />
        <ScreenGlove
          side="right"
          position={right.position}
          grabbed={right.pointerId !== null}
          transform={rightTransform}
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
          <span className="play-build-tag" title="Build ID — confirms you have the latest code">
            build {__APP_GIT_SHA__}
          </span>
        </header>

        {flash && <div className="punch-flash play-flash">{flash}</div>}

        <footer className="play-bottom">
          <p className="play-hint">
            Drag a <strong>glove</strong> — it snaps back on elastic. <strong>Quick flicks</strong> punch.
          </p>
        </footer>
      </div>
    </div>
  );
}
