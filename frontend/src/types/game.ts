export type GymStation = 'ring' | 'speedball' | 'heavy-bag' | 'bobo-doll';

export interface StationInfo {
  id: GymStation;
  name: string;
  description: string;
  emoji: string;
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  equipmentPos: [number, number, number];
}

export const GYM_STATIONS: StationInfo[] = [
  {
    id: 'ring',
    name: "Mickey's Ring",
    description: 'Sparring in the main ring',
    emoji: '🥊',
    cameraPos: [0, 2.5, 6.5],
    lookAt: [0, 1.2, 0],
    equipmentPos: [0, 0, 0],
  },
  {
    id: 'speedball',
    name: 'Speedball',
    description: 'Work the speedball — fast hands',
    emoji: '🏐',
    cameraPos: [-4.2, 2.2, 1.8],
    lookAt: [-5.8, 1.5, 0.5],
    equipmentPos: [-5.8, 0, 0.5],
  },
  {
    id: 'heavy-bag',
    name: 'Heavy Bag',
    description: 'Power shots on the heavy bag',
    emoji: '🎯',
    cameraPos: [1.5, 2.2, -4.2],
    lookAt: [0.2, 1.2, -5.5],
    equipmentPos: [0.2, 0, -5.5],
  },
  {
    id: 'bobo-doll',
    name: 'Bobo Doll',
    description: 'Knock down the bobo doll',
    emoji: '🤡',
    cameraPos: [5.8, 2.2, 3.2],
    lookAt: [5.8, 1.2, 1.8],
    equipmentPos: [5.8, 0, 1.8],
  },
];

export function getStation(id: GymStation): StationInfo {
  return GYM_STATIONS.find((s) => s.id === id) ?? GYM_STATIONS[0];
}
