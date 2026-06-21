export const GAME_WIDTH = 256;
export const GAME_HEIGHT = 192;
export const WORLD_HEIGHT = 192;

export const COLORS = {
  ink: 0x08080f,
  paper: 0x101820,
  cyan: 0x40e0d0,
  magenta: 0xff4fd8,
  yellow: 0xfff05a,
  green: 0x4cff68,
  red: 0xff5a5a,
  blue: 0x4a7bff,
  white: 0xf3f5ff,
  orange: 0xffa43a,
  violet: 0x9966ff,
};

export const STORAGE_KEYS = {
  settings: "lunar-muskman-settings",
  scores: "lunar-muskman-scores",
  ghost: "lunar-muskman-ghost",
  stats: "lunar-muskman-stats",
};

export const DEFAULT_SETTINGS = {
  crt: true,
  music: true,
  sfx: true,
  ghostMode: true,
  touchControls: true,
  pilotName: "P1",
};

export const PART_TYPES = [
  { key: "base", label: "BASE", color: COLORS.cyan, score: 500 },
  { key: "engine", label: "ENGINE", color: COLORS.orange, score: 650 },
  { key: "fuelTank", label: "TANK", color: COLORS.green, score: 700 },
  { key: "guidance", label: "GUIDE", color: COLORS.magenta, score: 850 },
  { key: "capsule", label: "CAPSULE", color: COLORS.yellow, score: 1000 },
];

export const ENEMY_TYPES = [
  { key: "doomPoster", label: "DOOM POSTER", color: COLORS.red, score: 250 },
  { key: "regDrone", label: "REGULATION DRONE", color: COLORS.yellow, score: 300 },
  { key: "socialBot", label: "SOCIAL MEDIA BOT", color: COLORS.blue, score: 325 },
  { key: "alienLawyer", label: "ALIEN LAWYER", color: COLORS.magenta, score: 375 },
  { key: "dustMonster", label: "MARS DUST MONSTER", color: COLORS.green, score: 425 },
];

export const POWER_UP_TYPES = [
  { key: "fuel", label: "EXTRA FUEL", color: COLORS.green },
  { key: "shield", label: "SHIELD+", color: COLORS.cyan },
  { key: "turbo", label: "TURBO", color: COLORS.orange },
  { key: "beam", label: "BEAM+", color: COLORS.magenta },
  { key: "invulnerability", label: "INVULN", color: COLORS.yellow },
];

export const EASTER_EGGS = [
  "Cybertruck Wreckage",
  "Dogecoin Coin",
  "Space Cat",
  "Lost Satellite",
  "Martian Chickens",
];

export const MENU_ITEMS = ["START GAME", "HIGH SCORES", "SETTINGS", "CREDITS"];
