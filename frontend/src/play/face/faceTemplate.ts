import mapData from './faceTemplateMap';
import type { FaceTemplateMap } from './types';

export const FACE_TEMPLATE_MAP: FaceTemplateMap = mapData;

export const FACE_TEMPLATE_SRC = FACE_TEMPLATE_MAP.template;

/** Crop rect from template image (faceOval). */
export const FACE_SOURCE_OVAL = FACE_TEMPLATE_MAP.faceOval;

/** 3D heavy-bag decal placement (bag-local metres). */
export const BAG_FACE_MESH = FACE_TEMPLATE_MAP.targets.heavyBagMesh;

/** Punch-Out style HUD portrait slots (normalized screen). */
export const HUD_PLAYER_FACE = FACE_TEMPLATE_MAP.targets.hudPlayer.rect;
export const HUD_OPPONENT_FACE = FACE_TEMPLATE_MAP.targets.hudOpponent.rect;
