import { useCallback, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { HitDebugOverlay } from './HitDebugOverlay';
import { ScreenGlove } from './ScreenGlove';
import { useElasticGloves } from './useElasticGloves';
import { useBuildSha } from '../useBuildSha';
import type { GloveId } from '../types/game';

interface HeavyBagPlayViewProps {
  onBack: () => void;
}

export function HeavyBagPlayView({ onBack }: HeavyBagPlayViewProps) {
  const buildSha = useBuildSha(__APP_GIT_SHA__);
  const [punchCount, setPunchCount] = useState(0);
  const [punchImpulse, setPunchImpulse] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const onPunch = useCallback((glove: GloveId) => {
    setPunchCount((c) => c + 1);
    setPunchImpulse((v) => v + 1);
    setFlash(glove === 'left' ? 'LEFT!' : 'RIGHT!');
    setTimeout(() => setFlash(null), 300);
  }, []);

  const {
    left,
    right,
    leftTransform,
    rightTransform,
    leftZoneSrc,
    rightZoneSrc,
    leftKnuckle,
    rightKnuckle,
    rootRef,
    onRootDown,
    onRootMove,
    onRootUp,
  } = useElasticGloves(onPunch);

  return (
    <div
      className="play-fullscreen"
      ref={rootRef}
      onPointerDown={onRootDown}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      <div className="play-canvas">
        <HeavyBagPlayScene punchImpulse={punchImpulse} />
      </div>

      <SlugTrailCanvas left={left} right={right} />

      <HitDebugOverlay leftKnuckle={leftKnuckle} rightKnuckle={rightKnuckle} />

      <div className="play-gloves-layer">
        <ScreenGlove
          side="left"
          position={left.position}
          grabbed={left.pointerId !== null}
          transform={leftTransform}
          zoneSrc={leftZoneSrc}
        />
        <ScreenGlove
          side="right"
          position={right.position}
          grabbed={right.pointerId !== null}
          transform={rightTransform}
          zoneSrc={rightZoneSrc}
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
            build {buildSha}
          </span>
        </header>

        {flash && <div className="punch-flash play-flash">{flash}</div>}

        <footer className="play-bottom">
          <p className="play-hint">
            White outline = bag hit zone. White dots = knuckle impact points.{' '}
            <strong>Upward</strong> drags leave a vapour trail while you hold; release with the dot inside the outline while moving to score.
          </p>
        </footer>
      </div>
    </div>
  );
}
