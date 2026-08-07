import mapData from './faceTemplateMap';
import type { FaceTemplateMap } from './types';

const FACE_TEMPLATE_MAP: FaceTemplateMap = mapData;

/** Crop rect from template image (faceOval). */
export const FACE_SOURCE_OVAL = FACE_TEMPLATE_MAP.faceOval;

/** 3D heavy-bag decal placement (bag-local metres). */
export const BAG_FACE_MESH = FACE_TEMPLATE_MAP.targets.heavyBagMesh;

/** Head rect on sparring-boxer sprite (image-normalized, top-left origin). */
export const RING_PARTNER_FACE = FACE_TEMPLATE_MAP.targets.ringPartner.rect;

/** Template image dimensions and nose landmark for placement anchoring. */
export const FACE_SOURCE_SIZE = FACE_TEMPLATE_MAP.sourceSize;
export const FACE_NOSE_LANDMARK = FACE_TEMPLATE_MAP.landmarks.nose;

/** Punch-Out style HUD portrait slots (normalized screen). */
export const HUD_PLAYER_FACE = FACE_TEMPLATE_MAP.targets.hudPlayer.rect;
export const HUD_OPPONENT_FACE = FACE_TEMPLATE_MAP.targets.hudOpponent.rect;
