const BACKGROUND_MUSIC_SRC = '/sounds/Boxing gym.mp3';
/** Quiet gym ambience — punch SFX stay prominent. */
const BACKGROUND_MUSIC_VOLUME = 0.18;

let audio: HTMLAudioElement | null = null;
let started = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(BACKGROUND_MUSIC_SRC);
    audio.loop = true;
    audio.volume = BACKGROUND_MUSIC_VOLUME;
    audio.preload = 'auto';
  }
  return audio;
}

/** Start looping gym ambience (no-op if already playing). */
export function startBackgroundMusic(): void {
  if (started) return;
  const track = getAudio();
  void track
    .play()
    .then(() => {
      started = true;
    })
    .catch(() => {});
}

/** Resume if the browser paused playback (e.g. tab backgrounded). */
export function ensureBackgroundMusic(): void {
  if (!audio || audio.paused) {
    startBackgroundMusic();
    return;
  }
  started = true;
}
