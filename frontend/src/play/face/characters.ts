import { assetUrl } from '../../assetUrl';
import { isPhotoCharacterId, type FaceFeatureMark } from '../../face-capture/customFace';

/**
 * Playable face packs live under `public/faces/characters/<id>/`.
 * After adding a character, run `npm run check:characters` (see
 * `public/faces/README.md`) so LM alignment, Default head size, KO scale,
 * natural-skin clown + curly wig, and pupils match pack conventions.
 */
export type StockCharacterId = 'default' | 'byson' | 'tin-mick' | 'the-don';

/** Stock pack id, or `photo-<uuid>` for a user-uploaded face. */
export type CharacterId = StockCharacterId | (string & {});

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
  /** True for user photo faces (can be deleted). */
  isPhotoFace?: boolean;
  /** Highlighter eye marks — animate pop-out eyes on punch when set. */
  popEyes?: { left: FaceFeatureMark; right: FaceFeatureMark };
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

function characterFaceRoot(id: StockCharacterId): string {
  return `/faces/characters/${id}`;
}

function makeCharacter(id: StockCharacterId, name: string): CharacterDef {
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

export const CHARACTERS: Record<StockCharacterId, CharacterDef> = {
  default: makeCharacter('default', 'Default Boxer'),
  byson: makeCharacter('byson', 'Byson'),
  'tin-mick': makeCharacter('tin-mick', 'Tin Mick'),
  'the-don': makeCharacter('the-don', 'The Don'),
};

export const CHARACTER_LIST: CharacterDef[] = [
  CHARACTERS.default,
  CHARACTERS.byson,
  CHARACTERS['tin-mick'],
  CHARACTERS['the-don'],
];

export const DEFAULT_CHARACTER_ID: StockCharacterId = 'default';

export const CHARACTER_STORAGE_KEY = 'mickeys-gym-character';

export function isStockCharacterId(value: string | null | undefined): value is StockCharacterId {
  return value === 'default' || value === 'byson' || value === 'tin-mick' || value === 'the-don';
}

/** @deprecated Prefer isStockCharacterId — photo ids are also valid CharacterIds. */
export function isCharacterId(value: string | null | undefined): value is CharacterId {
  return isStockCharacterId(value) || isPhotoCharacterId(value);
}

export function readStoredCharacterId(): CharacterId {
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (isStockCharacterId(raw) || isPhotoCharacterId(raw)) return raw;
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
