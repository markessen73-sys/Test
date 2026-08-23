/** Simple cartoon face drawn with basic 3D shapes — no photos. */
export function CartoonFace({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* Eyes */}
      <mesh position={[-0.12, 0.05, 0.02]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.12, 0.05, 0.02]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-0.12, 0.04, 0.09]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.12, 0.04, 0.09]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Nose */}
      <mesh position={[0, -0.04, 0.1]} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#D4A574" />
      </mesh>
    </group>
  );
}
