import { useMemo } from 'react';
import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { solveBoxerPose } from './skeleton/solvePose';

interface GhostBoxerProps {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  screenToWorld: (pos: GlovePosition) => THREE.Vector3;
}

/** Subtle 3D arm depth following skeletal IK. */
export function GhostBoxer({ leftPos, rightPos, screenToWorld }: GhostBoxerProps) {
  const pose = useMemo(() => solveBoxerPose(leftPos, rightPos, performance.now()), [leftPos, rightPos]);

  const segments = useMemo(() => {
    const arms = [pose.leftArm, pose.rightArm];
    return arms.flatMap((arm) => [
      { from: screenToWorld(arm.shoulder), to: screenToWorld(arm.elbow), w: 0.05 },
      { from: screenToWorld(arm.elbow), to: screenToWorld(arm.hand), w: 0.04 },
    ]);
  }, [pose, screenToWorld]);

  return (
    <group position={[0, -0.1, 0.1]}>
      {segments.map((seg, i) => (
        <ArmSegment key={i} from={seg.from} to={seg.to} width={seg.w} />
      ))}
    </group>
  );
}

function ArmSegment({ from, to, width }: { from: THREE.Vector3; to: THREE.Vector3; width: number }) {
  const mid = useMemo(() => from.clone().lerp(to, 0.5), [from, to]);
  const len = from.distanceTo(to);
  if (len < 0.001) return null;
  const dir = to.clone().sub(from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[width * 0.85, width, len, 8]} />
      <meshBasicMaterial color="#C8E8FF" transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}
