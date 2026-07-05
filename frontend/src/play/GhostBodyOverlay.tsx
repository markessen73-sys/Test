import type { GlovePosition } from '../types/game';

/** Fixed body anchor points in normalized screen space (0–1). */
const BODY = {
  head: { x: 0.5, y: 0.52 },
  neck: { x: 0.5, y: 0.58 },
  chest: { x: 0.5, y: 0.66 },
  waist: { x: 0.5, y: 0.82 },
  leftShoulder: { x: 0.36, y: 0.6 },
  rightShoulder: { x: 0.64, y: 0.6 },
} as const;

interface GhostBodyOverlayProps {
  leftGlove: GlovePosition;
  rightGlove: GlovePosition;
}

export function GhostBodyOverlay({ leftGlove, rightGlove }: GhostBodyOverlayProps) {
  const ls = BODY.leftShoulder;
  const rs = BODY.rightShoulder;
  const lg = leftGlove;
  const rg = rightGlove;

  const torsoPath = [
    `M ${BODY.leftShoulder.x} ${BODY.leftShoulder.y}`,
    `Q ${BODY.chest.x - 0.08} ${BODY.chest.y} ${BODY.chest.x - 0.14} ${BODY.chest.y}`,
    `L ${BODY.chest.x - 0.14} ${BODY.waist.y}`,
    `Q ${BODY.chest.x} ${BODY.waist.y + 0.04} ${BODY.chest.x + 0.14} ${BODY.waist.y}`,
    `L ${BODY.chest.x + 0.14} ${BODY.chest.y}`,
    `Q ${BODY.chest.x + 0.08} ${BODY.chest.y} ${BODY.rightShoulder.x} ${BODY.rightShoulder.y}`,
    `Q ${BODY.chest.x} ${BODY.chest.y - 0.06} ${BODY.leftShoulder.x} ${BODY.leftShoulder.y}`,
    'Z',
  ].join(' ');

  return (
    <svg className="ghost-body-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ghost-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 220, 170, 0.12)" />
          <stop offset="100%" stopColor="rgba(200, 150, 100, 0.06)" />
        </linearGradient>
      </defs>

      {/* Torso fill — see-through */}
      <path d={torsoPath} fill="url(#ghost-fill)" stroke="none" vectorEffect="non-scaling-stroke" />

      {/* Torso outline */}
      <path
        d={torsoPath}
        fill="none"
        stroke="rgba(255, 230, 180, 0.55)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Head */}
      <ellipse
        cx={BODY.head.x}
        cy={BODY.head.y}
        rx="0.065"
        ry="0.075"
        fill="rgba(255, 220, 170, 0.08)"
        stroke="rgba(255, 230, 180, 0.5)"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />

      {/* Neck */}
      <line
        x1={BODY.neck.x}
        y1={BODY.neck.y - 0.02}
        x2={BODY.neck.x}
        y2={BODY.neck.y + 0.02}
        stroke="rgba(255, 230, 180, 0.4)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* Arms — see-through, connect shoulders to gloves */}
      <line
        x1={ls.x}
        y1={ls.y}
        x2={lg.x}
        y2={lg.y}
        stroke="rgba(230, 190, 140, 0.35)"
        strokeWidth="14"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={rs.x}
        y1={rs.y}
        x2={rg.x}
        y2={rg.y}
        stroke="rgba(230, 190, 140, 0.35)"
        strokeWidth="14"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={ls.x}
        y1={ls.y}
        x2={lg.x}
        y2={lg.y}
        stroke="rgba(255, 230, 180, 0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={rs.x}
        y1={rs.y}
        x2={rg.x}
        y2={rg.y}
        stroke="rgba(255, 230, 180, 0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Shoulder joints */}
      <circle cx={ls.x} cy={ls.y} r="0.012" fill="rgba(255, 230, 180, 0.45)" />
      <circle cx={rs.x} cy={rs.y} r="0.012" fill="rgba(255, 230, 180, 0.45)" />
    </svg>
  );
}

/** Export for glove default positions aligned with shoulders */
export const GHOST_GUARD_LEFT: GlovePosition = { x: 0.34, y: 0.62 };
export const GHOST_GUARD_RIGHT: GlovePosition = { x: 0.66, y: 0.62 };
