import { Text } from '@react-three/drei';

/** Cartoon Rocky-style gym interior — exposed brick, wood floors, warm grit. */
export function CartoonGym() {
  const brick = '#9B4E32';
  const brickDark = '#7A3C28';
  const wood = '#B8956B';
  const woodDark = '#8B6914';
  const beam = '#4A3728';

  return (
    <group>
      {/* Wooden floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color={woodDark} roughness={0.85} />
      </mesh>
      {/* Floor planks detail */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={`plank-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-7 + i * 2, 0.005, 0]}
        >
          <planeGeometry args={[1.9, 14]} />
          <meshStandardMaterial color={i % 2 === 0 ? wood : '#A67C52'} roughness={0.9} />
        </mesh>
      ))}

      {/* Back wall — brick */}
      <mesh position={[0, 3, -7]} receiveShadow>
        <planeGeometry args={[16, 7]} />
        <meshStandardMaterial color={brick} roughness={1} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-8, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[14, 7]} />
        <meshStandardMaterial color={brickDark} roughness={1} />
      </mesh>

      {/* Right wall */}
      <mesh position={[8, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[14, 7]} />
        <meshStandardMaterial color={brick} roughness={1} />
      </mesh>

      {/* Exposed ceiling beams */}
      {[-4, 0, 4].map((x) => (
        <mesh key={`beam-${x}`} position={[x, 5.8, 0]}>
          <boxGeometry args={[0.25, 0.35, 14]} />
          <meshStandardMaterial color={beam} roughness={0.9} />
        </mesh>
      ))}

      {/* MICKEY'S GYM sign */}
      <group position={[0, 4.8, -6.7]}>
        <mesh>
          <boxGeometry args={[4.2, 0.9, 0.1]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[4, 0.75, 0.02]} />
          <meshStandardMaterial
            color="#E8C840"
            emissive="#B8860B"
            emissiveIntensity={0.15}
            roughness={0.7}
          />
        </mesh>
        <Text
          position={[0, 0, 0.12]}
          fontSize={0.38}
          color="#8B0000"
          anchorX="center"
          anchorY="middle"
        >
          MICKEY'S GYM
        </Text>
      </group>

      {/* Grimy windows */}
      {[-5, 5].map((x) => (
        <group key={`win-${x}`} position={[x, 3.2, -6.85]}>
          <mesh>
            <boxGeometry args={[1.8, 1.4, 0.05]} />
            <meshStandardMaterial color="#1a2530" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[1.6, 1.2, 0.02]} />
            <meshStandardMaterial
              color="#87CEEB"
              transparent
              opacity={0.35}
              emissive="#FFE4B5"
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Old bench */}
      <group position={[-6.5, 0, 5]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[1.8, 0.08, 0.5]} />
          <meshStandardMaterial color={beam} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.17, 0]}>
            <boxGeometry args={[0.08, 0.35, 0.4]} />
            <meshStandardMaterial color={beam} />
          </mesh>
        ))}
      </group>

      {/* Radiator */}
      <group position={[6.8, 0, -5.5]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-0.7 + i * 0.2, 0.35, 0]}>
            <boxGeometry args={[0.06, 0.7, 0.25]} />
            <meshStandardMaterial color="#888" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Gloves on wall */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={`glove-${x}`} position={[x, 2.2, -6.8]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#8B0000" roughness={0.7} />
        </mesh>
      ))}

      {/* Hanging light bulb */}
      <group position={[0, 5.2, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1.2, 6]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, -0.65, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color="#FFF8DC"
            emissive="#FFE4B5"
            emissiveIntensity={2}
            transparent
            opacity={0.9}
          />
        </mesh>
        <pointLight position={[0, -0.7, 0]} intensity={15} color="#FFE4B5" distance={12} decay={2} />
      </group>

      {/* Warm ambient gym lights */}
      <ambientLight intensity={0.35} color="#FFE4B5" />
      <directionalLight position={[4, 8, 4]} intensity={0.8} color="#FFD699" castShadow />
      <pointLight position={[-6, 4, 2]} intensity={4} color="#FFB347" distance={10} />
      <pointLight position={[6, 4, -2]} intensity={3} color="#FFA07A" distance={10} />
      <fog attach="fog" args={['#1a1208', 8, 22]} />
    </group>
  );
}
