import { COLORS, GRID_ROWS, HUD_HEIGHT, LEVEL_NAMES, PLAYFIELD_Y, TILE_SIZE } from "./constants";

const C = (value) => value * TILE_SIZE;

export const GAME_TITLE = "STARVAULT SKIMMER";

export const SCREENS = {
  hangar: {
    key: "hangar",
    name: LEVEL_NAMES.hangar,
    palette: {
      bg: COLORS.pink,
      wall: COLORS.navy,
      accent: COLORS.yellow,
      hazard: COLORS.black,
    },
    start: { x: 32, y: PLAYFIELD_Y + 132 },
    exit: {
      x: 304,
      y: PLAYFIELD_Y + 112,
      width: 16,
      height: 32,
      target: "lift",
      targetStart: { x: 32, y: PLAYFIELD_Y + 144 },
    },
    solids: [
      { x: 0, y: PLAYFIELD_Y, width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y + C(GRID_ROWS - 1), width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y, width: 16, height: 176 },
      { x: 304, y: PLAYFIELD_Y, width: 16, height: 88 },
      { x: 304, y: PLAYFIELD_Y + 144, width: 16, height: 32 },
      { x: 48, y: PLAYFIELD_Y + 32, width: 96, height: 16 },
      { x: 48, y: PLAYFIELD_Y + 48, width: 16, height: 96 },
      { x: 96, y: PLAYFIELD_Y + 80, width: 112, height: 16 },
      { x: 176, y: PLAYFIELD_Y + 32, width: 16, height: 64 },
      { x: 208, y: PLAYFIELD_Y + 32, width: 64, height: 16 },
      { x: 224, y: PLAYFIELD_Y + 64, width: 64, height: 16 },
      { x: 144, y: PLAYFIELD_Y + 112, width: 112, height: 16 },
      { x: 240, y: PLAYFIELD_Y + 96, width: 16, height: 64 },
    ],
    pickups: [
      { x: 96, y: PLAYFIELD_Y + 64, kind: "star" },
      { x: 216, y: PLAYFIELD_Y + 48, kind: "star" },
    ],
    hazards: [
      { type: "patrolH", x: 104, y: PLAYFIELD_Y + 64, amplitude: 28, speed: 1.1, phase: 0.1 },
      { type: "patrolV", x: 280, y: PLAYFIELD_Y + 112, amplitude: 28, speed: 1.45, phase: 1.4 },
      { type: "orbit", x: 216, y: PLAYFIELD_Y + 136, radius: 18, speed: 1.5, phase: 0.4 },
    ],
    doorText: "EXIT",
  },
  lift: {
    key: "lift",
    name: LEVEL_NAMES.lift,
    palette: {
      bg: COLORS.purple,
      wall: COLORS.black,
      accent: COLORS.cyan,
      hazard: COLORS.yellow,
    },
    start: { x: 32, y: PLAYFIELD_Y + 144 },
    teleporter: {
      x: 272,
      y: PLAYFIELD_Y + 32,
      width: 16,
      height: 16,
      target: "core",
      targetStart: { x: 40, y: PLAYFIELD_Y + 80 },
    },
    solids: [
      { x: 0, y: PLAYFIELD_Y, width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y + C(GRID_ROWS - 1), width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y, width: 16, height: 176 },
      { x: 304, y: PLAYFIELD_Y, width: 16, height: 176 },
      { x: 64, y: PLAYFIELD_Y + 32, width: 16, height: 128 },
      { x: 64, y: PLAYFIELD_Y + 128, width: 96, height: 16 },
      { x: 112, y: PLAYFIELD_Y + 16, width: 16, height: 96 },
      { x: 160, y: PLAYFIELD_Y + 48, width: 16, height: 112 },
      { x: 208, y: PLAYFIELD_Y + 16, width: 16, height: 96 },
      { x: 224, y: PLAYFIELD_Y + 112, width: 64, height: 16 },
      { x: 240, y: PLAYFIELD_Y + 48, width: 48, height: 16 },
    ],
    pickups: [
      { x: 192, y: PLAYFIELD_Y + 128, kind: "star" },
    ],
    hazards: [
      { type: "patrolV", x: 48, y: PLAYFIELD_Y + 96, amplitude: 40, speed: 1.8, phase: 0.2 },
      { type: "patrolH", x: 184, y: PLAYFIELD_Y + 72, amplitude: 24, speed: 1.35, phase: 1.1 },
      { type: "patrolH", x: 240, y: PLAYFIELD_Y + 96, amplitude: 20, speed: 1.6, phase: 0.6 },
      { type: "spark", x: 144, y: PLAYFIELD_Y + 40, amplitude: 56, speed: 2.1, phase: 1.8 },
    ],
  },
  core: {
    key: "core",
    name: LEVEL_NAMES.core,
    palette: {
      bg: COLORS.blue,
      wall: COLORS.navy,
      accent: COLORS.orange,
      hazard: COLORS.red,
    },
    start: { x: 40, y: PLAYFIELD_Y + 80 },
    relic: {
      x: 272,
      y: PLAYFIELD_Y + 136,
      width: 12,
      height: 12,
    },
    solids: [
      { x: 0, y: PLAYFIELD_Y, width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y + C(GRID_ROWS - 1), width: 320, height: 16 },
      { x: 0, y: PLAYFIELD_Y, width: 16, height: 176 },
      { x: 304, y: PLAYFIELD_Y, width: 16, height: 176 },
      { x: 64, y: PLAYFIELD_Y + 48, width: 96, height: 16 },
      { x: 64, y: PLAYFIELD_Y + 64, width: 16, height: 80 },
      { x: 160, y: PLAYFIELD_Y + 96, width: 80, height: 16 },
      { x: 224, y: PLAYFIELD_Y + 48, width: 16, height: 96 },
      { x: 240, y: PLAYFIELD_Y + 48, width: 48, height: 16 },
      { x: 240, y: PLAYFIELD_Y + 144, width: 48, height: 16 },
      { x: 272, y: PLAYFIELD_Y + 96, width: 16, height: 32 },
    ],
    hazards: [
      { type: "patrolV", x: 120, y: PLAYFIELD_Y + 112, amplitude: 28, speed: 1.6, phase: 0.9 },
      { type: "turret", x: 184, y: PLAYFIELD_Y + 72, fireRate: 1200 },
    ],
    pickups: [],
  },
};

export function getScreen(key) {
  return SCREENS[key];
}

export function getNextLoop(cycle) {
  return {
    playerSpeed: 88 + (cycle - 1) * 4,
    hazardSpeedMultiplier: 1 + (cycle - 1) * 0.08,
    screenClearBonus: 150 + (cycle - 1) * 25,
    relicBonus: 1200 + (cycle - 1) * 150,
  };
}
