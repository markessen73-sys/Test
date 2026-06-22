import { STORAGE_KEYS } from "./constants";

function readNumber(key, fallback = 0) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : Number(value) || fallback;
  } catch (error) {
    return fallback;
  }
}

function readBoolean(key, fallback = true) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch (error) {
    return fallback;
  }
}

function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (error) {
    // Ignore storage failures in private/incognito contexts.
  }
}

export function loadHiScore() {
  return readNumber(STORAGE_KEYS.hiScore, 0);
}

export function saveHiScore(score) {
  writeValue(STORAGE_KEYS.hiScore, score);
}

export function loadTouchPreference() {
  return readBoolean(STORAGE_KEYS.touch, true);
}

export function saveTouchPreference(enabled) {
  writeValue(STORAGE_KEYS.touch, enabled);
}
