import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { BoxingRing } from './BoxingRing';
import { CameraRig } from './CameraRig';
import { CartoonGym } from './CartoonGym';
import { BoboDoll, HeavyBag, Speedball } from './Equipment';
import type { GymStation, StationInfo } from '../types/game';
import { getStation } from '../types/game';

interface BoxingGymSceneProps {
  stationId: GymStation;
  onHit: () => void;
}

function GymWorld({ station, onHit }: { station: StationInfo; onHit: () => void }) {
  const isActive = (id: GymStation) => station.id === id;

  return (
    <>
      <CartoonGym />
      <CameraRig station={station} />

      <BoxingRing onHit={onHit} active={isActive('ring')} />

      <Speedball
        onHit={onHit}
        active={isActive('speedball')}
        position={getStation('speedball').equipmentPos}
      />
      <HeavyBag
        onHit={onHit}
        active={isActive('heavy-bag')}
        position={getStation('heavy-bag').equipmentPos}
      />
      <BoboDoll
        onHit={onHit}
        active={isActive('bobo-doll')}
        position={getStation('bobo-doll').equipmentPos}
      />

      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={20} blur={2.5} />
    </>
  );
}

export function BoxingGymScene({ stationId, onHit }: BoxingGymSceneProps) {
  const station = getStation(stationId);

  return (
    <Canvas
      shadows
      camera={{ position: station.cameraPos, fov: 46, near: 0.1, far: 50 }}
      style={{ width: '100%', height: '100%', background: '#1a1208' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <GymWorld station={station} onHit={onHit} />
      </Suspense>
    </Canvas>
  );
}
