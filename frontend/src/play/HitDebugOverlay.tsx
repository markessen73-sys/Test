import type { GlovePosition } from '../types/game';
import { bagHitZoneOutline } from './gloveZoneGrid';

interface HitDebugOverlayProps {
  leftKnuckle: GlovePosition;
  rightKnuckle: GlovePosition;
}

export function HitDebugOverlay({ leftKnuckle, rightKnuckle }: HitDebugOverlayProps) {
  const bagOutline = bagHitZoneOutline();
  const bagPoints = bagOutline.map((p) => `${p.x},${p.y}`).join(' ');

  const dots = [
    { id: 'left', pos: leftKnuckle },
    { id: 'right', pos: rightKnuckle },
  ] as const;

  return (
    <svg className="hit-debug-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <polygon className="hit-debug-bag-zone" points={bagPoints} />
      {dots.map(({ id, pos }) => (
          <circle
            key={id}
            className={`hit-debug-knuckle hit-debug-knuckle-${id}`}
            cx={pos.x}
            cy={pos.y}
            r={0.014}
          />
      ))}
    </svg>
  );
}
