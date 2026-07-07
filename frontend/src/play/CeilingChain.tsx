import { useMemo } from 'react';
import * as THREE from 'three';

interface CeilingChainProps {
  /** World Y of the top attachment point. */
  topY: number;
  /** Total chain length downward from topY. */
  length: number;
  linkCount?: number;
}

const LINK_W = 0.095;
const LINK_H = 0.052;
const LINK_T = 0.038;

/** Heavy interlocking chain — chunky steel links from ceiling to bag. */
export function CeilingChain({ topY, length, linkCount = 14 }: CeilingChainProps) {
  const linkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3a3a42',
        metalness: 0.92,
        roughness: 0.28,
      }),
    []
  );
  const pinMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#555560',
        metalness: 0.95,
        roughness: 0.22,
      }),
    []
  );

  const spacing = length / linkCount;

  return (
    <group>
      {Array.from({ length: linkCount }, (_, i) => {
        const y = topY - spacing * (i + 0.5);
        const rotZ = i % 2 === 0 ? 0 : Math.PI / 2;
        return (
          <group key={i} position={[0, y, 0]} rotation={[0, 0, rotZ]}>
            <mesh material={linkMat} castShadow>
              <boxGeometry args={[LINK_W, LINK_H, LINK_T]} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={pinMat}>
              <cylinderGeometry args={[0.014, 0.014, LINK_T + 0.018, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
