import type { CSSProperties } from 'react';
import type { BoxerSkeletonPose } from '../skeleton/types';
import { computeSpriteTransforms } from './partTransforms';
import { SPRITE_PARTS } from './spriteParts';

interface SpriteBoxerRigProps {
  pose: BoxerSkeletonPose;
}

function partStyle(
  leftPct: number,
  topPct: number,
  pivotX: number,
  pivotY: number,
  rotation: number,
  widthVmin: number,
  scale: number,
  zIndex: number
): CSSProperties {
  return {
    position: 'absolute',
    left: `${leftPct * 100}%`,
    top: `${topPct * 100}%`,
    width: `${widthVmin * scale}vmin`,
    height: 'auto',
    zIndex,
    transform: `translate(-${pivotX * 100}%, -${pivotY * 100}%) rotate(${rotation}deg)`,
    transformOrigin: `${pivotX * 100}% ${pivotY * 100}%`,
  };
}

export function SpriteBoxerRig({ pose }: SpriteBoxerRigProps) {
  const transforms = computeSpriteTransforms(pose);

  return (
    <div className="sprite-boxer-rig" aria-hidden>
      {SPRITE_PARTS.map((part) => {
        const t = transforms[part.id];
        if (!t) return null;
        return (
          <img
            key={part.id}
            className={`sprite-part sprite-part-${part.id}`}
            src={part.src}
            alt=""
            draggable={false}
            style={partStyle(
              t.x,
              t.y,
              part.pivotX,
              part.pivotY,
              t.rotation,
              part.widthVmin,
              t.scale,
              part.zIndex
            )}
          />
        );
      })}
    </div>
  );
}
