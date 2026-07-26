import * as THREE from 'three';

/** Bobo head sphere: centre y=2.28, radius 0.44. */
export const BOBO_HEAD_Y = 2.28;
export const BOBO_HEAD_RADIUS = 0.44;

/**
 * Face plane sits just in front of the sphere surface so the opaque head
 * doesn't clip out the middle of the caricature.
 */
export const BOBO_FACE_CENTER: [number, number, number] = [
  0,
  BOBO_HEAD_Y,
  BOBO_HEAD_RADIUS + 0.04,
];

/** Head diameter × 1.3 — clown face reads big on the ball. */
export const BOBO_FACE_SIZE: [number, number] = [
  BOBO_HEAD_RADIUS * 2 * 1.3,
  BOBO_HEAD_RADIUS * 2 * 1.3,
];

/**
 * Gentle front patch: broad enough for the caricature, with edges pulled back
 * so it reads as wrapped around the bobo head rather than sticker-flat.
 */
export function createBoboFacePatchGeometry(
  width = BOBO_FACE_SIZE[0],
  height = BOBO_FACE_SIZE[1]
) {
  const columns = 36;
  const rows = 36;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const edgeCurve = BOBO_HEAD_RADIUS * 0.2;
  const verticalCurve = BOBO_HEAD_RADIUS * 0.08;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const y = (v - 0.5) * height;
    const ny = (y / height) * 2;
    for (let col = 0; col <= columns; col += 1) {
      const u = col / columns;
      const x = (u - 0.5) * width;
      const nx = (x / width) * 2;
      const z = -(nx * nx * edgeCurve + ny * ny * verticalCurve);
      positions.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const a = row * (columns + 1) + col;
      const b = a + 1;
      const d = (row + 1) * (columns + 1) + col;
      const c = d + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
