import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  BOBO_BAND_HEIGHT,
  BOBO_BAND_RADIUS,
  BOBO_BAND_TILT_Z,
  BOBO_BAND_Y,
  BOBO_HAT_POS,
  BOBO_HAT_ROT,
  BOBO_STAR_COLORS,
  createBoboBandTexture,
  createBoboHatTexture,
  createOddStarGeometry,
} from './boboDollDecorations';

/** Odd count of stars above / below the sash (3 each). */
const STARS_PER_SIDE = 3;

function StarRow({
  y,
  z,
  starGeo,
  opacity,
  colorOffset,
}: {
  y: number;
  z: number;
  starGeo: THREE.ShapeGeometry;
  opacity: number;
  colorOffset: number;
}) {
  const xs = [-0.16, 0, 0.16];
  return (
    <group position={[0, y, z]}>
      {xs.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} geometry={starGeo} renderOrder={3}>
          <meshStandardMaterial
            color={BOBO_STAR_COLORS[(i + colorOffset) % BOBO_STAR_COLORS.length]}
            roughness={0.35}
            metalness={0.15}
            emissive={BOBO_STAR_COLORS[(i + colorOffset) % BOBO_STAR_COLORS.length]}
            emissiveIntensity={0.18}
            transparent={opacity < 1}
            opacity={opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Carnival accents parented under the doll swing root:
 * triangular clown hat + diagonal striped “BOBO THE CLOWN” sash + odd stars.
 */
export function BoboDollDecor({ opacity = 1 }: { opacity?: number }) {
  const bandMap = useMemo(() => createBoboBandTexture(), []);
  const hatMap = useMemo(() => createBoboHatTexture(), []);
  const starGeo = useMemo(() => createOddStarGeometry(5), []);

  useEffect(() => {
    return () => {
      bandMap.dispose();
      hatMap.dispose();
      starGeo.dispose();
    };
  }, [bandMap, hatMap, starGeo]);

  return (
    <group>
      {/* Triangular party hat on the crown — rides with doll tilt */}
      <group position={BOBO_HAT_POS} rotation={BOBO_HAT_ROT}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <coneGeometry args={[0.2, 0.4, 3]} />
          <meshStandardMaterial
            map={hatMap}
            roughness={0.45}
            metalness={0.05}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.22, 24]} />
          <meshStandardMaterial
            color="#fff8e7"
            roughness={0.6}
            transparent={opacity < 1}
            opacity={opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <sphereGeometry args={[0.055, 14, 14]} />
          <meshStandardMaterial
            color="#ffd54a"
            roughness={0.35}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      </group>

      {/* Diagonal sash + odd stars above / below (local Y = across the sash) */}
      <group position={[0, BOBO_BAND_Y, 0]} rotation={[0, 0, BOBO_BAND_TILT_Z]}>
        <mesh rotation={[0, Math.PI, 0]} castShadow renderOrder={2}>
          <cylinderGeometry
            args={[BOBO_BAND_RADIUS, BOBO_BAND_RADIUS * 1.04, BOBO_BAND_HEIGHT, 48, 1, true]}
          />
          <meshStandardMaterial
            map={bandMap}
            roughness={0.55}
            metalness={0.05}
            transparent={opacity < 1}
            opacity={opacity}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
        <StarRow
          y={BOBO_BAND_HEIGHT * 0.85}
          z={BOBO_BAND_RADIUS + 0.01}
          starGeo={starGeo}
          opacity={opacity}
          colorOffset={0}
        />
        <StarRow
          y={-BOBO_BAND_HEIGHT * 0.85}
          z={BOBO_BAND_RADIUS + 0.01}
          starGeo={starGeo}
          opacity={opacity}
          colorOffset={STARS_PER_SIDE}
        />
      </group>
    </group>
  );
}
