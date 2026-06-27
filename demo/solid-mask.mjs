/** Shared solid-mask builder for arena collision. */

export const MASK = {
  VOID_LUM: 20,
  GAP_RUN: 12,
  EDGE_MARGIN: 50,
  MIN_PLATFORM_WIDTH: 40,
  CAP_Y_TOL: 28,
  MAX_BODY_PAD: 8,
  FLOOR_Y0: 868,
  FLOOR_LEFT_X1: 345,
  FLOOR_RIGHT_X0: 1185,
};

export function buildLuminance(data, width, height, channels) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    lum[i] = data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
  }
  return lum;
}

export function makeLumAccessor(lum, width, height) {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return lum[y * width + x];
  };
}

export function isDeckCapPixel(at, x, y) {
  const l = at(x, y);
  const above = at(x, y - 1);
  const below = at(x, y + 1);
  return (l >= 80 && above >= 75 && below < l - 40) || (l >= 95 && above < 35);
}

export function findColumnCap(at, height, x) {
  for (let y = 2; y < height - 1; y++) {
    if (isDeckCapPixel(at, x, y)) return y;
  }
  return -1;
}

function columnFillEnd(at, height, x, startY, voidLum, gapRun) {
  let gap = 0;
  let end = startY;
  for (let y = startY; y < height; y++) {
    if (at(x, y) < voidLum) {
      gap++;
      if (gap >= gapRun) return end;
    } else {
      gap = 0;
    }
    end = y;
  }
  return end;
}

function fillColumnRange(solid, width, x, startY, endY) {
  for (let y = startY; y <= endY; y++) solid[y * width + x] = 1;
}

function groupColumnCaps(caps, yTol, minWidth) {
  const groups = [];
  for (const cap of caps) {
    let group = groups.find(
      (g) =>
        Math.abs(g.capY - cap.capY) <= yTol &&
        cap.x >= g.x0 - 12 &&
        cap.x <= g.x1 + 12,
    );
    if (group) {
      group.x0 = Math.min(group.x0, cap.x);
      group.x1 = Math.max(group.x1, cap.x);
      group.capY = Math.round((group.capY + cap.capY) / 2);
      group.cols.push(cap.x);
    } else {
      groups.push({ x0: cap.x, x1: cap.x, capY: cap.capY, cols: [cap.x] });
    }
  }
  return groups.filter((g) => g.x1 - g.x0 + 1 >= minWidth);
}

function clipColumnEnds(ends, capY) {
  const sorted = [...ends].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5));
  const medianEnd = sorted[idx];
  return Math.min(medianEnd + MASK.MAX_BODY_PAD, capY + 130);
}

function platformCols(group, at, height) {
  return [...new Set(group.cols)]
    .filter((x) => {
      const capY = findColumnCap(at, height, x);
      return capY >= 0 && Math.abs(capY - group.capY) <= 14;
    })
    .sort((a, b) => a - b);
}

function fillPlatformBody(solid, at, width, height, group) {
  const { VOID_LUM } = MASK;
  const uniqueCols = platformCols(group, at, height);
  if (!uniqueCols.length) return;

  const x0 = Math.min(...uniqueCols);
  const x1 = Math.max(...uniqueCols);
  const span = x1 - x0 + 1;

  const ends = uniqueCols.map((x) =>
    columnFillEnd(at, height, x, group.capY, VOID_LUM, MASK.GAP_RUN),
  );
  const clipY = clipColumnEnds(ends, group.capY);

  for (let y = group.capY; y <= clipY; y++) {
    let rockCols = 0;
    for (let x = x0; x <= x1; x++) {
      if (at(x, y) >= 24) rockCols++;
    }
    if (y > group.capY + 10 && rockCols < span * 0.12) break;

    for (let x = x0; x <= x1; x++) solid[y * width + x] = 1;
  }
}

function pruneToConnectedSolid(solid, width, height, seeds) {
  const keep = new Uint8Array(width * height);
  const q = [];

  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (!solid[i] || keep[i]) return;
    keep[i] = 1;
    q.push(i);
  };

  for (const [x, y] of seeds) seed(x, y);

  while (q.length) {
    const i = q.shift();
    const x = i % width;
    const y = (i / width) | 0;
    seed(x + 1, y);
    seed(x - 1, y);
    seed(x, y + 1);
    seed(x, y - 1);
  }

  for (let i = 0; i < width * height; i++) solid[i] = keep[i];
}

function collectCapSeeds(at, height, width, solid) {
  const seeds = [];
  for (let x = 0; x < width; x++) {
    for (let y = 1; y < height - 1; y++) {
      if (!solid[y * width + x]) continue;
      if (!isDeckCapPixel(at, x, y)) continue;
      seeds.push([x, y]);
      for (let dy = 0; dy <= 4; dy++) {
        if (solid[(y + dy) * width + x]) seeds.push([x, y + dy]);
      }
    }
  }
  return seeds;
}

