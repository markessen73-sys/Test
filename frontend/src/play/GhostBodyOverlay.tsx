import { useMemo } from 'react';
import type { GlovePosition } from '../types/game';
import {
  buildArmPath,
  buildHeadPath,
  buildMuscularTorsoPaths,
  buildNeckPath,
  computeBodyPose,
} from './bodyPose';

interface GhostBodyOverlayProps {
  leftGlove: GlovePosition;
  rightGlove: GlovePosition;
}

export function GhostBodyOverlay({ leftGlove, rightGlove }: GhostBodyOverlayProps) {
  const pose = useMemo(() => computeBodyPose(leftGlove, rightGlove), [leftGlove, rightGlove]);
  const torso = useMemo(() => buildMuscularTorsoPaths(pose.torsoLean), [pose.torsoLean]);
  const head = useMemo(() => buildHeadPath(pose.torsoLean), [pose.torsoLean]);
  const neck = useMemo(() => buildNeckPath(pose.torsoLean), [pose.torsoLean]);
  const leftArm = useMemo(() => buildArmPath(pose.left, 'left'), [pose.left]);
  const rightArm = useMemo(() => buildArmPath(pose.right, 'right'), [pose.right]);

  const strokeReach = pose.left.atMaxReach || pose.right.atMaxReach ? 0.75 : 0.55;

  return (
    <svg className="ghost-body-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ghost-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 215, 165, 0.14)" />
          <stop offset="55%" stopColor="rgba(220, 170, 120, 0.09)" />
          <stop offset="100%" stopColor="rgba(180, 130, 90, 0.05)" />
        </linearGradient>
        <linearGradient id="arm-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(235, 195, 150, 0.12)" />
          <stop offset="100%" stopColor="rgba(200, 155, 110, 0.08)" />
        </linearGradient>
      </defs>

      {/* Torso — muscular silhouette */}
      <path d={torso.fill} fill="url(#ghost-fill)" stroke="none" vectorEffect="non-scaling-stroke" />
      <path
        d={torso.outline}
        fill="none"
        stroke="rgba(255, 230, 190, 0.55)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={torso.detail}
        fill="none"
        stroke="rgba(255, 220, 175, 0.28)"
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Arms — behind torso outline at shoulder but show muscle mass */}
      <path d={leftArm} fill="url(#arm-fill)" stroke="none" vectorEffect="non-scaling-stroke" />
      <path d={rightArm} fill="url(#arm-fill)" stroke="none" vectorEffect="non-scaling-stroke" />
      <path
        d={leftArm}
        fill="none"
        stroke={`rgba(255, 230, 190, ${strokeReach})`}
        strokeWidth="1.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={rightArm}
        fill="none"
        stroke={`rgba(255, 230, 190, ${strokeReach})`}
        strokeWidth="1.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Neck + head */}
      <path d={neck} fill="rgba(255, 215, 165, 0.07)" stroke="rgba(255, 230, 190, 0.4)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path
        d={head}
        fill="rgba(255, 215, 165, 0.08)"
        stroke="rgba(255, 230, 190, 0.5)"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />

      {/* Joints */}
      <circle cx={pose.left.elbow.x} cy={pose.left.elbow.y} r="0.008" fill="rgba(255, 230, 190, 0.35)" />
      <circle cx={pose.right.elbow.x} cy={pose.right.elbow.y} r="0.008" fill="rgba(255, 230, 190, 0.35)" />
      <circle cx={pose.left.shoulder.x} cy={pose.left.shoulder.y} r="0.01" fill="rgba(255, 230, 190, 0.45)" />
      <circle cx={pose.right.shoulder.x} cy={pose.right.shoulder.y} r="0.01" fill="rgba(255, 230, 190, 0.45)" />
    </svg>
  );
}

export { GHOST_GUARD_LEFT, GHOST_GUARD_RIGHT } from './bodyPose';
