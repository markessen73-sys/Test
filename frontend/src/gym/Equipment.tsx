import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CeilingChain } from '../play/CeilingChain';
import { BAG_CHAIN_LENGTH } from '../play/bagSwing';
import { BOBO_FACE_CENTER, createBoboFacePatchGeometry } from '../play/face/boboFacePlacement';
import { BoboDollDecor } from '../play/face/BoboDollDecor';
import { useCharacter } from '../play/face/CharacterContext';
import { SpeedballFaceDecal } from '../play/face/SpeedballFaceDecal';
import { BagPolaroid } from '../play/face/BagPolaroid';
import { SPEEDBALL_BALL_Y } from '../play/playCamera';

interface EquipmentProps {
  highlighted: boolean;
  position?: [number, number, number];
}

const DIM = 0.35;

export function Speedball({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const ballRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ballRef.current || !highlighted) return;
    const idle = Math.sin(Date.now() * 0.004) * 0.08;
    ballRef.current.position.x = idle;
    ballRef.current.rotation.z = idle * 2;
  });

  return (
    <group position={position}>
      <mesh position={[0, 3.05, -0.35]}>
        <boxGeometry args={[1.0, 0.14, 0.2]} />
        <meshStandardMaterial color="#4A3728" />
      </mesh>
      <mesh position={[0, 2.6, -0.25]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
        <meshStandardMaterial color="#777" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.2, 0.08, 1.0]} />
        <meshStandardMaterial color="#5C4033" />
      </mesh>

      <group ref={ballRef} position={[0, SPEEDBALL_BALL_Y, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial
            color="#D42020"
            roughness={0.45}
            transparent={!highlighted}
            opacity={highlighted ? 1 : DIM}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.3, 0.04, 8, 24]} />
          <meshStandardMaterial color="#EEE" transparent={!highlighted} opacity={highlighted ? 1 : DIM} />
        </mesh>
        <SpeedballFaceDecal opacity={highlighted ? 1 : DIM} />
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.65, 0.85, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

export function HeavyBag({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const bagRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (!bagRef.current) return;
    const idle = highlighted ? Math.sin(Date.now() * 0.002) * 0.03 : 0;
    const hit = swing > 0 ? Math.sin(swing) * 0.2 : 0;
    bagRef.current.rotation.z = idle + hit;
    if (swing > 0) setSwing((s) => Math.max(0, s - delta * 2));
  });

  return (
    <group position={position}>
      <mesh position={[0, 3.55, 0]}>
        <boxGeometry args={[0.22, 0.1, 0.22]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} />
      </mesh>
      <CeilingChain topY={3.5} length={BAG_CHAIN_LENGTH * 0.85} linkCount={12} />

      <group ref={bagRef} position={[0, 1.3, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.38, 0.44, 2.0, 20]} />
          <meshStandardMaterial
            color="#1a1a28"
            roughness={0.9}
            transparent={!highlighted}
            opacity={highlighted ? 1 : DIM}
          />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 0.12, 20]} />
          <meshStandardMaterial color="#2a2a3a" />
        </mesh>
        <group scale={0.9}>
          <BagPolaroid stage={0} opacity={highlighted ? 1 : DIM} />
        </group>
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.75, 0.95, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

function BoboBrowseFace({ opacity }: { opacity: number }) {
  const { character } = useCharacter();
  const [map, setMap] = useState<THREE.Texture | null>(null);
  const geometry = useMemo(() => createBoboFacePatchGeometry(), []);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let tex: THREE.Texture | null = null;
    loader.load(character.cleanSrc, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      tex = t;
      setMap(t);
    });
    return () => {
      tex?.dispose();
    };
  }, [character.cleanSrc]);
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);
  if (!map) return null;
  return (
    <mesh position={BOBO_FACE_CENTER} renderOrder={2}>
      <primitive attach="geometry" object={geometry} />
      <meshBasicMaterial
        map={map}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export function BoboDoll({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const dollRef = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.16,
        metalness: 0.1,
        transparent: !highlighted,
        opacity: highlighted ? 1 : DIM,
      }),
    [highlighted]
  );

  useFrame(() => {
    if (!dollRef.current || !highlighted) return;
    const t = Date.now() * 0.001;
    dollRef.current.rotation.x = Math.sin(t * 1.35) * 0.02;
    dollRef.current.rotation.z = Math.sin(t * 1.1 + 0.8) * 0.025;
  });

  return (
    <group position={position}>
      <group ref={dollRef}>
        <mesh position={[0, 0.52, 0]} castShadow material={material}>
          <sphereGeometry args={[0.52, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow material={material}>
          <cylinderGeometry args={[0.4, 0.52, 1.45, 24]} />
        </mesh>
        <mesh position={[0, 2.28, 0]} castShadow material={material}>
          <sphereGeometry args={[0.44, 24, 24]} />
        </mesh>
        <BoboDollDecor opacity={highlighted ? 1 : DIM} />
        <BoboBrowseFace opacity={highlighted ? 1 : DIM} />
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}
