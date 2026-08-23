import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { BoxingRing } from './BoxingRing';
import { CameraRig } from './CameraRig';
import { CartoonGym } from './CartoonGym';
import { BoboDoll, HeavyBag, Speedball } from './Equipment';
import type { GymStation, StationInfo, ViewMode } from '../types/game';
import { getCameraShot, getStation } from '../types/game';

interface BoxingGymSceneProps {
  stationId: GymStation;
  viewMode: ViewMode;
}

function GymWorld({ station, viewMode }: { station: StationInfo; viewMode: ViewMode }) {
  const shot = getCameraShot(station, viewMode);
  const isHighlighted = (id: GymStation) => station.id === id;

  return (
    <>
      <CartoonGym />
      <CameraRig shot={shot} />

      <BoxingRing highlighted={isHighlighted('ring')} />
      <Speedball highlighted={isHighlighted('speedball')} position={getStation('speedball').equipmentPos} />
      <HeavyBag highlighted={isHighlighted('heavy-bag')} position={getStation('heavy-bag').equipmentPos} />
      <BoboDoll highlighted={isHighlighted('bobo-doll')} position={getStation('bobo-doll').equipmentPos} />

      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={20} blur={2.5} />
    </>
  );
}

export function BoxingGymScene({ stationId, viewMode }: BoxingGymSceneProps) {
  const station = getStation(stationId);
  const shot = getCameraShot(station, viewMode);

  return (
    <Canvas
      shadows
      camera={{ position: shot.position, fov: shot.fov, near: 0.1, far: 50 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#1a1208']} />
        <GymWorld station={station} viewMode={viewMode} />
      </Suspense>
    </Canvas>
  );
}
