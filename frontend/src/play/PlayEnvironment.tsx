/** Shared backdrop for dedicated play-mode scenes. */
export function PlayEnvironment() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3, -6]} receiveShadow>
        <planeGeometry args={[12, 7]} />
        <meshStandardMaterial color="#9B4E32" roughness={1} />
      </mesh>
      <ambientLight intensity={0.55} color="#FFE4B5" />
      <directionalLight position={[2, 6, 2]} intensity={1.2} color="#FFD699" castShadow />
      <pointLight position={[0, 4, 0]} intensity={10} color="#FFE4B5" distance={10} />
      <fog attach="fog" args={['#1a1208', 5, 16]} />
    </>
  );
}
