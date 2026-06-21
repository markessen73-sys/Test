import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants";

function canUseStorage() {
  try {
    const key = "__lunar_muskman_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function readJson(key, fallback) {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...readJson(STORAGE_KEYS.settings, {}),
  };
}

export function saveSettings(settings) {
  writeJson(STORAGE_KEYS.settings, settings);
}

export function loadScores() {
  return readJson(STORAGE_KEYS.scores, []);
}

export function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.timeMs - right.timeMs;
  });
  writeJson(STORAGE_KEYS.scores, scores.slice(0, 20));
}

export function loadStats() {
  return readJson(STORAGE_KEYS.stats, {
    fastestLaunchMs: null,
    bestScore: 0,
  });
}

export function saveStats(stats) {
  writeJson(STORAGE_KEYS.stats, stats);
}

export function loadGhost() {
  return readJson(STORAGE_KEYS.ghost, null);
}

export function saveGhost(ghostData) {
  writeJson(STORAGE_KEYS.ghost, ghostData);
}
