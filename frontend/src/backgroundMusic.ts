const BACKGROUND_MUSIC_SRC = '/sounds/Boxing gym.mp3';
/** Quiet gym ambience — punch SFX stay prominent. */
const BACKGROUND_MUSIC_VOLUME = 0.18;
const BACKGROUND_MUSIC_PLAY_VOLUME = BACKGROUND_MUSIC_VOLUME * 0.5;

let audio: HTMLAudioElement | null = null;
let started = false;
let inPlayMode = false;

function currentVolume(): number {
  return inPlayMode ? BACKGROUND_MUSIC_PLAY_VOLUME : BACKGROUND_MUSIC_VOLUME;
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(BACKGROUND_MUSIC_SRC);
    audio.loop = true;
    audio.volume = currentVolume();
    audio.preload = 'auto';
  }
  return audio;
}

/** Duck ambience while glove play is active. */
export function setBackgroundMusicPlayMode(active: boolean): void {
  inPlayMode = active;
  if (audio) audio.volume = currentVolume();
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
