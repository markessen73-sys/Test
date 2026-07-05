import { useMemo } from 'react';
import type { GlovePosition } from '../types/game';
import {
  buildForearmPath,
  buildUpperArmPath,
  computeBodyPose,
  getBodyStanceBlend,
} from './bodyPose';

const BOXER_GUARD = '/boxer/boxer-behind-guard.png';
const BOXER_RELAXED = '/boxer/boxer-behind-relaxed.png';

interface GhostBodyOverlayProps {
  leftGlove: GlovePosition;
  rightGlove: GlovePosition;
}

export function GhostBodyOverlay({ leftGlove, rightGlove }: GhostBodyOverlayProps) {
  const pose = useMemo(() => computeBodyPose(leftGlove, rightGlove), [leftGlove, rightGlove]);
  const stanceBlend = useMemo(
    () => getBodyStanceBlend(leftGlove, rightGlove),
    [leftGlove, rightGlove]
  );

  const leftUpper = useMemo(() => buildUpperArmPath(pose.left, 'left'), [pose.left]);
  const leftFore = useMemo(() => buildForearmPath(pose.left), [pose.left]);
  const rightUpper = useMemo(() => buildUpperArmPath(pose.right, 'right'), [pose.right]);
  const rightFore = useMemo(() => buildForearmPath(pose.right), [pose.right]);

  const reachGlow = pose.left.atMaxReach || pose.right.atMaxReach;

  return (
    <div className="ghost-body-overlay" aria-hidden>
      {/* Reference artwork — crossfade guard ↔ relaxed by hand height */}
      <img
        src={BOXER_GUARD}
        alt=""
        className="ghost-body-art ghost-body-art-guard"
        style={{ opacity: 1 - stanceBlend * 0.85 }}
        draggable={false}
      />
      <img
        src={BOXER_RELAXED}
        alt=""
        className="ghost-body-art ghost-body-art-relaxed"
        style={{ opacity: stanceBlend * 0.85 }}
        draggable={false}
      />

      {/* Dynamic smoke arms over artwork */}
      <svg className="ghost-body-arms" viewBox="0 0 1 1" preserveAspectRatio="none">
        <defs>
          <linearGradient id="smoke-arm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(180, 230, 255, 0.22)" />
            <stop offset="50%" stopColor="rgba(140, 200, 240, 0.14)" />
            <stop offset="100%" stopColor="rgba(100, 170, 220, 0.08)" />
          </linearGradient>
          <filter id="smoke-blur">
            <feGaussianBlur stdDeviation="0.004" />
          </filter>
        </defs>

        <g filter="url(#smoke-blur)">
          <path d={leftUpper} fill="url(#smoke-arm)" stroke="none" />
          <path d={leftFore} fill="url(#smoke-arm)" stroke="none" />
          <path d={rightUpper} fill="url(#smoke-arm)" stroke="none" />
          <path d={rightFore} fill="url(#smoke-arm)" stroke="none" />
        </g>

        <path
          d={leftUpper}
          fill="none"
          stroke={`rgba(200, 240, 255, ${reachGlow ? 0.65 : 0.45})`}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={leftFore}
          fill="none"
          stroke={`rgba(200, 240, 255, ${reachGlow ? 0.65 : 0.45})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightUpper}
          fill="none"
          stroke={`rgba(200, 240, 255, ${reachGlow ? 0.65 : 0.45})`}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightFore}
          fill="none"
          stroke={`rgba(200, 240, 255, ${reachGlow ? 0.65 : 0.45})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <circle cx={pose.left.elbow.x} cy={pose.left.elbow.y} r="0.007" fill="rgba(220, 245, 255, 0.4)" />
        <circle cx={pose.right.elbow.x} cy={pose.right.elbow.y} r="0.007" fill="rgba(220, 245, 255, 0.4)" />
      </svg>
    </div>
  );
}

export { GHOST_GUARD_LEFT, GHOST_GUARD_RIGHT } from './bodyPose';
