import { assetUrl } from '../../assetUrl';
import { isPhotoCharacterId, type FaceFeatureMark } from '../../face-capture/customFace';

/**
 * Playable face packs live under `public/faces/characters/<id>/`.
 * After adding a character, run `npm run check:characters` (see
 * `public/faces/README.md`) so LM alignment, Default head size, KO scale,
 * natural-skin clown + curly wig, and pupils match pack conventions.
 */
export type StockCharacterId =
  | 'default'
  | 'byson'
  | 'tin-mick'
  | 'the-don'
  | 'king-of-the-north'
  | 'bozza'
  | 'the-nige'
  | 'the-greenie'
  | 'pricey'
  | 'kk';

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
  /** Bobo live head (same as clean/ooh/KO — carnival look is hat + band). */
  boboCleanSrc: string;
  boboOohSrc: string;
  boboLiveKoSrc: string;
  /** Bobo HUD damage ladder (same injury faces as the ring). */
  boboDamageStageSrcs: readonly string[];
  boboHoldSrc: string;
  boboKoSrc: string;
  /**
   * Extra ring-partner head scale on top of the shared calibration chain.
   * Use < 1 when a pack’s silhouette (tall hair / long chin) overflows the head slot.
   */
  faceScale?: number;
  /**
   * Extra ring-partner horizontal nudge as a fraction of the face decal width.
   * Positive = move right on the body; negative = move left.
   */
  faceNudgeX?: number;
  /**
   * Extra ring-partner vertical nudge as a fraction of the face decal height.
   * Positive = raise the head on the body; negative = lower.
   */
  faceNudgeY?: number;
  /**
   * When true, long hair that hangs below the chin is drawn on a second plane
   * behind the body sprite so strands tuck under the shoulders/torso.
   */
  hairBehindBody?: boolean;
  /** Optional ring play backdrop image (shown behind the far ropes). */
  ringBackdropSrc?: string;
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

function makeCharacter(
  id: StockCharacterId,
  name: string,
  extras: {
    faceScale?: number;
    faceNudgeX?: number;
    faceNudgeY?: number;
    hairBehindBody?: boolean;
    ringBackdropSrc?: string;
  } = {}
): CharacterDef {
  const root = characterFaceRoot(id);
  const damage = `${root}/damage-stages`;
  const cleanSrc = assetUrl(`${root}/clean.png`);
  const oohSrc = assetUrl(`${root}/ooh.png`);
  const knockoutSrc = assetUrl(`${root}/knockout.png`);
  const damageStageSrcs = DAMAGE_STEP_NAMES.map((n) => assetUrl(`${damage}/${n}`));
  return {
    id,
    name,
    cleanSrc,
    oohSrc,
    knockoutSrc,
    damageStageCleanSrc: assetUrl(`${damage}/00-clean.png`),
    damageStageSrcs,
    damageStageHoldSrc: assetUrl(`${damage}/09-hold.png`),
    damageStageKnockoutSrc: assetUrl(`${damage}/10-knockout.png`),
    // Bobo doll uses the same standard face / damage ladder (no clown makeup).
    boboCleanSrc: cleanSrc,
    boboOohSrc: oohSrc,
    boboLiveKoSrc: knockoutSrc,
    boboDamageStageSrcs: damageStageSrcs,
    boboHoldSrc: assetUrl(`${damage}/09-hold.png`),
    boboKoSrc: assetUrl(`${damage}/10-knockout.png`),
    ...extras,
  };
}

const RING_BACKDROP = assetUrl('/backdrops/images-8.jpeg');

export const CHARACTERS: Record<StockCharacterId, CharacterDef> = {
  default: makeCharacter('default', 'Default Boxer'),
  byson: makeCharacter('byson', 'Byson', {
    faceScale: 1.18,
  }),
  'tin-mick': makeCharacter('tin-mick', 'Tin Mick', {
    faceScale: 1.08,
  }),
  'the-don': makeCharacter('the-don', 'The Don', {
    faceScale: 1.1,
  }),
  'king-of-the-north': makeCharacter('king-of-the-north', 'King Of The North', {
    ringBackdropSrc: RING_BACKDROP,
    faceScale: 1.02,
    faceNudgeY: 0.1,
  }),
  bozza: makeCharacter('bozza', 'Bozza', {
    ringBackdropSrc: RING_BACKDROP,
    // Mid-face was smaller than Default after margin pad — boost to match.
    faceScale: 1.28,
    faceNudgeX: -0.03,
    faceNudgeY: 0.08,
  }),
  'the-nige': makeCharacter('the-nige', 'The Nige', {
    ringBackdropSrc: RING_BACKDROP,
    faceScale: 1.12,
    faceNudgeY: 0.08,
  }),
  'the-greenie': makeCharacter('the-greenie', 'The Greenie', {
    ringBackdropSrc: RING_BACKDROP,
    faceScale: 1.14,
    faceNudgeY: 0.08,
  }),
  pricey: makeCharacter('pricey', 'Pricey', {
    ringBackdropSrc: RING_BACKDROP,
    // High bun → smaller mid-face than Default; scale up to match.
    faceScale: 1.22,
    faceNudgeY: 0.06,
  }),
  kk: makeCharacter('kk', 'KK', {
    ringBackdropSrc: RING_BACKDROP,
    faceScale: 1.05,
    faceNudgeY: 0.04,
    // Long wavy hair must tuck under the torso/shoulders.
    hairBehindBody: true,
  }),
};

export const CHARACTER_LIST: CharacterDef[] = [
  CHARACTERS.default,
  CHARACTERS.byson,
  CHARACTERS['tin-mick'],
  CHARACTERS['the-don'],
  CHARACTERS['king-of-the-north'],
  CHARACTERS.bozza,
  CHARACTERS['the-nige'],
  CHARACTERS['the-greenie'],
  CHARACTERS.pricey,
  CHARACTERS.kk,
];

export const DEFAULT_CHARACTER_ID: StockCharacterId = 'default';

export const CHARACTER_STORAGE_KEY = 'mickeys-gym-character';

export function isStockCharacterId(value: string | null | undefined): value is StockCharacterId {
  return (
    value === 'default' ||
    value === 'byson' ||
    value === 'tin-mick' ||
    value === 'the-don' ||
    value === 'king-of-the-north' ||
    value === 'bozza' ||
    value === 'the-nige' ||
    value === 'the-greenie' ||
    value === 'pricey' ||
    value === 'kk'
  );
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
