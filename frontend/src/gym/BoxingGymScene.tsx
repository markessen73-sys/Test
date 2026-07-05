import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { BoxingRing } from './BoxingRing';
import { CameraRig } from './CameraRig';
import { CartoonGym } from './CartoonGym';
import { BoboDoll, HeavyBag, Speedball } from './Equipment';
import type { GymStation, PunchType, StationInfo } from '../types/game';
import { getStation } from '../types/game';

interface BoxingGymSceneProps {
  stationId: GymStation;
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
}

function GymContents({
  station,
  caricatureUrl,
  onPunch,
  lastPunch,
  combo,
}: {
  station: StationInfo;
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
}) {
  const isActive = (id: GymStation) => station.id === id;
  const shared = { caricatureUrl, onPunch, lastPunch, combo };

  return (
    <>
      <CartoonGym />
      <CameraRig station={station} />

      <BoxingRing {...shared} active={isActive('ring')} />

      <Speedball
        {...shared}
        active={isActive('speedball')}
        position={getStation('speedball').equipmentPos}
      />
      <HeavyBag
        {...shared}
        active={isActive('heavy-bag')}
        position={getStation('heavy-bag').equipmentPos}
      />
      <BoboDoll
        {...shared}
        active={isActive('bobo-doll')}
        position={getStation('bobo-doll').equipmentPos}
      />

      <ContactShadows position={[0, 0.02, 0]} opacity={0.45} scale={18} blur={2.5} />
    </>
  );
}

export function BoxingGymScene({ stationId, caricatureUrl, onPunch, lastPunch, combo }: BoxingGymSceneProps) {
  const station = getStation(stationId);

  return (
    <Canvas
      shadows
      camera={{ position: station.cameraPos, fov: 48, near: 0.1, far: 50 }}
      style={{ width: '100%', height: '100%', background: '#1a1208' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <GymContents
          station={station}
          caricatureUrl={caricatureUrl}
          onPunch={onPunch}
          lastPunch={lastPunch}
          combo={combo}
        />
      </Suspense>
    </Canvas>
  );
}
