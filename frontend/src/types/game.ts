export type AppStep = 'create' | 'gym' | 'fight';

export type EquipmentType = 'speedball' | 'heavy-bag' | 'bobo-doll';

export type PunchType = 'jab' | 'cross' | 'hook' | 'uppercut' | 'body';

export interface EquipmentInfo {
  id: EquipmentType;
  name: string;
  description: string;
  emoji: string;
}

export const EQUIPMENT: EquipmentInfo[] = [
  {
    id: 'speedball',
    name: 'Speedball',
    description: 'Fast ricochets — jabs make the face spin and go cross-eyed',
    emoji: '🏐',
  },
  {
    id: 'heavy-bag',
    name: 'Heavy Bag',
    description: 'Big swings — hooks squash the face flat against the bag',
    emoji: '🥊',
  },
  {
    id: 'bobo-doll',
    name: 'Bobo Doll',
    description: 'Wobbles back — uppercuts stretch the face and add dizzy stars',
    emoji: '🤡',
  },
];

export interface GameState {
  step: AppStep;
  caricatureUrl: string | null;
  styleName: string | null;
  equipment: EquipmentType | null;
}

export interface HitReaction {
  punchType: PunchType;
  intensity: number;
  timestamp: number;
}
