import { assetUrl } from '../assetUrl';

export type GloveLoadoutId = 'default' | 'gold' | 'bare-knuckle' | 'vintage';

export interface GloveLoadout {
  id: GloveLoadoutId;
  name: string;
  /** Punch power rating out of 100 — higher fills the damage bar faster. */
  power: number;
  /** CSS skin class suffix (`screen-glove-skin-*`). */
  skin: 'default' | 'gold' | 'bare-knuckle' | 'vintage';
  /** Zone art folder under /gloves/ (without trailing slash). */
  zoneFolder: string;
  /** Options thumbnail (right-hand zone art). */
  thumbSrc: string;
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
};

export const GLOVE_LOADOUT_LIST: GloveLoadout[] = [
  GLOVE_LOADOUTS.default,
  GLOVE_LOADOUTS.gold,
  GLOVE_LOADOUTS['bare-knuckle'],
  GLOVE_LOADOUTS.vintage,
];

export const DEFAULT_GLOVE_LOADOUT_ID: GloveLoadoutId = 'default';

export const GLOVE_STORAGE_KEY = 'mickeys-gym-gloves';

/** Baseline power used so 50/100 = normal damage pace. */
export const BASELINE_GLOVE_POWER = 50;

export function isGloveLoadoutId(id: string): id is GloveLoadoutId {
  return id === 'default' || id === 'gold' || id === 'bare-knuckle' || id === 'vintage';
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
