import { assetUrl } from '../assetUrl';

export type GloveLoadoutId =
  | 'default'
  | 'gold'
  | 'bare-knuckle'
  | 'vintage'
  | 'rubber-chicken'
  | 'union-jack'
  | 'usa';

export interface GloveLoadout {
  id: GloveLoadoutId;
  name: string;
  /** Punch power rating out of 100 — higher fills the damage bar faster. */
  power: number;
  /** CSS skin class suffix (`screen-glove-skin-*`). */
  skin:
    | 'default'
    | 'gold'
    | 'bare-knuckle'
    | 'vintage'
    | 'rubber-chicken'
    | 'union-jack'
    | 'usa';
  /** Zone art folder under /gloves/ (without trailing slash). */
  zoneFolder: string;
  /** Options thumbnail (right-hand zone art). */
  thumbSrc: string;
  /** When set, replaces station punch SFX on every target. */
  punchSfx?: string;
  /** Extra swing flourish on punch (rubber chicken). */
  punchSwing?: boolean;
}

export const GLOVE_LOADOUTS: Record<GloveLoadoutId, GloveLoadout> = {
  default: {
    id: 'default',
    name: 'Default',
    power: 50,
    skin: 'default',
    zoneFolder: 'right-zones',
    thumbSrc: assetUrl('/gloves/right-zones/zone-r1-c2.png'),
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    power: 60,
    skin: 'gold',
    zoneFolder: 'right-zones',
    thumbSrc: assetUrl('/gloves/right-zones/zone-r1-c2.png'),
  },
  'bare-knuckle': {
    id: 'bare-knuckle',
    name: 'Bare Knuckle',
    power: 30,
    skin: 'bare-knuckle',
    zoneFolder: 'bare-knuckle-zones',
    thumbSrc: assetUrl('/gloves/bare-knuckle-zones/zone-r1-c2.png'),
  },
  vintage: {
    id: 'vintage',
    name: '1920s',
    power: 75,
    skin: 'vintage',
    zoneFolder: 'vintage-zones',
    thumbSrc: assetUrl('/gloves/vintage-zones/zone-r1-c2.png'),
  },
  'rubber-chicken': {
    id: 'rubber-chicken',
    name: 'Rubber Chicken',
    power: 20,
    skin: 'rubber-chicken',
    zoneFolder: 'rubber-chicken-zones',
    thumbSrc: assetUrl('/gloves/rubber-chicken-zones/zone-r1-c2.png'),
    punchSfx: assetUrl('/sounds/digitalstore07-chicken-430403.mp3'),
    punchSwing: true,
  },
  'union-jack': {
    id: 'union-jack',
    name: 'Union Jack',
    power: 50,
    skin: 'union-jack',
    zoneFolder: 'union-jack-zones',
    thumbSrc: assetUrl('/gloves/union-jack-zones/zone-r1-c2.png'),
  },
  usa: {
    id: 'usa',
    name: 'USA',
    power: 50,
    skin: 'usa',
    zoneFolder: 'usa-zones',
    thumbSrc: assetUrl('/gloves/usa-zones/zone-r1-c2.png'),
  },
};

export const GLOVE_LOADOUT_LIST: GloveLoadout[] = [
  GLOVE_LOADOUTS.default,
  GLOVE_LOADOUTS.gold,
  GLOVE_LOADOUTS['bare-knuckle'],
  GLOVE_LOADOUTS.vintage,
  GLOVE_LOADOUTS['rubber-chicken'],
  GLOVE_LOADOUTS['union-jack'],
  GLOVE_LOADOUTS.usa,
];

export const DEFAULT_GLOVE_LOADOUT_ID: GloveLoadoutId = 'default';

export const GLOVE_STORAGE_KEY = 'mickeys-gym-gloves';

/** Baseline power used so 50/100 = normal damage pace and target motion. */
export const BASELINE_GLOVE_POWER = 50;

/** Multiplier for damage weight and punch-driven equipment motion. */
export function glovePowerScale(power: number): number {
  return Math.max(0.15, power / BASELINE_GLOVE_POWER);
}

export function isGloveLoadoutId(id: string): id is GloveLoadoutId {
  return (
    id === 'default' ||
    id === 'gold' ||
    id === 'bare-knuckle' ||
    id === 'vintage' ||
    id === 'rubber-chicken' ||
    id === 'union-jack' ||
    id === 'usa'
  );
}

export function readStoredGloveLoadoutId(): GloveLoadoutId {
  try {
    const raw = localStorage.getItem(GLOVE_STORAGE_KEY);
    if (raw && isGloveLoadoutId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_GLOVE_LOADOUT_ID;
}

export function writeStoredGloveLoadoutId(id: GloveLoadoutId) {
  try {
    localStorage.setItem(GLOVE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
