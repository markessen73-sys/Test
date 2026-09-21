import { useState } from 'react';
import type { GloveId } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import { gloveImageCandidates } from './gloveAssets';
import { KNUCKLE_X_FRAC, KNUCKLE_Y_FRAC } from './gloveGeometry';

function ScreenGlove({
  side,
  position,
  grabbed,
  transform,
  zoneSrc,
  showImpactDot = false,
}: {
  side: GloveId;
  position: { x: number; y: number };
  grabbed: boolean;
  transform: GloveTransform;
  /** Per-zone sprite (right glove grid art) */
  zoneSrc?: string;
  showImpactDot?: boolean;
}) {
  const candidates = gloveImageCandidates(side);
  const [srcIndex, setSrcIndex] = useState(0);
  const useZoneArt = Boolean(zoneSrc);

  const imgTransform = useZoneArt
    ? side === 'left'
      ? `rotate(${transform.rotate}deg) scale(${transform.scale}) scaleX(-1)`
      : `rotate(${transform.rotate}deg) scale(${transform.scale})`
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
      role="img"
      aria-label={`${side} glove`}
    >
      <div
        className="screen-glove-art"
        style={{
          transform: imgTransform,
          transformOrigin: useZoneArt ? '50% 68%' : `50% ${transform.originY}`,
        }}
      >
        <img
          className="screen-glove-img"
          src={imgSrc}
          alt=""
          draggable={false}
          onError={() => {
            if (!useZoneArt && srcIndex < candidates.length - 1) setSrcIndex((i) => i + 1);
          }}
        />
        {showImpactDot && useZoneArt && (
          <span
            className="glove-impact-dot"
            style={{
              left: `${KNUCKLE_X_FRAC * 100}%`,
              top: `${KNUCKLE_Y_FRAC * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export { ScreenGlove };
