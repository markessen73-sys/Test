import { useState } from 'react';
import type { GloveId } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import { gloveImageCandidates } from './gloveAssets';

function ScreenGlove({
  side,
  position,
  grabbed,
  atMaxReach,
  transform,
  onPointerDown,
}: {
  side: GloveId;
  position: { x: number; y: number };
  grabbed: boolean;
  atMaxReach?: boolean;
  transform: GloveTransform;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const candidates = gloveImageCandidates(side);
  const [srcIndex, setSrcIndex] = useState(0);

  const imgTransform = [
    `scale(${transform.scaleX * transform.scale}, ${transform.scale})`,
    `rotate(${transform.rotate}deg)`,
    `skewX(${transform.skewX}deg)`,
  ].join(' ');

  // Anchor the glove cuff (transform-origin 68%) to the IK wrist, not the div center.
  const gloveH = 168;
  const cuffAnchorY = gloveH * 0.68;

  return (
    <div
      className={`screen-glove screen-glove-${side} ${grabbed ? 'grabbed' : ''} ${atMaxReach ? 'max-reach' : ''}`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        margin: `${-cuffAnchorY}px 0 0 -70px`,
      }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`${side} glove`}
    >
      <img
        className="screen-glove-img"
        src={candidates[srcIndex]}
        alt=""
        draggable={false}
        style={{
          transform: imgTransform,
          transformOrigin: `50% ${transform.originY}`,
        }}
        onError={() => {
          if (srcIndex < candidates.length - 1) setSrcIndex((i) => i + 1);
        }}
      />
    </div>
  );
}

export { ScreenGlove };
