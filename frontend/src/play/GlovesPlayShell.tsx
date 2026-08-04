import type { PointerEvent, ReactNode, RefObject } from 'react';
import { ScreenGlove } from './ScreenGlove';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { unlockGameAudio } from '../gameAudio';
import { useBuildSha } from '../useBuildSha';
import { useGlove } from './GloveContext';
import type { GloveState } from '../types/game';
import type { GloveTransform } from './skeleton/types';

export interface GlovesPlayShellProps {
  onBack: () => void;
  title: string;
  punchCount: number;
  hint: ReactNode;
  canvas: ReactNode;
  /** Optional overlay (e.g. ring damage meter) — rendered inside `.play-ui`. */
  hudExtra?: ReactNode;
  left: GloveState;
  right: GloveState;
  leftTransform: GloveTransform;
  rightTransform: GloveTransform;
  leftZoneSrc: string;
  rightZoneSrc: string;
  rootRef: RefObject<HTMLDivElement>;
  onRootDown: (e: PointerEvent) => void;
  onRootMove: (e: PointerEvent) => void;
  onRootUp: (e: PointerEvent) => void;
}

export function GlovesPlayShell({
  onBack,
  title,
  punchCount,
  hint,
  canvas,
  hudExtra,
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
}: GlovesPlayShellProps) {
  const buildSha = useBuildSha(__APP_GIT_SHA__);
  const { glove } = useGlove();

  const handlePointerDown = (e: PointerEvent) => {
    unlockGameAudio();
    onRootDown(e);
  };

  return (
    <div
      className="play-fullscreen"
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      <div className="play-canvas">{canvas}</div>

      <SlugTrailCanvas left={left} right={right} />

      <div className="play-gloves-layer">
        <ScreenGlove
          side="left"
          position={left.position}
          grabbed={left.pointerId !== null}
          transform={leftTransform}
          zoneSrc={leftZoneSrc}
          skin={glove.skin}
        />
        <ScreenGlove
          side="right"
          position={right.position}
          grabbed={right.pointerId !== null}
          transform={rightTransform}
          zoneSrc={rightZoneSrc}
          skin={glove.skin}
        />
      </div>

      <div className="play-ui">
        <header className="play-top">
          <button type="button" className="gym-back-btn" onClick={onBack}>
            ← Back
          </button>
          <span className="play-title">{title}</span>
          <span className="play-punch-count">{punchCount} punches</span>
          <span className="play-build-tag" title="Build ID — confirms you have the latest code">
            build {buildSha}
          </span>
        </header>

        {hudExtra}

        <footer className="play-bottom">
          <p className="play-hint">{hint}</p>
        </footer>
      </div>
    </div>
  );
}
