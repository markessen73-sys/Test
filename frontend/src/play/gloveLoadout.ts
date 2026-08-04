import { assetUrl } from '../assetUrl';

export type GloveLoadoutId = 'default' | 'gold';

export interface GloveLoadout {
  id: GloveLoadoutId;
  name: string;
  /** Punch power rating out of 100. */
  power: number;
  /** CSS skin class suffix (`screen-glove-skin-*`). */
  skin: 'default' | 'gold';
  /** Options thumbnail (right-hand zone art). */
  thumbSrc: string;
}

export const GLOVE_LOADOUTS: Record<GloveLoadoutId, GloveLoadout> = {
  default: {
    id: 'default',
    name: 'Default',
    power: 50,
    skin: 'default',
    thumbSrc: assetUrl('/gloves/right-zones/zone-r1-c2.png'),
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    power: 60,
    skin: 'gold',
    thumbSrc: assetUrl('/gloves/right-zones/zone-r1-c2.png'),
  },
};

export const GLOVE_LOADOUT_LIST: GloveLoadout[] = [GLOVE_LOADOUTS.default, GLOVE_LOADOUTS.gold];

export const DEFAULT_GLOVE_LOADOUT_ID: GloveLoadoutId = 'default';

export const GLOVE_STORAGE_KEY = 'mickeys-gym-gloves';

/** Baseline power used so 50/100 = normal damage pace. */
export const BASELINE_GLOVE_POWER = 50;

export function isGloveLoadoutId(id: string): id is GloveLoadoutId {
  return id === 'default' || id === 'gold';
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
