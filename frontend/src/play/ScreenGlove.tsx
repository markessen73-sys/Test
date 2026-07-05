import { useState } from 'react';
import type { GloveId } from '../types/game';
import { gloveImageCandidates } from './gloveAssets';

function ScreenGlove({
  side,
  position,
  grabbed,
  atMaxReach,
  angle,
  onPointerDown,
}: {
  side: GloveId;
  position: { x: number; y: number };
  grabbed: boolean;
  atMaxReach?: boolean;
  angle?: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const candidates = gloveImageCandidates(side);
  const [srcIndex, setSrcIndex] = useState(0);

  const flip = side === 'right' ? -1 : 1;
  const rotate = angle ?? (side === 'left' ? -8 : -8);

  return (
    <div
      className={`screen-glove screen-glove-${side} ${grabbed ? 'grabbed' : ''} ${atMaxReach ? 'max-reach' : ''}`}
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`${side} glove`}
    >
      <img
        className="screen-glove-img"
        src={candidates[srcIndex]}
        alt=""
        draggable={false}
        style={{ transform: `scaleX(${flip}) rotate(${rotate}deg)` }}
        onError={() => {
          if (srcIndex < candidates.length - 1) setSrcIndex((i) => i + 1);
        }}
      />
    </div>
  );
}

export { ScreenGlove };
