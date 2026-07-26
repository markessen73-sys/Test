import { useCallback, useRef, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { ScreenGlove } from './ScreenGlove';
import { useElasticGloves } from './useElasticGloves';
import { useBuildSha } from '../useBuildSha';
import type { BagPunchImpact } from './bagImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface HeavyBagPlayViewProps {
  onBack: () => void;
}

export function HeavyBagPlayView({ onBack }: HeavyBagPlayViewProps) {
  const buildSha = useBuildSha(__APP_GIT_SHA__);
  const [punchCount, setPunchCount] = useState(0);
  const [impacts, setImpacts] = useState<BagPunchImpact[]>([]);
  const impactIdRef = useRef(0);
  const bagZoneOffsetRef = useRef<GlovePosition>({ x: 0, y: 0 });

  const onPunch = useCallback((glove: GloveId, knuckle: GlovePosition) => {
    setPunchCount((c) => c + 1);
    impactIdRef.current += 1;
    setImpacts((prev) => [
      ...prev,
      { id: impactIdRef.current, glove, knuckle, time: performance.now() },
    ]);
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
  } = useElasticGloves(onPunch, bagZoneOffsetRef);

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
        <HeavyBagPlayScene impacts={impacts} bagZoneOffsetRef={bagZoneOffsetRef} />
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

        <footer className="play-bottom">
          <p className="play-hint">
            <strong>Upward</strong> drags leave a vapour trail while you hold; release on the bag while still moving to score.
          </p>
        </footer>
      </div>
    </div>
  );
}
