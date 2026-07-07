import { ensureBackgroundMusic } from '../backgroundMusic';

export type PunchSfxStation = 'heavy-bag' | 'speedball' | 'bobo-doll';

const PUNCH_SFX: Record<PunchSfxStation, string> = {
  'heavy-bag': '/sounds/universfield-punch-03-352040.mp3',
  speedball: '/sounds/universfield-power-punch-192118.mp3',
  'bobo-doll': '/sounds/Rubber chicken.wav',
};

const preloaded = new Map<string, HTMLAudioElement>();
let audioUnlocked = false;

function getSrc(station: PunchSfxStation): string {
  return PUNCH_SFX[station];
}

/** Call on first user gesture so mobile browsers allow playback. */
export function unlockPunchAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  ensureBackgroundMusic();
  for (const src of Object.values(PUNCH_SFX)) {
    const probe = new Audio(src);
    probe.volume = 0;
    probe.preload = 'auto';
    void probe.play().then(() => probe.pause()).catch(() => {});
    preloaded.set(src, probe);
  }
}

export function preloadPunchSfx(station: PunchSfxStation): void {
  const src = getSrc(station);
  if (preloaded.has(src)) return;
  const audio = new Audio(src);
  audio.preload = 'auto';
  preloaded.set(src, audio);
}

/** Play station punch sound (overlapping hits allowed). */
export function playPunchSfx(station: PunchSfxStation, volume = 0.85): void {
  const src = getSrc(station);
  const hit = new Audio(src);
  hit.volume = volume;
  void hit.play().catch(() => {});
}
