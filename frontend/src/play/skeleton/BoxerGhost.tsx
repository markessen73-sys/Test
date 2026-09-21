import { useMemo } from 'react';
import type { BoxerSkeletonPose } from './types';
import { buildAnatomicalGhostMesh } from './ghostMesh';

interface BoxerGhostProps {
  pose: BoxerSkeletonPose;
}

export function BoxerGhost({ pose }: BoxerGhostProps) {
  const mesh = useMemo(() => buildAnatomicalGhostMesh(pose), [pose]);
  const reachGlow = pose.leftArm.atMaxReach || pose.rightArm.atMaxReach;
  const punchGlow = pose.punchDrive > 0.15;
  const rimAlpha = reachGlow || punchGlow ? 0.78 : 0.58;

  return (
    <svg className="boxer-ghost" viewBox="0 0 1 1" preserveAspectRatio="xMidYMax meet" aria-hidden>
      <defs>
        <radialGradient id="spirit-core" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="rgba(230, 250, 255, 0.2)" />
          <stop offset="45%" stopColor="rgba(190, 230, 255, 0.1)" />
          <stop offset="100%" stopColor="rgba(140, 200, 240, 0.02)" />
        </radialGradient>
        <linearGradient id="spirit-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240, 252, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(160, 210, 250, 0.12)" />
        </linearGradient>
        <filter id="spirit-outer-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="0.018" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.75  0 0 0 0 0.9  0 0 0 0 1  0 0 0 0.45 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="spirit-wisp" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.012" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="spirit-soft-blur" x="-8%" y="-8%" width="116%" height="116%">
          <feGaussianBlur stdDeviation="0.006" />
        </filter>
      </defs>

      {/* Outer halo glow */}
      <path
        d={mesh.silhouette}
        fill="rgba(180, 220, 255, 0.06)"
        filter="url(#spirit-outer-glow)"
        stroke="none"
      />

      {/* Main unified ghost body mesh */}
      <g filter="url(#spirit-soft-blur)">
        <path d={mesh.silhouette} fill="url(#spirit-core)" stroke="none" />
        <path d={mesh.silhouette} fill="url(#spirit-edge)" stroke="none" opacity="0.55" />
      </g>

      {/* Wispy smoke displacement layer */}
      <g filter="url(#spirit-wisp)" opacity="0.35">
        <path d={mesh.silhouette} fill="rgba(200, 235, 255, 0.08)" stroke="none" />
        <path d={mesh.wisps} fill="none" stroke="rgba(220, 245, 255, 0.15)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      </g>

      {/* Bright rim silhouette */}
      <path
        d={mesh.silhouette}
        fill="none"
        stroke={`rgba(220, 248, 255, ${rimAlpha})`}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Interior muscle definition */}
      <path
        d={mesh.muscleDetail}
        fill="none"
        stroke="rgba(200, 235, 255, 0.22)"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
