/** Normalized axis-aligned rect [x0, y0, x1, y1] in 0–1 space. */
export type NormRect = readonly [number, number, number, number];

export type FaceLandmarkId = 'leftEye' | 'rightEye' | 'nose' | 'mouth' | 'chin';

export type FaceRegionId = 'leftEye' | 'rightEye' | 'nose' | 'mouth';

export interface FaceTemplateMap {
  template: string;
  sourceSize: readonly [number, number];
  faceOval: NormRect;
  regions: Record<FaceRegionId, NormRect>;
  landmarks: Record<FaceLandmarkId, readonly [number, number]>;
  targets: {
    heavyBag: { comment: string; corners: readonly (readonly [number, number])[] };
    heavyBagMesh: { comment: string; center: readonly [number, number, number]; size: readonly [number, number] };
    ringPartner: { comment: string; rect: NormRect };
    hudPlayer: { rect: NormRect };
    hudOpponent: { rect: NormRect };
  };
}

/** Screen-space warp applied when the face is punched. */
export interface FacePunchWarp {
  squashX?: number;
  squashY?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
}

export const DEFAULT_FACE_WARP: Required<FacePunchWarp> = {
  squashX: 1,
  squashY: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};
