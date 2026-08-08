import { assetUrl } from '../assetUrl';
import type { NormRect } from './face/types';
import { RING_PARTNER_FACE } from './face/faceTemplate';

export type BodyStyleId =
  | 'generic'
  | 'body-01'
  | 'body-02'
  | 'body-03'
  | 'body-04'
  | 'body-05'
  | 'body-06'
  | 'body-07'
  | 'body-08'
  | 'body-09'
  | 'body-10'
  | 'body-11'
  | 'body-12';

export interface BodyStyle {
  id: BodyStyleId;
  name: string;
  /** Full-body sparring texture (transparent PNG). */
  textureSrc: string;
  /** Options thumbnail. */
  thumbSrc: string;
  /** Head slot on the body texture (image-normalized, top-left origin). */
  faceRect: NormRect;
  /**
   * Fraction of texture height from the bottom edge up to the boot soles.
   * Used so feet sit on the ring canvas for every silhouette.
   */
  feetSoleFrac: number;
  /** Texture aspect width/height (all packs are 1024×1536). */
  aspect: number;
}

const BODY_ASPECT = 1024 / 1536;

function body(
  id: BodyStyleId,
  name: string,
  texturePath: string,
  thumbPath: string,
  faceRect: NormRect,
  feetSoleFrac: number
): BodyStyle {
  return {
    id,
    name,
    textureSrc: assetUrl(texturePath),
    thumbSrc: assetUrl(thumbPath),
    faceRect,
    feetSoleFrac,
    aspect: BODY_ASPECT,
  };
}

export const BODY_STYLES: Record<BodyStyleId, BodyStyle> = {
  generic: body(
    'generic',
    'Generic',
    '/boxer/sparring-boxer.png',
    '/boxer/bodies/generic-thumb.png',
    RING_PARTNER_FACE,
    76 / 1536
  ),
  'body-01': body(
    'body-01',
    'Blue Trunks',
    '/boxer/bodies/body-01.png',
    '/boxer/bodies/body-01-thumb.png',
    [0.3927, 0.0828, 0.5975, 0.2128],
    0.0853
  ),
  'body-02': body(
    'body-02',
    'Heavyweight',
    '/boxer/bodies/body-02.png',
    '/boxer/bodies/body-02-thumb.png',
    [0.402, 0.0566, 0.595, 0.1791],
    0.0684
  ),
  'body-03': body(
    'body-03',
    'Suit & Tie',
    '/boxer/bodies/body-03.png',
    '/boxer/bodies/body-03-thumb.png',
    [0.3994, 0.05, 0.5967, 0.1753],
    0.056
  ),
  'body-04': body(
    'body-04',
    'Foxy Blue',
    '/boxer/bodies/body-04.png',
    '/boxer/bodies/body-04-thumb.png',
    [0.3908, 0.0831, 0.5955, 0.2131],
    0.0866
  ),
  'body-05': body(
    'body-05',
    'Heavy Guard',
    '/boxer/bodies/body-05.png',
    '/boxer/bodies/body-05-thumb.png',
    [0.3913, 0.0424, 0.596, 0.1724],
    0.0664
  ),
  'body-06': body(
    'body-06',
    'Blue Satin',
    '/boxer/bodies/body-06.png',
    '/boxer/bodies/body-06-thumb.png',
    [0.3952, 0.072, 0.5999, 0.202],
    0.0651
  ),
  'body-07': body(
    'body-07',
    'Foxy Pink',
    '/boxer/bodies/body-07.png',
    '/boxer/bodies/body-07-thumb.png',
    [0.3943, 0.0721, 0.5979, 0.2014],
    0.0501
  ),
  'body-08': body(
    'body-08',
    'Classic Spar',
    '/boxer/bodies/body-08.png',
    '/boxer/bodies/body-08-thumb.png',
    [0.3993, 0.0558, 0.5998, 0.1831],
    0.0651
  ),
  'body-09': body(
    'body-09',
    'Leopard Trunks',
    '/boxer/bodies/body-09.png',
    '/boxer/bodies/body-09-thumb.png',
    [0.3952, 0.0665, 0.5999, 0.1965],
    0.0632
  ),
  'body-10': body(
    'body-10',
    'Power Stance',
    '/boxer/bodies/body-10.png',
    '/boxer/bodies/body-10-thumb.png',
    [0.3997, 0.1056, 0.5778, 0.2186],
    0.082
  ),
  'body-11': body(
    'body-11',
    'Leopard Print',
    '/boxer/bodies/body-11.png',
    '/boxer/bodies/body-11-thumb.png',
    [0.3981, 0.031, 0.6029, 0.161],
    0.0124
  ),
  'body-12': body(
    'body-12',
    'Foxy Lace',
    '/boxer/bodies/body-12.png',
    '/boxer/bodies/body-12-thumb.png',
    // Blank head slot on the regenerated Foxy pose (gloves-up guard).
    [0.4082, 0.0215, 0.6064, 0.179],
    0.0664
  ),
};

export const BODY_STYLE_LIST: BodyStyle[] = [
  BODY_STYLES.generic,
  BODY_STYLES['body-01'],
  BODY_STYLES['body-02'],
  BODY_STYLES['body-03'],
  BODY_STYLES['body-04'],
  BODY_STYLES['body-05'],
  BODY_STYLES['body-06'],
  BODY_STYLES['body-07'],
  BODY_STYLES['body-08'],
  BODY_STYLES['body-09'],
  BODY_STYLES['body-10'],
  BODY_STYLES['body-11'],
  BODY_STYLES['body-12'],
];

export const DEFAULT_BODY_STYLE_ID: BodyStyleId = 'generic';

export const BODY_STORAGE_KEY = 'mickeys-gym-body-style';

const BODY_IDS = new Set<string>(BODY_STYLE_LIST.map((b) => b.id));

export function isBodyStyleId(id: string): id is BodyStyleId {
  return BODY_IDS.has(id);
}

export function readStoredBodyStyleId(): BodyStyleId {
  try {
    const raw = localStorage.getItem(BODY_STORAGE_KEY);
    if (raw && isBodyStyleId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_BODY_STYLE_ID;
}

export function writeStoredBodyStyleId(id: BodyStyleId) {
  try {
    localStorage.setItem(BODY_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
