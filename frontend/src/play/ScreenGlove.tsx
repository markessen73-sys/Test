import { useState } from 'react';
import type { GloveId } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import { gloveImageCandidates } from './gloveAssets';

function ScreenGlove({
  side,
  position,
  grabbed,
  transform,
  zoneSrc,
  onPointerDown,
}: {
  side: GloveId;
  position: { x: number; y: number };
  grabbed: boolean;
  transform: GloveTransform;
  /** Per-zone sprite (right glove grid art) — no CSS rotation applied */
  zoneSrc?: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const candidates = gloveImageCandidates(side);
  const [srcIndex, setSrcIndex] = useState(0);
  const useZoneArt = Boolean(zoneSrc);

  const imgTransform = useZoneArt
    ? [
        side === 'left' ? 'scaleX(-1)' : null,
        `scale(${transform.scale})`,
        `rotate(${transform.rotate}deg)`,
      ]
        .filter(Boolean)
        .join(' ')
    : [
        `scale(${transform.scaleX * transform.scale}, ${transform.scale})`,
        `rotate(${transform.rotate}deg)`,
        `skewX(${transform.skewX}deg)`,
      ].join(' ');

  const gloveW = useZoneArt ? 130 : 112;
  const gloveH = useZoneArt ? 155 : 134;
  const cuffAnchorY = gloveH * 0.68;

  const imgSrc = useZoneArt ? zoneSrc! : candidates[srcIndex];

  return (
    <div
      className={`screen-glove screen-glove-${side} ${grabbed ? 'grabbed' : ''} ${useZoneArt ? 'screen-glove-zoned' : ''}`}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        width: gloveW,
        height: gloveH,
        margin: `${-cuffAnchorY}px 0 0 ${-gloveW / 2}px`,
      }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`${side} glove`}
    >
      <img
        className="screen-glove-img"
        src={imgSrc}
        alt=""
        draggable={false}
        style={{
          transform: imgTransform,
          transformOrigin: useZoneArt ? '50% 68%' : `50% ${transform.originY}`,
        }}
        onError={() => {
          if (!useZoneArt && srcIndex < candidates.length - 1) setSrcIndex((i) => i + 1);
        }}
      />
    </div>
  );
}

export { ScreenGlove };
