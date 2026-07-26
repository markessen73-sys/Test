import { assetUrl } from '../../assetUrl';
import { isCustomCharacterId } from './custom/customBoxerStorage';
import type { CustomBoxerPackRecord } from './custom/customBoxerStorage';

/**
 * Playable face packs live under `public/faces/characters/<id>/`.
 * User-created boxers use `custom:<uuid>` ids with blob: object URLs from IndexedDB.
 */
export type BuiltinCharacterId = 'default' | 'byson' | 'tin-mick' | 'the-don';
export type CharacterId = BuiltinCharacterId | `custom:${string}`;

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** Main caricature — used for selection button + live faces. */
  cleanSrc: string;
  oohSrc: string;
  knockoutSrc: string;
  /** HUD damage ladder: clean + 8 injury faces. */
  damageStageCleanSrc: string;
  damageStageSrcs: readonly string[];
  damageStageHoldSrc: string;
  damageStageKnockoutSrc: string;
  /** Bobo clown set. */
  boboCleanSrc: string;
  boboOohSrc: string;
  boboLiveKoSrc: string;
  boboDamageStageSrcs: readonly string[];
  boboHoldSrc: string;
  boboKoSrc: string;
  /** True for user-created boxers stored in IndexedDB. */
  isCustom?: boolean;
}

const DAMAGE_STEP_NAMES = [
  '01-cauliflowerLeftEar.png',
  '02-blackRightEye.png',
  '03-chinCrossPlaster.png',
  '04-cauliflowerRightEar.png',
  '05-missingTooth.png',
  '06-swollenLeftEye.png',
  '07-brokenNose.png',
  '08-foreheadBandage.png',
] as const;

function characterFaceRoot(id: BuiltinCharacterId): string {
  return `/faces/characters/${id}`;
}

function makeCharacter(id: BuiltinCharacterId, name: string): CharacterDef {
  const root = characterFaceRoot(id);
  const damage = `${root}/damage-stages`;
  const clown = `${root}/bobo-clown-stages`;
  return {
    id,
    name,
    cleanSrc: assetUrl(`${root}/clean.png`),
    oohSrc: assetUrl(`${root}/ooh.png`),
    knockoutSrc: assetUrl(`${root}/knockout.png`),
    damageStageCleanSrc: assetUrl(`${damage}/00-clean.png`),
    damageStageSrcs: DAMAGE_STEP_NAMES.map((n) => assetUrl(`${damage}/${n}`)),
    damageStageHoldSrc: assetUrl(`${damage}/09-hold.png`),
    damageStageKnockoutSrc: assetUrl(`${damage}/10-knockout.png`),
    boboCleanSrc: assetUrl(`${clown}/00-clean.png`),
    boboOohSrc: assetUrl(`${clown}/ooh.png`),
    boboLiveKoSrc: assetUrl(`${clown}/knockout-clean.png`),
    boboDamageStageSrcs: DAMAGE_STEP_NAMES.map((n) => assetUrl(`${clown}/${n}`)),
    boboHoldSrc: assetUrl(`${clown}/09-hold.png`),
    boboKoSrc: assetUrl(`${clown}/10-knockout.png`),
  };
}

export const BUILTIN_CHARACTERS: Record<BuiltinCharacterId, CharacterDef> = {
  default: makeCharacter('default', 'Default'),
  byson: makeCharacter('byson', 'Byson'),
  'tin-mick': makeCharacter('tin-mick', 'Tin Mick'),
  'the-don': makeCharacter('the-don', 'The Don'),
};

/** @deprecated use BUILTIN_CHARACTERS — kept for existing imports */
export const CHARACTERS = BUILTIN_CHARACTERS;

export const BUILTIN_CHARACTER_LIST: CharacterDef[] = [
  BUILTIN_CHARACTERS.default,
  BUILTIN_CHARACTERS.byson,
  BUILTIN_CHARACTERS['tin-mick'],
  BUILTIN_CHARACTERS['the-don'],
];

/** @deprecated use BUILTIN_CHARACTER_LIST */
export const CHARACTER_LIST = BUILTIN_CHARACTER_LIST;

export const DEFAULT_CHARACTER_ID: BuiltinCharacterId = 'default';

export const CHARACTER_STORAGE_KEY = 'mickeys-gym-character';

export function isBuiltinCharacterId(value: string | null | undefined): value is BuiltinCharacterId {
  return value === 'default' || value === 'byson' || value === 'tin-mick' || value === 'the-don';
}

export function isCharacterId(value: string | null | undefined): value is CharacterId {
  return isBuiltinCharacterId(value) || isCustomCharacterId(value);
}

export function readStoredCharacterId(): CharacterId {
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (isCharacterId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CHARACTER_ID;
}

export function writeStoredCharacterId(id: CharacterId) {
  try {
    localStorage.setItem(CHARACTER_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function blobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Build a CharacterDef from an IndexedDB pack (creates object URLs). */
export function characterDefFromCustomPack(pack: CustomBoxerPackRecord): CharacterDef {
  const damage = pack.damage;
  const clown = pack.clown;
  const step = (name: string) => blobUrl(damage[name]);
  const clownStep = (name: string) => blobUrl(clown[name]);
  return {
    id: pack.id as CharacterId,
    name: pack.name,
    isCustom: true,
    cleanSrc: blobUrl(pack.clean),
    oohSrc: blobUrl(pack.ooh),
    knockoutSrc: blobUrl(pack.knockout),
    damageStageCleanSrc: step('00-clean.png'),
    damageStageSrcs: DAMAGE_STEP_NAMES.map((n) => step(n)),
    damageStageHoldSrc: step('09-hold.png'),
    damageStageKnockoutSrc: step('10-knockout.png'),
    boboCleanSrc: clownStep('00-clean.png'),
    boboOohSrc: clownStep('ooh.png'),
    boboLiveKoSrc: clownStep('knockout-clean.png'),
    boboDamageStageSrcs: DAMAGE_STEP_NAMES.map((n) => clownStep(n)),
    boboHoldSrc: clownStep('09-hold.png'),
    boboKoSrc: clownStep('10-knockout.png'),
  };
}

/** Revoke object URLs previously created for a custom character. */
export function revokeCharacterObjectUrls(def: CharacterDef) {
  if (!def.isCustom) return;
  const urls = [
    def.cleanSrc,
    def.oohSrc,
    def.knockoutSrc,
    def.damageStageCleanSrc,
    ...def.damageStageSrcs,
    def.damageStageHoldSrc,
    def.damageStageKnockoutSrc,
    def.boboCleanSrc,
    def.boboOohSrc,
    def.boboLiveKoSrc,
    ...def.boboDamageStageSrcs,
    def.boboHoldSrc,
    def.boboKoSrc,
  ];
  for (const u of urls) {
    if (u.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    }
  }
}