function fillRockBlock(solid, at, width, height, x0, x1, capY, maxDepth) {
  const { VOID_LUM } = MASK;
  const span = x1 - x0 + 1;
  const clipY = Math.min(height - 1, capY + maxDepth);

  for (let y = capY; y <= clipY; y++) {
    let rockCols = 0;
    for (let x = x0; x <= x1; x++) {
      if (at(x, y) >= 24) rockCols++;
    }
    if (y > capY + 12 && rockCols < span * 0.1) break;

    for (let x = x0; x <= x1; x++) solid[y * width + x] = 1;
  }
}

function addBottomCenterPlatform(solid, at, width, height) {
  let bestY = -1;
  let bestSpan = 0;
  let bestX0 = 0;
  let bestX1 = 0;

  for (let y = 590; y <= 660; y++) {
    let start = null;
    let span = 0;
    let x0 = 0;
    let x1 = 0;
    for (let x = 180; x <= 1220; x++) {
      if (at(x, y) >= 42) {
        if (start === null) start = x;
      } else if (start !== null) {
        const run = x - start;
        if (run > span) {
          span = run;
          x0 = start;
          x1 = x - 1;
        }
        start = null;
      }
    }
    if (start !== null) {
      const run = 1220 - start + 1;
      if (run > span) {
        span = run;
        x0 = start;
        x1 = 1220;
      }
    }
    if (span > bestSpan) {
      bestSpan = span;
      bestY = y;
      bestX0 = x0;
      bestX1 = x1;
    }
  }

  if (bestY < 0 || bestSpan < 320) return bestY;

  const cols = [];
  for (let x = bestX0; x <= bestX1; x++) {
    if (at(x, bestY) >= 35 || at(x, bestY + 1) >= 35) cols.push(x);
  }
  if (cols.length < 120) return bestY;

  fillRockBlock(solid, at, width, height, bestX0, bestX1, bestY, 300);
  return bestY;
}

function addMiddleCenterPlatform(solid, at, width, height) {
  const X0 = 680;
  const X1 = 860;
  const Y0 = 635;
  const Y1 = 675;

  let bestY = -1;
  let bestCount = 0;
  for (let y = Y0; y <= Y1; y++) {
    let count = 0;
    for (let x = X0; x <= X1; x++) {
      if (at(x, y) >= 50 && at(x, y - 1) < 28) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestY = y;
    }
  }
  if (bestY < 0 || bestCount < 15) return;

  const cols = [];
  for (let x = X0; x <= X1; x++) {
    if (findColumnCap(at, height, x) >= 0 || (at(x, bestY) >= 45 && at(x, bestY - 1) < 30)) {
      cols.push(x);
    }
  }

  fillPlatformBody(solid, at, width, height, {
    x0: X0,
    x1: X1,
    capY: bestY,
    cols,
  });
}

function fillBottomFloor(solid, at, width, height) {
  const { VOID_LUM, GAP_RUN, FLOOR_Y0, FLOOR_LEFT_X1, FLOOR_RIGHT_X0 } = MASK;

  for (let x = 0; x <= FLOOR_LEFT_X1; x++) {
    const endY = columnFillEnd(at, height, x, FLOOR_Y0, VOID_LUM, GAP_RUN);
    fillColumnRange(solid, width, x, FLOOR_Y0, endY);
  }
  for (let x = FLOOR_RIGHT_X0; x < width; x++) {
    const endY = columnFillEnd(at, height, x, FLOOR_Y0, VOID_LUM, GAP_RUN);
    fillColumnRange(solid, width, x, FLOOR_Y0, endY);
  }
}

export function buildSolidMask(data, width, height, channels) {
  const lum = buildLuminance(data, width, height, channels);
  const at = makeLumAccessor(lum, width, height);
  const solid = new Uint8Array(width * height);
  const { EDGE_MARGIN, MIN_PLATFORM_WIDTH, CAP_Y_TOL } = MASK;

  const caps = [];
  for (let x = 0; x < width; x++) {
    const capY = findColumnCap(at, height, x);
    if (capY >= 0) caps.push({ x, capY });
  }

  const groups = groupColumnCaps(caps, CAP_Y_TOL, MIN_PLATFORM_WIDTH);
  for (const group of groups) {
    if (group.capY >= MASK.FLOOR_Y0 - 40) continue;
    if (group.x1 < EDGE_MARGIN || group.x0 > width - EDGE_MARGIN) continue;
    if (group.x0 < EDGE_MARGIN && group.x1 - group.x0 < 80) continue;
    fillPlatformBody(solid, at, width, height, group);
  }

  let seeds = collectCapSeeds(at, height, width, solid);
  pruneToConnectedSolid(solid, width, height, seeds);

  addBottomCenterPlatform(solid, at, width, height);
  addMiddleCenterPlatform(solid, at, width, height);
  fillBottomFloor(solid, at, width, height);

  return solid;
}

export function solidToSegments(solid, width, height) {
  const segments = [];
  for (let y = 0; y < height; y++) {
    let start = null;
    for (let x = 0; x < width; x++) {
      if (solid[y * width + x]) {
        if (start === null) start = x;
      } else if (start !== null) {
        segments.push([y, start, x - 1]);
        start = null;
      }
    }
    if (start !== null) segments.push([y, start, width - 1]);
  }
  return segments;
}
