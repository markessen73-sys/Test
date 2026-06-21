import { COLORS, EASTER_EGGS } from "./constants";

const SAMPLE_STEP = 16;

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleLine(points, x) {
  const before = points[Math.max(0, Math.floor(x / SAMPLE_STEP))];
  const after = points[Math.min(points.length - 1, Math.ceil(x / SAMPLE_STEP))];
  if (!before || !after) {
    return 160;
  }

  if (before.x === after.x) {
    return before.y;
  }

  const alpha = (x - before.x) / (after.x - before.x);
  return before.y + (after.y - before.y) * alpha;
}

function buildSurface(width, rand, level) {
  const points = [];
  let height = 118;
  const count = Math.floor(width / SAMPLE_STEP) + 1;

  for (let index = 0; index < count; index += 1) {
    const x = index * SAMPLE_STEP;
    const drift = (rand() - 0.5) * (9 + level * 0.5);
    const wave = Math.sin(index * 0.28) * 7 + Math.sin(index * 0.06) * 11;
    height = clamp(height + drift * 0.3 + wave * 0.08, 74, 172);
    points.push({ x, y: height });
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 1; index < points.length - 1; index += 1) {
      points[index].y = (points[index - 1].y + points[index].y * 2 + points[index + 1].y) / 4;
    }
  }

  return points;
}

function flattenSegment(points, x, width) {
  const startIndex = Math.max(1, Math.floor((x - width / 2) / SAMPLE_STEP));
  const endIndex = Math.min(points.length - 2, Math.ceil((x + width / 2) / SAMPLE_STEP));
  const y = (points[startIndex].y + points[endIndex].y) / 2;

  for (let index = startIndex; index <= endIndex; index += 1) {
    points[index].y = y;
  }

  return { x, y, width };
}

function buildPads(points, width, rand, level) {
  const pads = [];
  pads.push({ ...flattenSegment(points, 300, 64), kind: "assembly" });

  const padCount = 3 + Math.min(2, level);
  for (let index = 0; index < padCount; index += 1) {
    const x = 650 + index * ((width - 1000) / padCount) + rand() * 220;
    pads.push({
      ...flattenSegment(points, x, 48 + Math.floor(rand() * 24)),
      kind: index % 2 === 0 ? "fuelDepot" : "landing",
    });
  }

  return pads;
}

function buildCaves(surfacePoints, rand, level, width) {
  const caves = [];
  const caveCount = 2 + Math.min(1, Math.floor(level / 2));

  for (let index = 0; index < caveCount; index += 1) {
    const start = 950 + index * ((width - 1700) / caveCount) + rand() * 240;
    const caveWidth = 220 + rand() * 180;
    const samples = [];

    for (let x = start; x <= start + caveWidth; x += SAMPLE_STEP) {
      const surfaceY = sampleLine(surfacePoints, x);
      const ceiling = clamp(surfaceY + 18 + Math.sin(x * 0.021) * 6, 92, 160);
      const floor = clamp(ceiling + 22 + Math.cos(x * 0.034 + index) * 7, ceiling + 18, 182);
      samples.push({ x, ceiling, floor });
    }

    caves.push({
      start,
      end: start + caveWidth,
      samples,
    });
  }

  return caves;
}

function sampleCave(cave, x) {
  const before = cave.samples[Math.max(0, Math.floor((x - cave.start) / SAMPLE_STEP))];
  const after = cave.samples[Math.min(cave.samples.length - 1, Math.ceil((x - cave.start) / SAMPLE_STEP))];
  if (!before || !after) {
    return null;
  }

  if (before.x === after.x) {
    return before;
  }

  const alpha = (x - before.x) / (after.x - before.x);
  return {
    ceiling: before.ceiling + (after.ceiling - before.ceiling) * alpha,
    floor: before.floor + (after.floor - before.floor) * alpha,
  };
}

function distributedSpawns(count, width, rand, surfacePoints, caves, biasToCaves = 0.3) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    const x = 520 + ((width - 760) / Math.max(1, count - 1)) * index + (rand() - 0.5) * 160;
    const useCave = caves.length > 0 && rand() < biasToCaves;
    const cave = useCave ? caves[Math.floor(rand() * caves.length)] : null;

    if (cave) {
      const caveX = clamp(cave.start + 32 + rand() * (cave.end - cave.start - 64), cave.start + 16, cave.end - 16);
      const sample = sampleCave(cave, caveX);
      results.push({ x: caveX, y: sample.floor - 8, cave: true });
      continue;
    }

    const y = sampleLine(surfacePoints, x) - 8;
    results.push({ x, y, cave: false });
  }

  return results;
}

