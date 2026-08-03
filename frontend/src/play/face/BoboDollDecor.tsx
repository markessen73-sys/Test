import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  BOBO_BAND_HEIGHT,
  BOBO_BAND_RADIUS,
  BOBO_BAND_Y,
  BOBO_HAT_POS,
  BOBO_HAT_ROT,
  createBoboBandTexture,
  createBoboHatTexture,
} from './boboDollDecorations';

/**
 * Carnival accents parented under the doll swing root:
 * triangular clown hat + striped “BOBO THE CLOWN” body band.
 */
export function BoboDollDecor({ opacity = 1 }: { opacity?: number }) {
  const bandMap = useMemo(() => createBoboBandTexture(), []);
  const hatMap = useMemo(() => createBoboHatTexture(), []);

  useEffect(() => {
    return () => {
      bandMap.dispose();
      hatMap.dispose();
    };
  }, [bandMap, hatMap]);

  return (
    <group>
      {/* Triangular party hat on the crown — rides with doll tilt */}
      <group position={BOBO_HAT_POS} rotation={BOBO_HAT_ROT}>
        <mesh position={[0, 0.2, 0]} castShadow>
          {/* 3 radial segments → triangle pyramid */}
          <coneGeometry args={[0.2, 0.4, 3]} />
          <meshStandardMaterial
            map={hatMap}
            roughness={0.45}
            metalness={0.05}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {/* Brim */}
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
        {/* Pom-pom tip */}
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

      {/* Striped body band with name — rotate so lettering faces the camera (+Z) */}
      <mesh position={[0, BOBO_BAND_Y, 0]} rotation={[0, Math.PI, 0]} castShadow>
        <cylinderGeometry args={[BOBO_BAND_RADIUS, BOBO_BAND_RADIUS * 1.04, BOBO_BAND_HEIGHT, 48, 1, true]} />
        <meshStandardMaterial
          map={bandMap}
          roughness={0.55}
          metalness={0.05}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
