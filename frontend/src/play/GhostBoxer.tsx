import { useMemo } from 'react';
import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { computeBodyPose } from './bodyPose';

interface GhostBoxerProps {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  screenToWorld: (pos: GlovePosition) => THREE.Vector3;
}

/** Subtle 3D arm depth — follows IK pose from bodyPose. */
export function GhostBoxer({ leftPos, rightPos, screenToWorld }: GhostBoxerProps) {
  const pose = useMemo(() => computeBodyPose(leftPos, rightPos), [leftPos, rightPos]);

  const leftUpper = useMemo(() => screenToWorld(pose.left.shoulder), [pose.left.shoulder, screenToWorld]);
  const leftElbow = useMemo(() => screenToWorld(pose.left.elbow), [pose.left.elbow, screenToWorld]);
  const leftHand = useMemo(() => screenToWorld(pose.left.hand), [pose.left.hand, screenToWorld]);
  const rightUpper = useMemo(() => screenToWorld(pose.right.shoulder), [pose.right.shoulder, screenToWorld]);
  const rightElbow = useMemo(() => screenToWorld(pose.right.elbow), [pose.right.elbow, screenToWorld]);
  const rightHand = useMemo(() => screenToWorld(pose.right.hand), [pose.right.hand, screenToWorld]);

  return (
    <group position={[0, -0.1, 0.1]}>
      <ArmSegment from={leftUpper} to={leftElbow} width={0.055} />
      <ArmSegment from={leftElbow} to={leftHand} width={0.045} />
      <ArmSegment from={rightUpper} to={rightElbow} width={0.055} />
      <ArmSegment from={rightElbow} to={rightHand} width={0.045} />
    </group>
  );
}

function ArmSegment({
  from,
  to,
  width,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  width: number;
}) {
  const mid = useMemo(() => from.clone().lerp(to, 0.5), [from, to]);
  const len = from.distanceTo(to);
  if (len < 0.001) return null;
  const dir = to.clone().sub(from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[width * 0.85, width, len, 8]} />
      <meshBasicMaterial color="#E8C49A" transparent opacity={0.1} depthWrite={false} />
    </mesh>
  );
}
