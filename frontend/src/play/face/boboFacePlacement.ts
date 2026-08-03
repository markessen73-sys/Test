import * as THREE from 'three';

/** Bobo head sphere: centre y=2.28, radius 0.44. */
export const BOBO_HEAD_Y = 2.28;
export const BOBO_HEAD_RADIUS = 0.44;

/** Face patch centre sits just proud of the head sphere. */
export const BOBO_FACE_CENTER: [number, number, number] = [
  0,
  BOBO_HEAD_Y,
  BOBO_HEAD_RADIUS + 0.04,
];

/** Head diameter × 1.25 — wraps the standard / photo face around the ball. */
export const BOBO_FACE_SIZE: [number, number] = [
  BOBO_HEAD_RADIUS * 2 * 1.25,
  BOBO_HEAD_RADIUS * 2 * 1.25,
];

/** Spherical front patch: bends the caricature around the bobo head surface. */
export function createBoboFacePatchGeometry() {
  const columns = 36;
  const rows = 36;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const radius = BOBO_HEAD_RADIUS + 0.045;
  // Slightly tighter than the old clown (wig) coverage so standard faces read clean.
  const horizontalHalfAngle = 1.05;
  const verticalHalfAngle = 1.0;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const vertical = (v - 0.5) * verticalHalfAngle * 2;
    for (let col = 0; col <= columns; col += 1) {
      const u = col / columns;
      const horizontal = (u - 0.5) * horizontalHalfAngle * 2;
      const cosVertical = Math.cos(vertical);
      const x = radius * Math.sin(horizontal) * cosVertical;
      const y = radius * Math.sin(vertical);
      const z = radius * Math.cos(horizontal) * cosVertical - radius;
      positions.push(x, y, z);
      uvs.push(u, v);
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
