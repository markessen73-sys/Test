import { Text } from '@react-three/drei';

/** Cartoon gym set — Mick's place, warm grit. */
export function CartoonGym() {
  const brick = '#9B4E32';
  const brickDark = '#7A3C28';
  const wood = '#B8956B';
  const woodDark = '#8B6914';
  const beam = '#4A3728';

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial color={woodDark} roughness={0.9} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-8 + i * 2, 0.005, 0]}
        >
          <planeGeometry args={[1.9, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? wood : '#A67C52'} roughness={0.92} />
        </mesh>
      ))}

      {/* Walls */}
      <mesh position={[0, 3.5, -8]} receiveShadow>
        <planeGeometry args={[18, 8]} />
        <meshStandardMaterial color={brick} roughness={1} />
      </mesh>
      <mesh position={[-9, 3.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color={brickDark} roughness={1} />
      </mesh>
      <mesh position={[9, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color={brick} roughness={1} />
      </mesh>

      {/* Ceiling beams */}
      {[-5, 0, 5].map((x) => (
        <mesh key={x} position={[x, 6.2, 0]}>
          <boxGeometry args={[0.3, 0.4, 16]} />
          <meshStandardMaterial color={beam} roughness={0.9} />
        </mesh>
      ))}

      {/* MICK'S GYM sign */}
      <group position={[0, 5.2, -7.85]}>
        <mesh>
          <boxGeometry args={[4.5, 1.0, 0.12]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[4.3, 0.85, 0.02]} />
          <meshStandardMaterial color="#E8C840" emissive="#B8860B" emissiveIntensity={0.2} roughness={0.7} />
        </mesh>
        <Text position={[0, 0, 0.14]} fontSize={0.42} color="#8B0000" anchorX="center" anchorY="middle">
          {`MICK'S GYM`}
        </Text>
      </group>

      {/* Windows */}
      {[-5.5, 5.5].map((x) => (
        <group key={x} position={[x, 3.5, -7.9]}>
          <mesh>
            <boxGeometry args={[2.0, 1.6, 0.06]} />
            <meshStandardMaterial color="#1a2530" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[1.7, 1.3, 0.02]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} emissive="#FFE4B5" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}

      {/* Punching bag rack on back wall (decorative extra bags) */}
      {[-3, 3].map((x) => (
        <group key={`extra-${x}`} position={[x, 0, -7]}>
          <mesh position={[0, 3.2, 0.3]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
            <meshStandardMaterial color="#555" metalness={0.5} />
          </mesh>
          <mesh position={[0, 2.2, 0.3]}>
            <cylinderGeometry args={[0.2, 0.25, 1.4, 12]} />
            <meshStandardMaterial color="#2a2030" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Bench */}
      <group position={[-7.5, 0, 6]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2.0, 0.1, 0.55]} />
          <meshStandardMaterial color={beam} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]}>
            <boxGeometry args={[0.1, 0.4, 0.45]} />
            <meshStandardMaterial color={beam} />
          </mesh>
        ))}
      </group>

      {/* Speedball platform area marker (west wall) */}
      <mesh position={[-5.8, 0.01, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 1.2]} />
        <meshStandardMaterial color="#5C4033" roughness={0.95} />
      </mesh>

      {/* Radiator */}
      <group position={[7.5, 0, -6]}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[-0.85 + i * 0.19, 0.4, 0]}>
            <boxGeometry args={[0.07, 0.8, 0.3]} />
            <meshStandardMaterial color="#888" metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Gloves on wall */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 2.5, -7.8]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#8B0000" roughness={0.7} />
        </mesh>
      ))}

      {/* Jump rope on hook */}
      <group position={[7.8, 2.8, -7.5]}>
        <mesh>
          <torusGeometry args={[0.06, 0.015, 6, 12]} />
          <meshStandardMaterial color="#666" metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <torusGeometry args={[0.15, 0.012, 6, 16]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </group>

      {/* Central hanging bulb over ring */}
      <group position={[0, 6, 0]}>
        <mesh>
          <cylinderGeometry args={[0.012, 0.012, 1.4, 6]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#FFF8DC" emissive="#FFE4B5" emissiveIntensity={2.5} />
        </mesh>
        <pointLight position={[0, -0.8, 0]} intensity={20} color="#FFE4B5" distance={14} decay={2} castShadow />
      </group>

      <ambientLight intensity={0.4} color="#FFE4B5" />
      <directionalLight position={[5, 10, 5]} intensity={0.9} color="#FFD699" castShadow />
      <pointLight position={[-7, 5, 3]} intensity={5} color="#FFB347" distance={12} />
      <pointLight position={[7, 5, -3]} intensity={4} color="#FFA07A" distance={12} />
      <fog attach="fog" args={['#1a1208', 10, 24]} />
    </group>
  );
}
