export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 200;
export const HUD_HEIGHT = 24;
export const PLAYFIELD_Y = HUD_HEIGHT;
export const TILE_SIZE = 16;
export const GRID_COLS = 20;
export const GRID_ROWS = 11;

export const COLORS = {
  black: 0x000000,
  white: 0xffffff,
  cyan: 0x6cf0ff,
  blue: 0x5a65ff,
  purple: 0x8a52ff,
  magenta: 0xd468ff,
  pink: 0xff8ecb,
  red: 0xff6666,
  orange: 0xffaa4a,
  yellow: 0xffef75,
  green: 0x72f28f,
  teal: 0x3ad4b6,
  navy: 0x1e2155,
  gray: 0x9197b3,
};

export const STORAGE_KEYS = {
  hiScore: "starvault-hi-score",
  touch: "starvault-touch",
};

export const SCREEN_SEQUENCE = ["hangar", "lift", "core"];

export const CONTROL_HINTS = [
  "ARROWS MOVE",
  "TAP TO FOCUS",
  "AVOID CONTACT",
];

export const LEVEL_NAMES = {
  hangar: "HANGAR SHAFT",
  lift: "LIFT CORRIDOR",
  core: "CORE VAULT",
};
