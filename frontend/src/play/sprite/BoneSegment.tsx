import type { ReactNode } from 'react';
import {
  RIG_PARTS,
  RIG_SCALE_VMIN,
  partAttach,
  partPivot,
  pelvisAttach,
  torsoAttach,
  type PartMeta,
} from './articulatedPose';

function partSizeVmin(part: PartMeta, scale: number): { w: number; h: number } {
  const torso = RIG_PARTS.torso;
  const h = RIG_SCALE_VMIN * (part.height / torso.height) * scale;
  const w = h * part.aspect;
  return { w, h };
}

interface BoneSegmentProps {
  partId: string;
  rotation: number;
  scale?: number;
  children?: ReactNode;
}

/** Single limb layer — rotates around anatomical pivot; children attach at distal joint. */
export function BoneSegment({ partId, rotation, scale = 1, children }: BoneSegmentProps) {
  const part = RIG_PARTS[partId];
  const pivot = partPivot(partId);
  const attach = partAttach(partId);
  const { w, h } = partSizeVmin(part, scale);

  return (
    <div
      className="bone-segment"
      style={{
        position: 'relative',
        width: 0,
        height: 0,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '0 0',
        zIndex: part.zIndex,
      }}
    >
      <img
        className={`sprite-part sprite-part-${partId}`}
        src={part.src}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: `${-pivot.x * w}vmin`,
          top: `${-pivot.y * h}vmin`,
          width: `${w}vmin`,
          height: `${h}vmin`,
        }}
      />
      {children ? (
        <div
          className="bone-child"
          style={{
            position: 'absolute',
            left: `${(attach.x - pivot.x) * w}vmin`,
            top: `${(attach.y - pivot.y) * h}vmin`,
            width: 0,
            height: 0,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface TorsoMountProps {
  attachId: string;
  children: ReactNode;
}

/** Mount a child bone at a point on the torso image. */
export function TorsoMount({ attachId, children }: TorsoMountProps) {
  const attach = torsoAttach(attachId);
  const { w, h } = partSizeVmin(RIG_PARTS.torso, 1);

  return (
    <div
      className="torso-mount"
      style={{
        position: 'absolute',
        left: `${attach.x * w}vmin`,
        top: `${attach.y * h}vmin`,
        width: 0,
        height: 0,
      }}
    >
      {children}
    </div>
  );
}

interface PelvisMountProps {
  attachId: 'hip_l' | 'hip_r';
  children: ReactNode;
}

/** Mount a thigh at a hip point on the pelvis image. */
export function PelvisMount({ attachId, children }: PelvisMountProps) {
  const attach = pelvisAttach(attachId);
  const { w, h } = partSizeVmin(RIG_PARTS.pelvis, 1);

  return (
    <div
      className="pelvis-mount"
      style={{
        position: 'absolute',
        left: `${attach.x * w}vmin`,
        top: `${attach.y * h}vmin`,
        width: 0,
        height: 0,
      }}
    >
      {children}
    </div>
  );
}

interface TorsoRootProps {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  children: ReactNode;
}

/** Torso parent node — chest anchor, spine rotates around waist. */
export function TorsoRoot({ x, y, rotation, scale, children }: TorsoRootProps) {
  const torso = RIG_PARTS.torso;
  const waist = partPivot('torso');
  const chest = torsoAttach('chest');
  const { w, h } = partSizeVmin(torso, scale);

  const originX = (waist.x - chest.x) * w;
  const originY = (waist.y - chest.y) * h;

  return (
    <div className="torso-root" style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: 0, height: 0 }}>
      <div
        className="torso-spin"
        style={{
          position: 'absolute',
          left: `${-chest.x * w}vmin`,
          top: `${-chest.y * h}vmin`,
          width: 0,
          height: 0,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${originX}vmin ${originY}vmin`,
        }}
      >
        <img
          className="sprite-part sprite-part-torso"
          src={torso.src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${w}vmin`,
            height: `${h}vmin`,
            zIndex: torso.zIndex,
          }}
        />
        {children}
      </div>
    </div>
  );
}
