import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface SparringPartnerProps {
  dimmed?: boolean;
  /** 0 = full hit flash, 1+ = no flash */
  hitFlashAge?: number;
  innerRef?: RefObject<THREE.Group | null>;
}

const SKIN = '#C49A6C';
const SHORTS = '#1a1a8b';
const GLOVE = '#8B0000';
const OUTLINE = '#1f1208';

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

/** Front-facing boxer silhouette — arms relaxed at the sides. */
export function SparringPartner({ dimmed = false, hitFlashAge = 1, innerRef }: SparringPartnerProps) {
  const opacity = dimmed ? 0.35 : 1;
  const flash = hitFlashAge < 1;
  const skinColor = flash ? '#e8b090' : SKIN;
  const emissive = flash ? '#ff6644' : '#000000';
  const emissiveIntensity = flash ? 0.35 * (1 - hitFlashAge) : 0;

  const p = useMemo(() => {
    const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
    return {
      head: v(0, 1.58, 0.06),
      neck: v(0, 1.44, 0.02),
      chest: v(0, 1.22, 0),
      waist: v(0, 0.96, 0),
      pelvis: v(0, 0.86, 0),
      lShoulder: v(-0.24, 1.38, 0.01),
      rShoulder: v(0.24, 1.38, 0.01),
      lElbow: v(-0.3, 1.04, 0.03),
      rElbow: v(0.3, 1.04, 0.03),
      lWrist: v(-0.33, 0.74, 0.05),
      rWrist: v(0.33, 0.74, 0.05),
      lGlove: v(-0.34, 0.64, 0.07),
      rGlove: v(0.34, 0.64, 0.07),
      lHip: v(-0.13, 0.86, 0),
      rHip: v(0.13, 0.86, 0),
      lKnee: v(-0.15, 0.48, 0.03),
      rKnee: v(0.15, 0.48, 0.03),
      lAnkle: v(-0.14, 0.14, 0.05),
      rAnkle: v(0.14, 0.14, 0.05),
      lFoot: v(-0.16, 0.02, 0.1),
      rFoot: v(0.16, 0.02, 0.1),
    };
  }, []);

  return (
    <group ref={innerRef}>
      {/* Torso */}
      <Limb
        from={p.pelvis}
        to={p.chest}
        radius={0.17}
        color={skinColor}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      <Limb
        from={p.chest}
        to={p.neck}
        radius={0.14}
        color={skinColor}
        opacity={opacity}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />

      {/* Shorts */}
      <group position={[0, 0.9, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.22, 0.28]} />
          <meshStandardMaterial color={SHORTS} transparent={opacity < 1} opacity={opacity} roughness={0.85} />
        </mesh>
        <mesh scale={1.06}>
          <boxGeometry args={[0.46, 0.22, 0.28]} />
          <meshBasicMaterial color={OUTLINE} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity * 0.85} />
        </mesh>
      </group>

      {/* Head */}
      <group position={p.head}>
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

      {/* Arms down at sides */}
      <Limb from={p.lShoulder} to={p.lElbow} radius={0.065} color={skinColor} opacity={opacity} />
      <Limb from={p.lElbow} to={p.lWrist} radius={0.055} color={skinColor} opacity={opacity} />
      <Limb from={p.lWrist} to={p.lGlove} radius={0.048} color={skinColor} opacity={opacity} />
      <Joint position={[p.lGlove.x, p.lGlove.y, p.lGlove.z]} radius={0.1} color={GLOVE} opacity={opacity} />

      <Limb from={p.rShoulder} to={p.rElbow} radius={0.065} color={skinColor} opacity={opacity} />
      <Limb from={p.rElbow} to={p.rWrist} radius={0.055} color={skinColor} opacity={opacity} />
      <Limb from={p.rWrist} to={p.rGlove} radius={0.048} color={skinColor} opacity={opacity} />
      <Joint position={[p.rGlove.x, p.rGlove.y, p.rGlove.z]} radius={0.1} color={GLOVE} opacity={opacity} />

      <Joint position={[p.lShoulder.x, p.lShoulder.y, p.lShoulder.z]} radius={0.07} color={skinColor} opacity={opacity} />
      <Joint position={[p.rShoulder.x, p.rShoulder.y, p.rShoulder.z]} radius={0.07} color={skinColor} opacity={opacity} />

      {/* Legs */}
      <Limb from={p.lHip} to={p.lKnee} radius={0.08} color={skinColor} opacity={opacity} />
      <Limb from={p.lKnee} to={p.lAnkle} radius={0.065} color={skinColor} opacity={opacity} />
      <Limb from={p.lAnkle} to={p.lFoot} radius={0.05} color={skinColor} opacity={opacity} />

      <Limb from={p.rHip} to={p.rKnee} radius={0.08} color={skinColor} opacity={opacity} />
      <Limb from={p.rKnee} to={p.rAnkle} radius={0.065} color={skinColor} opacity={opacity} />
      <Limb from={p.rAnkle} to={p.rFoot} radius={0.05} color={skinColor} opacity={opacity} />
    </group>
  );
}
