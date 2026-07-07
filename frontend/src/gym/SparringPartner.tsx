import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface SparringPartnerProps {
  dimmed?: boolean;
  /** 0 = full hit flash, 1+ = no flash */
  hitFlashAge?: number;
  /** Idle bob-and-weave on upper body */
  animate?: boolean;
  innerRef?: RefObject<Group | null>;
}

const SKIN = '#C49A6C';
const SHORTS = '#1a1a8b';
const GLOVE = '#8B0000';
const OUTLINE = '#1f1208';
const WAIST_Y = 0.86;

function segmentPose(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from);
  const length = dir.length();
  if (length < 1e-4) return null;
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return { mid, length, quat };
}

function Limb({
  from,
  to,
  radius,
  color,
  opacity = 1,
  emissive = '#000000',
  emissiveIntensity = 0,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
  color: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const pose = useMemo(() => segmentPose(from, to), [from, to]);
  if (!pose) return null;
  const shaft = Math.max(0.02, pose.length - radius * 2);

  return (
    <group position={pose.mid} quaternion={pose.quat}>
      <mesh castShadow>
        <capsuleGeometry args={[radius, shaft, 10, 16]} />
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.72}
        />
      </mesh>
      <mesh scale={1.07}>
        <capsuleGeometry args={[radius, shaft, 8, 12]} />
        <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity * 0.9} />
      </mesh>
    </group>
  );
}

function Joint({
  position,
  radius,
  color,
  opacity = 1,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
  opacity?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 14, 14]} />
        <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={0.72} />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 12, 12]} />
        <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity * 0.9} />
      </mesh>
    </group>
  );
}

/** Front-facing boxer — wide stance, arms at sides, optional upper-body weave. */
export function SparringPartner({
  dimmed = false,
  hitFlashAge = 1,
  animate = false,
  innerRef,
}: SparringPartnerProps) {
  const upperRef = useRef<Group>(null);
  const opacity = dimmed ? 0.35 : 1;
  const flash = hitFlashAge < 1;
  const skinColor = flash ? '#e8b090' : SKIN;
  const emissive = flash ? '#ff6644' : '#000000';
  const emissiveIntensity = flash ? 0.35 * (1 - hitFlashAge) : 0;

  const legs = useMemo(() => {
    const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
    return {
      lHip: v(-0.22, WAIST_Y, 0),
      rHip: v(0.22, WAIST_Y, 0),
      lKnee: v(-0.28, 0.48, 0.04),
      rKnee: v(0.28, 0.48, 0.04),
      lAnkle: v(-0.27, 0.14, 0.06),
      rAnkle: v(0.27, 0.14, 0.06),
      lFoot: v(-0.3, 0.02, 0.12),
      rFoot: v(0.3, 0.02, 0.12),
    };
  }, []);

  const upper = useMemo(() => {
    const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y - WAIST_Y, z);
    return {
      pelvis: v(0, WAIST_Y),
      chest: v(0, 1.22),
      neck: v(0, 1.44, 0.02),
      head: v(0, 1.58, 0.06),
      lShoulder: v(-0.24, 1.38, 0.01),
      rShoulder: v(0.24, 1.38, 0.01),
      lElbow: v(-0.3, 1.04, 0.03),
      rElbow: v(0.3, 1.04, 0.03),
      lWrist: v(-0.33, 0.74, 0.05),
      rWrist: v(0.33, 0.74, 0.05),
      lGlove: v(-0.34, 0.64, 0.07),
      rGlove: v(0.34, 0.64, 0.07),
    };
  }, []);

  useFrame((state) => {
    if (!animate || !upperRef.current) return;
    const t = state.clock.elapsedTime;
    const swayX = Math.sin(t * 1.55) * 0.08 + Math.sin(t * 2.85) * 0.035;
    const bobY = Math.sin(t * 2.35) * 0.038;
    const leanZ = Math.sin(t * 1.25) * 0.1;
    upperRef.current.position.set(swayX, bobY, 0);
    upperRef.current.rotation.set(Math.sin(t * 1.65) * 0.045, Math.sin(t * 1.08) * 0.055, leanZ);
  });

  return (
    <group ref={innerRef}>
      {/* Legs — wide boxing stance, planted */}
      <Limb from={legs.lHip} to={legs.lKnee} radius={0.082} color={skinColor} opacity={opacity} />
      <Limb from={legs.lKnee} to={legs.lAnkle} radius={0.068} color={skinColor} opacity={opacity} />
      <Limb from={legs.lAnkle} to={legs.lFoot} radius={0.052} color={skinColor} opacity={opacity} />
      <Limb from={legs.rHip} to={legs.rKnee} radius={0.082} color={skinColor} opacity={opacity} />
      <Limb from={legs.rKnee} to={legs.rAnkle} radius={0.068} color={skinColor} opacity={opacity} />
      <Limb from={legs.rAnkle} to={legs.rFoot} radius={0.052} color={skinColor} opacity={opacity} />

      {/* Upper body — bobs and weaves at the waist */}
      <group ref={upperRef} position={[0, WAIST_Y, 0]}>
        <Limb
          from={upper.pelvis}
          to={upper.chest}
          radius={0.17}
          color={skinColor}
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
        <Limb
          from={upper.chest}
          to={upper.neck}
          radius={0.14}
          color={skinColor}
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />

        <group position={[0, 0.04, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.22, 0.28]} />
            <meshStandardMaterial color={SHORTS} transparent={opacity < 1} opacity={opacity} roughness={0.85} />
          </mesh>
          <mesh scale={1.06}>
            <boxGeometry args={[0.48, 0.22, 0.28]} />
            <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity * 0.85} />
          </mesh>
        </group>

        <group position={upper.head}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 20, 20]} />
            <meshStandardMaterial
              color={skinColor}
              transparent={opacity < 1}
              opacity={opacity}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
              roughness={0.65}
            />
          </mesh>
          <mesh scale={1.07}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity * 0.9} />
          </mesh>
          {!dimmed && <CartoonFace scale={0.62} />}
        </group>

        <Limb from={upper.lShoulder} to={upper.lElbow} radius={0.065} color={skinColor} opacity={opacity} />
        <Limb from={upper.lElbow} to={upper.lWrist} radius={0.055} color={skinColor} opacity={opacity} />
        <Limb from={upper.lWrist} to={upper.lGlove} radius={0.048} color={skinColor} opacity={opacity} />
        <Joint position={[upper.lGlove.x, upper.lGlove.y, upper.lGlove.z]} radius={0.1} color={GLOVE} opacity={opacity} />

        <Limb from={upper.rShoulder} to={upper.rElbow} radius={0.065} color={skinColor} opacity={opacity} />
        <Limb from={upper.rElbow} to={upper.rWrist} radius={0.055} color={skinColor} opacity={opacity} />
        <Limb from={upper.rWrist} to={upper.rGlove} radius={0.048} color={skinColor} opacity={opacity} />
        <Joint position={[upper.rGlove.x, upper.rGlove.y, upper.rGlove.z]} radius={0.1} color={GLOVE} opacity={opacity} />

        <Joint position={[upper.lShoulder.x, upper.lShoulder.y, upper.lShoulder.z]} radius={0.07} color={skinColor} opacity={opacity} />
        <Joint position={[upper.rShoulder.x, upper.rShoulder.y, upper.rShoulder.z]} radius={0.07} color={skinColor} opacity={opacity} />
      </group>
    </group>
  );
}
