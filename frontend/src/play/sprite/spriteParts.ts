export interface SpritePartDef {
  id: string;
  src: string;
  pivotX: number;
  pivotY: number;
  zIndex: number;
  /** Width at guard pose in vmin units */
  widthVmin: number;
}

const BASE = '/boxer/parts';

export const SPRITE_PARTS: SpritePartDef[] = [
  { id: 'thigh-left', src: `${BASE}/thigh-left.png`, pivotX: 0.55, pivotY: 0.1, zIndex: 8, widthVmin: 16 },
  { id: 'thigh-right', src: `${BASE}/thigh-right.png`, pivotX: 0.45, pivotY: 0.1, zIndex: 8, widthVmin: 16 },
  { id: 'shin-left', src: `${BASE}/shin-left.png`, pivotX: 0.52, pivotY: 0.08, zIndex: 9, widthVmin: 14 },
  { id: 'shin-right', src: `${BASE}/shin-right.png`, pivotX: 0.48, pivotY: 0.08, zIndex: 9, widthVmin: 14 },
  { id: 'boot-left', src: `${BASE}/boot-left.png`, pivotX: 0.5, pivotY: 0.08, zIndex: 11, widthVmin: 13 },
  { id: 'boot-right', src: `${BASE}/boot-right.png`, pivotX: 0.5, pivotY: 0.08, zIndex: 11, widthVmin: 13 },
  { id: 'pelvis', src: `${BASE}/pelvis.png`, pivotX: 0.5, pivotY: 0.28, zIndex: 12, widthVmin: 30 },
  { id: 'torso', src: `${BASE}/torso.png`, pivotX: 0.5, pivotY: 0.93, zIndex: 14, widthVmin: 36 },
  { id: 'upper-arm-left', src: `${BASE}/upper-arm-left.png`, pivotX: 0.82, pivotY: 0.14, zIndex: 22, widthVmin: 17 },
  { id: 'upper-arm-right', src: `${BASE}/upper-arm-right.png`, pivotX: 0.18, pivotY: 0.14, zIndex: 22, widthVmin: 17 },
  { id: 'forearm-left', src: `${BASE}/forearm-left.png`, pivotX: 0.84, pivotY: 0.12, zIndex: 24, widthVmin: 16 },
  { id: 'forearm-right', src: `${BASE}/forearm-right.png`, pivotX: 0.16, pivotY: 0.12, zIndex: 24, widthVmin: 16 },
  { id: 'head', src: `${BASE}/head.png`, pivotX: 0.5, pivotY: 0.94, zIndex: 30, widthVmin: 17 },
  { id: 'glove-left', src: `${BASE}/glove-left.png`, pivotX: 0.55, pivotY: 0.08, zIndex: 40, widthVmin: 18 },
  { id: 'glove-right', src: `${BASE}/glove-right.png`, pivotX: 0.48, pivotY: 0.12, zIndex: 40, widthVmin: 14 },
];

export const PART_BY_ID = Object.fromEntries(SPRITE_PARTS.map((p) => [p.id, p])) as Record<
  string,
  SpritePartDef
>;
