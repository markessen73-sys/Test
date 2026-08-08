import type { BoxerSkeletonPose } from '../skeleton/types';
import { GUARD_LEFT, GUARD_RIGHT } from '../skeleton/types';
import { solveBoxerPose } from '../skeleton/solvePose';
import rigGuard from './rigGuardData';

export interface Vec2Norm {
  x: number;
  y: number;
}

export interface PartMeta {
  src: string;
  pivot: readonly [number, number];
  attach: readonly [number, number];
  aspect: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface ArticulatedPose {
  torso: { x: number; y: number; rotation: number; scale: number };
  head: { rotation: number };
  pelvis: { rotation: number };
  leftUpperArm: { rotation: number };
  leftForearm: { rotation: number };
  leftGlove: { rotation: number };
  rightUpperArm: { rotation: number };
  rightForearm: { rotation: number };
  rightGlove: { rotation: number };
  leftThigh: { rotation: number };
  leftCalf: { rotation: number };
  leftBoot: { rotation: number };
  rightThigh: { rotation: number };
  rightCalf: { rotation: number };
  rightBoot: { rotation: number };
}

export const RIG_PARTS = rigGuard.parts as Record<string, PartMeta>;
export const TORSO_ATTACH = rigGuard.torsoAttachNorm as Record<string, readonly [number, number]>;
export const PELVIS_ATTACH = rigGuard.pelvisAttachNorm as Record<string, readonly [number, number]>;
export const RIG_SCALE_VMIN = rigGuard.scaleVmin as number;

function boneAngleDeg(ax: number, ay: number, bx: number, by: number): number {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

const GUARD = solveBoxerPose(GUARD_LEFT, GUARD_RIGHT, 0);

const G = {
  torso: (GUARD.spineTwist * 180) / Math.PI,
  pelvis: (GUARD.hipRotation * 180) / Math.PI,
  head: (GUARD.headRotation * 180) / Math.PI,
  upperL: boneAngleDeg(
    GUARD.leftArm.shoulder.x,
    GUARD.leftArm.shoulder.y,
    GUARD.leftArm.elbow.x,
    GUARD.leftArm.elbow.y
  ),
  foreL: boneAngleDeg(
    GUARD.leftArm.elbow.x,
    GUARD.leftArm.elbow.y,
    GUARD.leftArm.wrist.x,
    GUARD.leftArm.wrist.y
  ),
  gloveL: boneAngleDeg(
    GUARD.leftArm.wrist.x,
    GUARD.leftArm.wrist.y,
    GUARD.leftArm.hand.x,
    GUARD.leftArm.hand.y
  ),
  upperR: boneAngleDeg(
    GUARD.rightArm.shoulder.x,
    GUARD.rightArm.shoulder.y,
    GUARD.rightArm.elbow.x,
    GUARD.rightArm.elbow.y
  ),
  foreR: boneAngleDeg(
    GUARD.rightArm.elbow.x,
    GUARD.rightArm.elbow.y,
    GUARD.rightArm.wrist.x,
    GUARD.rightArm.wrist.y
  ),
  gloveR: boneAngleDeg(
    GUARD.rightArm.wrist.x,
    GUARD.rightArm.wrist.y,
    GUARD.rightArm.hand.x,
    GUARD.rightArm.hand.y
  ),
  thighL: boneAngleDeg(
    GUARD.leftLeg.hip.x,
    GUARD.leftLeg.hip.y,
    GUARD.leftLeg.knee.x,
    GUARD.leftLeg.knee.y
  ),
  calfL: boneAngleDeg(
    GUARD.leftLeg.knee.x,
    GUARD.leftLeg.knee.y,
    GUARD.leftLeg.ankle.x,
    GUARD.leftLeg.ankle.y
  ),
  bootL: boneAngleDeg(
    GUARD.leftLeg.ankle.x,
    GUARD.leftLeg.ankle.y,
    GUARD.leftLeg.foot.x,
    GUARD.leftLeg.foot.y
  ),
  thighR: boneAngleDeg(
    GUARD.rightLeg.hip.x,
    GUARD.rightLeg.hip.y,
    GUARD.rightLeg.knee.x,
    GUARD.rightLeg.knee.y
  ),
  calfR: boneAngleDeg(
    GUARD.rightLeg.knee.x,
    GUARD.rightLeg.knee.y,
    GUARD.rightLeg.ankle.x,
    GUARD.rightLeg.ankle.y
  ),
  bootR: boneAngleDeg(
    GUARD.rightLeg.ankle.x,
    GUARD.rightLeg.ankle.y,
    GUARD.rightLeg.foot.x,
    GUARD.rightLeg.foot.y
  ),
};

function localRot(world: number, parentWorld: number, guardWorld: number, guardParent: number): number {
  return world - parentWorld - (guardWorld - guardParent);
}

/** Hierarchical local rotations relative to parent bones (Flash-style bind pose = guard). */
export function computeArticulatedPose(pose: BoxerSkeletonPose): ArticulatedPose {
  const { leftArm, rightArm, leftLeg, rightLeg, chest } = pose;

  const torsoW = (pose.spineTwist * 180) / Math.PI;
  const pelvisW = (pose.hipRotation * 180) / Math.PI;
  const headW = (pose.headRotation * 180) / Math.PI;

  const upperLW = boneAngleDeg(
    leftArm.shoulder.x,
    leftArm.shoulder.y,
    leftArm.elbow.x,
    leftArm.elbow.y
  );
  const foreLW = boneAngleDeg(leftArm.elbow.x, leftArm.elbow.y, leftArm.wrist.x, leftArm.wrist.y);
  const gloveLW = boneAngleDeg(leftArm.wrist.x, leftArm.wrist.y, leftArm.hand.x, leftArm.hand.y);

  const upperRW = boneAngleDeg(
    rightArm.shoulder.x,
    rightArm.shoulder.y,
    rightArm.elbow.x,
    rightArm.elbow.y
  );
  const foreRW = boneAngleDeg(
    rightArm.elbow.x,
    rightArm.elbow.y,
    rightArm.wrist.x,
    rightArm.wrist.y
  );
  const gloveRW = boneAngleDeg(
    rightArm.wrist.x,
    rightArm.wrist.y,
    rightArm.hand.x,
    rightArm.hand.y
  );

  const thighLW = boneAngleDeg(leftLeg.hip.x, leftLeg.hip.y, leftLeg.knee.x, leftLeg.knee.y);
  const calfLW = boneAngleDeg(leftLeg.knee.x, leftLeg.knee.y, leftLeg.ankle.x, leftLeg.ankle.y);
  const bootLW = boneAngleDeg(leftLeg.ankle.x, leftLeg.ankle.y, leftLeg.foot.x, leftLeg.foot.y);

  const thighRW = boneAngleDeg(rightLeg.hip.x, rightLeg.hip.y, rightLeg.knee.x, rightLeg.knee.y);
  const calfRW = boneAngleDeg(rightLeg.knee.x, rightLeg.knee.y, rightLeg.ankle.x, rightLeg.ankle.y);
  const bootRW = boneAngleDeg(rightLeg.ankle.x, rightLeg.ankle.y, rightLeg.foot.x, rightLeg.foot.y);

  return {
    torso: {
      x: chest.x,
      y: chest.y,
      rotation: torsoW,
      scale: 1 + pose.punchDrive * 0.02,
    },
    head: { rotation: localRot(headW, torsoW, G.head, G.torso) },
    pelvis: { rotation: localRot(pelvisW, torsoW, G.pelvis, G.torso) },
    leftUpperArm: { rotation: localRot(upperLW, torsoW, G.upperL, G.torso) },
    leftForearm: { rotation: localRot(foreLW, upperLW, G.foreL, G.upperL) },
    leftGlove: { rotation: localRot(gloveLW, foreLW, G.gloveL, G.foreL) },
    rightUpperArm: { rotation: localRot(upperRW, torsoW, G.upperR, G.torso) },
    rightForearm: { rotation: localRot(foreRW, upperRW, G.foreR, G.upperR) },
    rightGlove: { rotation: localRot(gloveRW, foreRW, G.gloveR, G.foreR) },
    leftThigh: { rotation: localRot(thighLW, pelvisW, G.thighL, G.pelvis) },
    leftCalf: { rotation: localRot(calfLW, thighLW, G.calfL, G.thighL) },
    leftBoot: { rotation: localRot(bootLW, calfLW, G.bootL, G.calfL) },
    rightThigh: { rotation: localRot(thighRW, pelvisW, G.thighR, G.pelvis) },
    rightCalf: { rotation: localRot(calfRW, thighRW, G.calfR, G.thighR) },
    rightBoot: { rotation: localRot(bootRW, calfRW, G.bootR, G.calfR) },
  };
}

export function partPivot(id: string): Vec2Norm {
  const p = RIG_PARTS[id].pivot;
  return { x: p[0], y: p[1] };
}

export function partAttach(id: string): Vec2Norm {
  const a = RIG_PARTS[id].attach;
  return { x: a[0], y: a[1] };
}

export function torsoAttach(id: string): Vec2Norm {
  const a = TORSO_ATTACH[id];
  return { x: a[0], y: a[1] };
}

export function pelvisAttach(id: 'hip_l' | 'hip_r'): Vec2Norm {
  const a = PELVIS_ATTACH[id];
  return { x: a[0], y: a[1] };
}