function buildEggSpawns(rand, width, surfacePoints, caves) {
  return EASTER_EGGS.map((label, index) => {
    const x = 700 + index * ((width - 1100) / Math.max(1, EASTER_EGGS.length - 1)) + (rand() - 0.5) * 180;
    if (index % 2 === 1 && caves[index % caves.length]) {
      const cave = caves[index % caves.length];
      const caveX = clamp(cave.start + 36 + rand() * (cave.end - cave.start - 72), cave.start + 20, cave.end - 20);
      const sample = sampleCave(cave, caveX);
      return { label, x: caveX, y: sample.floor - 6 };
    }

    return { label, x, y: sampleLine(surfacePoints, x) - 6 };
  });
}

export function generateWorld(level, seed) {
  const rand = createPrng(seed);
  const width = 3600 + level * 340;
  const gravity = 0.038 + level * 0.006;
  const fuelDrain = 0.17 + level * 0.025;
  const rocketScale = 1 + (level - 1) * 0.1;
  const surfacePoints = buildSurface(width, rand, level);
  const pads = buildPads(surfacePoints, width, rand, level);
  const caves = buildCaves(surfacePoints, rand, level, width);
  const assemblyPad = pads[0];
  const fuelDepots = pads.filter((pad) => pad.kind === "fuelDepot");
  const partSpawns = distributedSpawns(5, width, rand, surfacePoints, caves, 0.45);
  const fuelSpawns = distributedSpawns(3 + level, width, rand, surfacePoints, caves, 0.28);
  const enemySpawns = distributedSpawns(4 + level * 2, width, rand, surfacePoints, caves, 0.35);
  const powerUpSpawns = distributedSpawns(5, width, rand, surfacePoints, caves, 0.2);
  const eggSpawns = buildEggSpawns(rand, width, surfacePoints, caves);
  const tutorialPartX = assemblyPad.x + 48;
  partSpawns[0] = {
    x: tutorialPartX,
    y: sampleLine(surfacePoints, tutorialPartX) - 8,
    cave: false,
  };
  const skyline = Array.from({ length: 48 }, (_, index) => ({
    x: rand() * width,
    y: 18 + rand() * 70,
    brightness: index % 3 === 0 ? COLORS.white : COLORS.cyan,
  }));

  return {
    seed,
    level,
    width,
    gravity,
    fuelDrain,
    rocketScale,
    surfacePoints,
    caves,
    pads,
    assemblyPad,
    fuelDepots,
    partSpawns,
    fuelSpawns,
    enemySpawns,
    powerUpSpawns,
    eggSpawns,
    skyline,
    getSurfaceY(x) {
      return sampleLine(surfacePoints, clamp(x, 0, width));
    },
    getCave(x) {
      return caves.find((cave) => x >= cave.start && x <= cave.end) || null;
    },
    getCollisionInfo(x, y, radius = 0) {
      const cave = this.getCave(x);
      if (cave) {
        const sample = sampleCave(cave, x);
        if (sample && y >= sample.ceiling && y <= sample.floor) {
          return {
            insideCave: true,
            ceilingY: sample.ceiling,
            floorY: sample.floor,
            hitCeiling: y - radius <= sample.ceiling,
            hitGround: y + radius >= sample.floor,
            pad: null,
          };
        }
      }

      const groundY = this.getSurfaceY(x);
      return {
        insideCave: false,
        groundY,
        hitGround: y + radius >= groundY,
        hitCeiling: false,
        pad: this.getPadAt(x),
      };
    },
    getPadAt(x) {
      return pads.find((pad) => Math.abs(x - pad.x) <= pad.width / 2) || null;
    },
    placeOnGround(x, offset = 8) {
      const cave = this.getCave(x);
      if (cave) {
        const sample = sampleCave(cave, x);
        return sample.floor - offset;
      }

      return this.getSurfaceY(x) - offset;
    },
    render(scene) {
      const terrain = scene.add.graphics();
      terrain.fillStyle(COLORS.green, 1);
      terrain.lineStyle(2, COLORS.yellow, 1);
      terrain.beginPath();
      terrain.moveTo(surfacePoints[0].x, surfacePoints[0].y);
      surfacePoints.forEach((point) => terrain.lineTo(point.x, point.y));
      terrain.lineTo(width, 192);
      terrain.lineTo(0, 192);
      terrain.closePath();
      terrain.fillPath();
      terrain.strokePath();

      caves.forEach((cave, index) => {
        terrain.fillStyle(index % 2 === 0 ? COLORS.paper : COLORS.ink, 1);
        terrain.lineStyle(1, COLORS.magenta, 1);
        terrain.beginPath();
        terrain.moveTo(cave.samples[0].x, cave.samples[0].ceiling);
        cave.samples.forEach((sample) => terrain.lineTo(sample.x, sample.ceiling));
        for (let sampleIndex = cave.samples.length - 1; sampleIndex >= 0; sampleIndex -= 1) {
          const sample = cave.samples[sampleIndex];
          terrain.lineTo(sample.x, sample.floor);
        }
        terrain.closePath();
        terrain.fillPath();
        terrain.strokePath();
      });

      return terrain;
    },
  };
}
