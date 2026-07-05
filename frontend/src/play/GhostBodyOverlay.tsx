import { useMemo } from 'react';
import type { GlovePosition } from '../types/game';
import {
  buildForearmPath,
  buildUpperArmPath,
  computeBodyPose,
} from './bodyPose';
import { buildGhostBackBody, buildGhostNeck } from './ghostBodyShape';

interface GhostBodyOverlayProps {
  leftGlove: GlovePosition;
  rightGlove: GlovePosition;
}

export function GhostBodyOverlay({ leftGlove, rightGlove }: GhostBodyOverlayProps) {
  const pose = useMemo(() => computeBodyPose(leftGlove, rightGlove), [leftGlove, rightGlove]);
  const shape = useMemo(() => buildGhostBackBody(pose.torsoLean), [pose.torsoLean]);
  const neck = useMemo(() => buildGhostNeck(pose.torsoLean), [pose.torsoLean]);

  const leftUpper = useMemo(() => buildUpperArmPath(pose.left, 'left'), [pose.left]);
  const leftFore = useMemo(() => buildForearmPath(pose.left), [pose.left]);
  const rightUpper = useMemo(() => buildUpperArmPath(pose.right, 'right'), [pose.right]);
  const rightFore = useMemo(() => buildForearmPath(pose.right), [pose.right]);

  const reachGlow = pose.left.atMaxReach || pose.right.atMaxReach;
  const edgeAlpha = reachGlow ? 0.7 : 0.5;

  return (
    <svg className="ghost-body-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ghost-smoke-fill" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="rgba(200, 235, 255, 0.16)" />
          <stop offset="45%" stopColor="rgba(160, 210, 245, 0.1)" />
          <stop offset="100%" stopColor="rgba(120, 180, 220, 0.05)" />
        </linearGradient>
        <linearGradient id="ghost-arm-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(190, 230, 255, 0.18)" />
          <stop offset="100%" stopColor="rgba(140, 195, 235, 0.08)" />
        </linearGradient>
        <filter id="ghost-smoke-blur" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.006" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ghost-rim-glow">
          <feGaussianBlur stdDeviation="0.003" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#ghost-smoke-blur)">
        {/* Back torso + shorts — see-through smoke body */}
        <path d={shape.torso} fill="url(#ghost-smoke-fill)" stroke="none" />
        <path d={shape.shorts} fill="url(#ghost-smoke-fill)" stroke="none" opacity="0.85" />
        <path d={shape.head} fill="url(#ghost-smoke-fill)" stroke="none" />
        <path d={neck} fill="url(#ghost-smoke-fill)" stroke="none" opacity="0.9" />

        {/* Dynamic arms */}
        <path d={leftUpper} fill="url(#ghost-arm-fill)" stroke="none" />
        <path d={leftFore} fill="url(#ghost-arm-fill)" stroke="none" />
        <path d={rightUpper} fill="url(#ghost-arm-fill)" stroke="none" />
        <path d={rightFore} fill="url(#ghost-arm-fill)" stroke="none" />
      </g>

      {/* Rim outlines — ethereal edge like reference */}
      <g filter="url(#ghost-rim-glow)">
        <path
          d={shape.torso}
          fill="none"
          stroke={`rgba(210, 245, 255, ${edgeAlpha})`}
          strokeWidth="1.6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={shape.head}
          fill="none"
          stroke={`rgba(210, 245, 255, ${edgeAlpha * 0.9})`}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={shape.shorts}
          fill="none"
          stroke={`rgba(200, 235, 250, ${edgeAlpha * 0.75})`}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={leftUpper}
          fill="none"
          stroke={`rgba(200, 240, 255, ${edgeAlpha})`}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={leftFore}
          fill="none"
          stroke={`rgba(200, 240, 255, ${edgeAlpha * 0.9})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightUpper}
          fill="none"
          stroke={`rgba(200, 240, 255, ${edgeAlpha})`}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={rightFore}
          fill="none"
          stroke={`rgba(200, 240, 255, ${edgeAlpha * 0.9})`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Muscle detail — subtle interior lines */}
      <path
        d={shape.muscleDetail}
        fill="none"
        stroke="rgba(180, 225, 250, 0.22)"
        strokeWidth="0.8"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <circle cx={pose.left.elbow.x} cy={pose.left.elbow.y} r="0.007" fill="rgba(220, 245, 255, 0.35)" />
      <circle cx={pose.right.elbow.x} cy={pose.right.elbow.y} r="0.007" fill="rgba(220, 245, 255, 0.35)" />
    </svg>
  );
}

export { GHOST_GUARD_LEFT, GHOST_GUARD_RIGHT } from './bodyPose';
