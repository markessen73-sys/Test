import { useMemo } from 'react';
import type { BoxerSkeletonPose } from './types';
import { buildGhostMesh } from './ghostMesh';

interface BoxerGhostProps {
  pose: BoxerSkeletonPose;
}

export function BoxerGhost({ pose }: BoxerGhostProps) {
  const mesh = useMemo(() => buildGhostMesh(pose), [pose]);
  const reachGlow = pose.leftArm.atMaxReach || pose.rightArm.atMaxReach;
  const edgeAlpha = reachGlow ? 0.72 : 0.52;

  return (
    <svg className="boxer-ghost" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="ghost-smoke" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="rgba(220, 245, 255, 0.15)" />
          <stop offset="50%" stopColor="rgba(180, 220, 250, 0.09)" />
          <stop offset="100%" stopColor="rgba(140, 190, 230, 0.04)" />
        </linearGradient>
        <linearGradient id="ghost-limb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(200, 235, 255, 0.16)" />
          <stop offset="100%" stopColor="rgba(150, 200, 240, 0.07)" />
        </linearGradient>
        <filter id="ghost-blur" x="-8%" y="-8%" width="116%" height="116%">
          <feGaussianBlur stdDeviation="0.007" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ghost-glow">
          <feGaussianBlur stdDeviation="0.004" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#ghost-blur)">
        {/* Legs */}
        <path d={mesh.leftThigh} fill="url(#ghost-limb)" />
        <path d={mesh.rightThigh} fill="url(#ghost-limb)" />
        <path d={mesh.leftCalf} fill="url(#ghost-limb)" />
        <path d={mesh.rightCalf} fill="url(#ghost-limb)" />
        {/* Torso */}
        <path d={mesh.torso} fill="url(#ghost-smoke)" />
        <path d={mesh.shorts} fill="url(#ghost-smoke)" opacity="0.9" />
        <path d={mesh.head} fill="url(#ghost-smoke)" />
        {/* Arms — behind gloves, attached at shoulders */}
        <path d={mesh.leftUpperArm} fill="url(#ghost-limb)" />
        <path d={mesh.leftForearm} fill="url(#ghost-limb)" />
        <path d={mesh.rightUpperArm} fill="url(#ghost-limb)" />
        <path d={mesh.rightForearm} fill="url(#ghost-limb)" />
      </g>

      <g filter="url(#ghost-glow)">
        {[mesh.torso, mesh.head, mesh.shorts, mesh.leftThigh, mesh.rightThigh, mesh.leftCalf, mesh.rightCalf,
          mesh.leftUpperArm, mesh.leftForearm, mesh.rightUpperArm, mesh.rightForearm].map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={`rgba(210, 245, 255, ${edgeAlpha})`}
            strokeWidth={i < 3 ? 1.5 : 1.1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={mesh.muscleLines}
          fill="none"
          stroke="rgba(190, 230, 255, 0.2)"
          strokeWidth="0.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <circle cx={pose.leftArm.elbow.x} cy={pose.leftArm.elbow.y} r="0.006" fill="rgba(220, 245, 255, 0.3)" />
      <circle cx={pose.rightArm.elbow.x} cy={pose.rightArm.elbow.y} r="0.006" fill="rgba(220, 245, 255, 0.3)" />
    </svg>
  );
}
