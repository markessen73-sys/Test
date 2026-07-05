import { useState } from 'react';
import type { GloveId } from '../types/game';
import { gloveImageCandidates } from './gloveAssets';

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
  const candidates = gloveImageCandidates(side);
  const [srcIndex, setSrcIndex] = useState(0);

  return (
    <div
      className={`screen-glove screen-glove-${side} ${grabbed ? 'grabbed' : ''}`}
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
        onError={() => {
          if (srcIndex < candidates.length - 1) setSrcIndex((i) => i + 1);
        }}
      />
    </div>
  );
}

export { ScreenGlove };
