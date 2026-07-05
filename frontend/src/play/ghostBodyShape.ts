interface Vec2 {
  x: number;
  y: number;
}

/** From-behind muscular male silhouette — shape derived from reference, not photo. */
export function buildGhostBackBody(lean: number): {
  torso: string;
  head: string;
  shorts: string;
  muscleDetail: string;
} {
  const cx = 0.5 + lean;
  const ls = { x: 0.36 + lean, y: 0.52 };
  const rs = { x: 0.64 + lean, y: 0.52 };

  // Broad shoulders → wide lats → narrow waist (V-taper)
  const torso = [
    `M ${ls.x} ${ls.y}`,
    `C ${ls.x - 0.04} ${ls.y + 0.02}, ${cx - 0.2} ${0.56}, ${cx - 0.17} ${0.62}`,
    `C ${cx - 0.19} ${0.68}, ${cx - 0.14} ${0.74}, ${cx - 0.1} ${0.78}`,
    `C ${cx - 0.06} ${0.82}, ${cx - 0.04} ${0.84}, ${cx} ${0.85}`,
    `C ${cx + 0.04} ${0.84}, ${cx + 0.06} ${0.82}, ${cx + 0.1} ${0.78}`,
    `C ${cx + 0.14} ${0.74}, ${cx + 0.19} ${0.68}, ${cx + 0.17} ${0.62}`,
    `C ${cx + 0.2} ${0.56}, ${rs.x + 0.04} ${rs.y + 0.02}, ${rs.x} ${rs.y}`,
    `C ${cx + 0.12} ${0.5}, ${cx} ${0.48}, ${ls.x} ${ls.y}`,
    'Z',
  ].join(' ');

  const head = [
    `M ${cx - 0.052} ${0.41}`,
    `C ${cx - 0.068} ${0.36}, ${cx - 0.04} ${0.335}, ${cx} ${0.33}`,
    `C ${cx + 0.04} ${0.335}, ${cx + 0.068} ${0.36}, ${cx + 0.052} ${0.41}`,
    `C ${cx + 0.04} ${0.44}, ${cx} ${0.45}, ${cx - 0.052} ${0.41}`,
    'Z',
  ].join(' ');

  const shorts = [
    `M ${cx - 0.1} ${0.85}`,
    `L ${cx - 0.11} ${0.94}`,
    `Q ${cx - 0.08} ${0.97}, ${cx - 0.04} ${0.96}`,
    `L ${cx} ${0.955}`,
    `L ${cx + 0.04} ${0.96}`,
    `Q ${cx + 0.08} ${0.97}, ${cx + 0.11} ${0.94}`,
    `L ${cx + 0.1} ${0.85}`,
    `Q ${cx} ${0.87}, ${cx - 0.1} ${0.85}`,
    'Z',
  ].join(' ');

  const muscleDetail = [
    // Traps
    `M ${cx - 0.04} ${0.46} L ${ls.x + 0.02} ${ls.y - 0.01}`,
    `M ${cx + 0.04} ${0.46} L ${rs.x - 0.02} ${rs.y - 0.01}`,
    // Spine
    `M ${cx} ${0.47} L ${cx} ${0.8}`,
    // Lat definition
    `M ${cx - 0.14} ${0.6} Q ${cx - 0.17} ${0.66} ${cx - 0.12} ${0.72}`,
    `M ${cx + 0.14} ${0.6} Q ${cx + 0.17} ${0.66} ${cx + 0.12} ${0.72}`,
    // Rear delt caps
    `M ${ls.x - 0.01} ${ls.y - 0.015} Q ${ls.x - 0.03} ${ls.y + 0.01} ${ls.x - 0.02} ${ls.y + 0.025}`,
    `M ${rs.x + 0.01} ${rs.y - 0.015} Q ${rs.x + 0.03} ${rs.y + 0.01} ${rs.x + 0.02} ${rs.y + 0.025}`,
    // Shorts waistband
    `M ${cx - 0.1} ${0.855} Q ${cx} ${0.87} ${cx + 0.1} ${0.855}`,
  ].join(' ');

  return { torso, head, shorts, muscleDetail };
}

export function buildGhostNeck(lean: number): string {
  const cx = 0.5 + lean;
  return `M ${cx - 0.032} ${0.45} L ${cx + 0.032} ${0.45} L ${cx + 0.026} ${0.49} L ${cx - 0.026} ${0.49} Z`;
}

/** Shoulder anchor points on the ghost back mesh */
export function getBackShoulderAnchors(lean: number): { left: Vec2; right: Vec2 } {
  return {
    left: { x: 0.36 + lean, y: 0.52 },
    right: { x: 0.64 + lean, y: 0.52 },
  };
}
