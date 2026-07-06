import { useMemo } from 'react';
import * as THREE from 'three';

interface CeilingChainProps {
  /** World Y of the top attachment point. */
  topY: number;
  /** Total chain length downward from topY. */
  length: number;
  linkCount?: number;
  linkRadius?: number;
}

/** Linked metal chain hanging from the ceiling mount to the bag pivot. */
export function CeilingChain({ topY, length, linkCount = 9, linkRadius = 0.026 }: CeilingChainProps) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#7a7a84',
        metalness: 0.82,
        roughness: 0.32,
      }),
    []
  );

  const spacing = length / linkCount;

  return (
    <group>
      {Array.from({ length: linkCount }, (_, i) => {
        const y = topY - spacing * (i + 0.5);
        return (
          <mesh
            key={i}
            position={[0, y, 0]}
            rotation={[Math.PI / 2, 0, i % 2 === 0 ? 0 : Math.PI / 2]}
            material={material}
          >
            <torusGeometry args={[linkRadius * 1.2, linkRadius * 0.42, 8, 14]} />
          </mesh>
        );
      })}
    </group>
  );
}
