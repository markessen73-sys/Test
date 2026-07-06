import type { BoxerSkeletonPose } from '../skeleton/types';
import { GUARD_LEFT, GUARD_RIGHT } from '../skeleton/types';
import { solveBoxerPose } from '../skeleton/solvePose';

export interface PartTransform {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export type SpriteRigTransforms = Record<string, PartTransform>;

function boneAngleDeg(ax: number, ay: number, bx: number, by: number): number {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

function delta(current: number, guard: number): number {
  return current - guard;
}

const GUARD = solveBoxerPose(GUARD_LEFT, GUARD_RIGHT, 0);

const G = {
  upperL: boneAngleDeg(
    GUARD.leftArm.shoulder.x,
    GUARD.leftArm.shoulder.y,
    GUARD.leftArm.elbow.x,
    GUARD.leftArm.elbow.y
  ),
  upperR: boneAngleDeg(
    GUARD.rightArm.shoulder.x,
    GUARD.rightArm.shoulder.y,
    GUARD.rightArm.elbow.x,
    GUARD.rightArm.elbow.y
  ),
  foreL: boneAngleDeg(
    GUARD.leftArm.elbow.x,
    GUARD.leftArm.elbow.y,
    GUARD.leftArm.wrist.x,
    GUARD.leftArm.wrist.y
  ),
  foreR: boneAngleDeg(
    GUARD.rightArm.elbow.x,
    GUARD.rightArm.elbow.y,
    GUARD.rightArm.wrist.x,
    GUARD.rightArm.wrist.y
  ),
  gloveL: boneAngleDeg(
    GUARD.leftArm.wrist.x,
    GUARD.leftArm.wrist.y,
    GUARD.leftArm.hand.x,
    GUARD.leftArm.hand.y
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
  thighR: boneAngleDeg(
    GUARD.rightLeg.hip.x,
    GUARD.rightLeg.hip.y,
    GUARD.rightLeg.knee.x,
    GUARD.rightLeg.knee.y
  ),
  shinL: boneAngleDeg(
    GUARD.leftLeg.knee.x,
    GUARD.leftLeg.knee.y,
    GUARD.leftLeg.ankle.x,
    GUARD.leftLeg.ankle.y
  ),
  shinR: boneAngleDeg(
    GUARD.rightLeg.knee.x,
    GUARD.rightLeg.knee.y,
    GUARD.rightLeg.ankle.x,
    GUARD.rightLeg.ankle.y
  ),
  bootL: boneAngleDeg(
    GUARD.leftLeg.ankle.x,
    GUARD.leftLeg.ankle.y,
    GUARD.leftLeg.foot.x,
    GUARD.leftLeg.foot.y
  ),
  bootR: boneAngleDeg(
    GUARD.rightLeg.ankle.x,
    GUARD.rightLeg.ankle.y,
    GUARD.rightLeg.foot.x,
    GUARD.rightLeg.foot.y
  ),
};

function part(x: number, y: number, rotation: number, scale = 1): PartTransform {
  return { x, y, rotation, scale };
}

/** IK joint positions + guard-pose rotation deltas for each sprite layer. */
export function computeSpriteTransforms(pose: BoxerSkeletonPose): SpriteRigTransforms {
  const { leftArm, rightArm, leftLeg, rightLeg, pelvis, chest, neck, head } = pose;

  const upperL = boneAngleDeg(
    leftArm.shoulder.x,
    leftArm.shoulder.y,
    leftArm.elbow.x,
    leftArm.elbow.y
  );
  const upperR = boneAngleDeg(
    rightArm.shoulder.x,
    rightArm.shoulder.y,
    rightArm.elbow.x,
    rightArm.elbow.y
  );
  const foreL = boneAngleDeg(leftArm.elbow.x, leftArm.elbow.y, leftArm.wrist.x, leftArm.wrist.y);
  const foreR = boneAngleDeg(
    rightArm.elbow.x,
    rightArm.elbow.y,
    rightArm.wrist.x,
    rightArm.wrist.y
  );
  const gloveL = boneAngleDeg(leftArm.wrist.x, leftArm.wrist.y, leftArm.hand.x, leftArm.hand.y);
  const gloveR = boneAngleDeg(
    rightArm.wrist.x,
    rightArm.wrist.y,
    rightArm.hand.x,
    rightArm.hand.y
  );
  const thighL = boneAngleDeg(leftLeg.hip.x, leftLeg.hip.y, leftLeg.knee.x, leftLeg.knee.y);
  const thighR = boneAngleDeg(rightLeg.hip.x, rightLeg.hip.y, rightLeg.knee.x, rightLeg.knee.y);
  const shinL = boneAngleDeg(leftLeg.knee.x, leftLeg.knee.y, leftLeg.ankle.x, leftLeg.ankle.y);
  const shinR = boneAngleDeg(rightLeg.knee.x, rightLeg.knee.y, rightLeg.ankle.x, rightLeg.ankle.y);
  const bootL = boneAngleDeg(leftLeg.ankle.x, leftLeg.ankle.y, leftLeg.foot.x, leftLeg.foot.y);
  const bootR = boneAngleDeg(rightLeg.ankle.x, rightLeg.ankle.y, rightLeg.foot.x, rightLeg.foot.y);

  const torsoRot = (pose.spineTwist * 180) / Math.PI;
  const pelvisRot = (pose.hipRotation * 180) / Math.PI;
  const headRot = (pose.headRotation * 180) / Math.PI;
  const punchScale = 1 + pose.punchDrive * 0.02;

  return {
    pelvis: part(pelvis.x, pelvis.y, pelvisRot, punchScale),
    torso: part(chest.x, chest.y, torsoRot, punchScale),
    head: part(head.x, neck.y, headRot, punchScale),
    'upper-arm-left': part(leftArm.shoulder.x, leftArm.shoulder.y, delta(upperL, G.upperL)),
    'forearm-left': part(leftArm.elbow.x, leftArm.elbow.y, delta(foreL, G.foreL)),
    'glove-left': part(leftArm.hand.x, leftArm.hand.y, delta(gloveL, G.gloveL)),
    'upper-arm-right': part(rightArm.shoulder.x, rightArm.shoulder.y, delta(upperR, G.upperR)),
    'forearm-right': part(rightArm.elbow.x, rightArm.elbow.y, delta(foreR, G.foreR)),
    'glove-right': part(rightArm.hand.x, rightArm.hand.y, delta(gloveR, G.gloveR)),
    'thigh-left': part(leftLeg.hip.x, leftLeg.hip.y, delta(thighL, G.thighL)),
    'shin-left': part(leftLeg.knee.x, leftLeg.knee.y, delta(shinL, G.shinL)),
    'boot-left': part(leftLeg.ankle.x, leftLeg.ankle.y, delta(bootL, G.bootL)),
    'thigh-right': part(rightLeg.hip.x, rightLeg.hip.y, delta(thighR, G.thighR)),
    'shin-right': part(rightLeg.knee.x, rightLeg.knee.y, delta(shinR, G.shinR)),
    'boot-right': part(rightLeg.ankle.x, rightLeg.ankle.y, delta(bootR, G.bootR)),
  };
}
