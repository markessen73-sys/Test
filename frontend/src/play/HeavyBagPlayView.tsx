import { useCallback, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
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
            Touch your <strong>half of the screen</strong> to move a glove.{' '}
            <strong>Upward</strong> drags leave a vapour trail while you hold; <strong>release with the top of the glove on the bag while moving</strong> to score a hit.
          </p>
        </footer>
      </div>
    </div>
  );
}
