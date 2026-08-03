import { playCameraForTarget, RING_PARTNER_TARGET, RING_PLAY_CAMERA } from '../play/playCamera';

export type GymStation = 'ring' | 'speedball' | 'heavy-bag' | 'bobo-doll';

export type ViewMode = 'browse' | 'focus' | 'play';

export interface CameraShot {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface StationInfo {
  id: GymStation;
  name: string;
  description: string;
  emoji: string;
  equipmentPos: [number, number, number];
  overview: CameraShot;
  close: CameraShot;
}

/** Aim points for gym equipment when framing close-ups (matches play-mode distance). */
const GYM_AIM: Record<GymStation, [number, number, number]> = {
  ring: RING_PARTNER_TARGET,
  speedball: [-5.8, 2.15, 0.5],
  'heavy-bag': [0.2, 1.3, -5.5],
  'bobo-doll': [5.8, 1.4, 1.8],
};

export const GYM_STATIONS: StationInfo[] = [
  {
    id: 'ring',
    name: "Mickey's Ring",
    description: 'Sparring in the main ring',
    emoji: '🥊',
    equipmentPos: [0, 0, 0],
    overview: { position: [0, 4.5, 11], lookAt: [0, 1.0, 0], fov: 52 },
    close: RING_PLAY_CAMERA,
  },
  {
    id: 'speedball',
    name: 'Speedball',
    description: 'Fast hands on the speedball',
    emoji: '🏐',
    equipmentPos: [-5.8, 0, 0.5],
    overview: { position: [-6.5, 3.5, 5], lookAt: [-5.8, 1.5, 0.5], fov: 50 },
    close: playCameraForTarget(GYM_AIM.speedball),
  },
  {
    id: 'heavy-bag',
    name: 'Heavy Bag',
    description: 'Power shots on the heavy bag',
    emoji: '🎯',
    equipmentPos: [0.2, 0, -5.5],
    overview: { position: [0.5, 3.5, -9], lookAt: [0.2, 1.2, -5.5], fov: 50 },
    close: playCameraForTarget(GYM_AIM['heavy-bag']),
  },
  {
    id: 'bobo-doll',
    name: 'Bobo Doll',
    description: 'Rock the carnival bobo with your selected face',
    emoji: '🎪',
    equipmentPos: [5.8, 0, 1.8],
    overview: { position: [8.5, 3.5, 5.5], lookAt: [5.8, 1.2, 1.8], fov: 50 },
    close: playCameraForTarget(GYM_AIM['bobo-doll']),
  },
];

export function getStation(id: GymStation): StationInfo {
  return GYM_STATIONS.find((s) => s.id === id) ?? GYM_STATIONS[0];
}

export function getCameraShot(station: StationInfo, mode: ViewMode): CameraShot {
  if (mode === 'play' || mode === 'focus') return station.close;
  return station.overview;
}

/** Normalized screen position 0–1 */
export interface GlovePosition {
  x: number;
  y: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
  isPunch: boolean;
  /** Trail width as fraction of screen width (glove bottom width). */
  width?: number;
  /** Bottom-edge angle in degrees. */
  angle?: number;
}

export type GloveId = 'left' | 'right';

export interface GloveState {
  position: GlovePosition;
  trail: TrailPoint[];
  pointerId: number | null;
}
