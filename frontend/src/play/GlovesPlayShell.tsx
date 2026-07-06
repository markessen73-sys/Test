import type { PointerEvent, ReactNode, RefObject } from 'react';
import { ScreenGlove } from './ScreenGlove';
import { SlugTrailCanvas } from './SlugTrailCanvas';
import { useBuildSha } from '../useBuildSha';
import type { GloveState } from '../types/game';
import type { GloveTransform } from './skeleton/types';

export interface GlovesPlayShellProps {
  onBack: () => void;
  title: string;
  punchCount: number;
  hint: ReactNode;
  canvas: ReactNode;
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

  return (
    <div
      className="play-fullscreen"
      ref={rootRef}
      onPointerDown={onRootDown}
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
          <span className="play-title">{title}</span>
          <span className="play-punch-count">{punchCount} punches</span>
          <span className="play-build-tag" title="Build ID — confirms you have the latest code">
            build {buildSha}
          </span>
        </header>

        <footer className="play-bottom">
          <p className="play-hint">{hint}</p>
        </footer>
      </div>
    </div>
  );
}
