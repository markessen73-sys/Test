import { assetUrl } from '../../assetUrl';

export type CharacterId = 'default' | 'byson';

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

function characterFaceRoot(id: CharacterId): string {
  return `/faces/characters/${id}`;
}

function makeCharacter(id: CharacterId, name: string): CharacterDef {
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

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  default: makeCharacter('default', 'Default'),
  byson: makeCharacter('byson', 'Byson'),
};

export const CHARACTER_LIST: CharacterDef[] = [CHARACTERS.default, CHARACTERS.byson];

export const DEFAULT_CHARACTER_ID: CharacterId = 'default';

export const CHARACTER_STORAGE_KEY = 'mickeys-gym-character';

export function isCharacterId(value: string | null | undefined): value is CharacterId {
  return value === 'default' || value === 'byson';
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
