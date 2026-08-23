import type { BoxerSkeletonPose } from '../skeleton/types';
import { computeArticulatedPose } from './articulatedPose';
import { BoneSegment, PelvisMount, TorsoMount, TorsoRoot } from './BoneSegment';

interface SpriteBoxerRigProps {
  pose: BoxerSkeletonPose;
}

/**
 * Layered articulated boxer — Flash-style 2D skeletal hierarchy.
 * Torso is parent; limbs chain through anatomical pivots with overlapping sprites.
 */
export function SpriteBoxerRig({ pose }: SpriteBoxerRigProps) {
  const art = computeArticulatedPose(pose);
  const s = art.torso.scale;

  return (
    <div className="sprite-boxer-rig" aria-hidden>
      <TorsoRoot x={art.torso.x} y={art.torso.y} rotation={art.torso.rotation} scale={s}>
        {/* Legs (behind torso) */}
        <TorsoMount attachId="waist">
          <BoneSegment partId="pelvis" rotation={art.pelvis.rotation} scale={s}>
            <PelvisMount attachId="hip_l">
              <BoneSegment partId="thigh-left" rotation={art.leftThigh.rotation} scale={s}>
                <BoneSegment partId="calf-left" rotation={art.leftCalf.rotation} scale={s}>
                  <BoneSegment partId="boot-left" rotation={art.leftBoot.rotation} scale={s} />
                </BoneSegment>
              </BoneSegment>
            </PelvisMount>
            <PelvisMount attachId="hip_r">
              <BoneSegment partId="thigh-right" rotation={art.rightThigh.rotation} scale={s}>
                <BoneSegment partId="calf-right" rotation={art.rightCalf.rotation} scale={s}>
                  <BoneSegment partId="boot-right" rotation={art.rightBoot.rotation} scale={s} />
                </BoneSegment>
              </BoneSegment>
            </PelvisMount>
          </BoneSegment>
        </TorsoMount>

        {/* Arms */}
        <TorsoMount attachId="shoulder_l">
          <BoneSegment partId="upper-arm-left" rotation={art.leftUpperArm.rotation} scale={s}>
            <BoneSegment partId="forearm-left" rotation={art.leftForearm.rotation} scale={s}>
              <BoneSegment partId="glove-left" rotation={art.leftGlove.rotation} scale={s} />
            </BoneSegment>
          </BoneSegment>
        </TorsoMount>

        <TorsoMount attachId="shoulder_r">
          <BoneSegment partId="upper-arm-right" rotation={art.rightUpperArm.rotation} scale={s}>
            <BoneSegment partId="forearm-right" rotation={art.rightForearm.rotation} scale={s}>
              <BoneSegment partId="glove-right" rotation={art.rightGlove.rotation} scale={s} />
            </BoneSegment>
          </BoneSegment>
        </TorsoMount>

        {/* Head */}
        <TorsoMount attachId="neck">
          <BoneSegment partId="head" rotation={art.head.rotation} scale={s} />
        </TorsoMount>
      </TorsoRoot>
    </div>
  );
}
