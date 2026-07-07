import { ensureBackgroundMusic } from '../backgroundMusic';

export type PunchSfxStation = 'heavy-bag' | 'speedball' | 'bobo-doll';

const PUNCH_SFX: Record<PunchSfxStation, string> = {
  'heavy-bag': '/sounds/universfield-punch-03-352040.mp3',
  speedball: '/sounds/universfield-power-punch-192118.mp3',
  'bobo-doll': '/sounds/floraphonic-rubber-chicken-squeak-toy-1-181416.mp3',
};

/** Skip encoder/file silence so impact aligns with the punch. */
const PUNCH_START_OFFSET: Record<PunchSfxStation, number> = {
  'heavy-bag': 0.29,
  speedball: 0.11,
  'bobo-doll': 0.03,
};

const POOL_SIZE = 4;
const pools = new Map<string, HTMLAudioElement[]>();
const poolCursor = new Map<string, number>();
let audioUnlocked = false;

function getSrc(station: PunchSfxStation): string {
  return PUNCH_SFX[station];
}

function ensurePool(src: string): HTMLAudioElement[] {
  let pool = pools.get(src);
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const clip = new Audio(src);
      clip.preload = 'auto';
      clip.load();
      return clip;
    });
    pools.set(src, pool);
    poolCursor.set(src, 0);
  }
  return pool;
}

function warmClip(clip: HTMLAudioElement, station: PunchSfxStation): void {
  const offset = PUNCH_START_OFFSET[station];
  clip.volume = 0;
  clip.currentTime = offset;
  void clip
    .play()
    .then(() => {
      clip.pause();
      clip.currentTime = offset;
    })
    .catch(() => {});
}

/** Call on first user gesture so mobile browsers allow playback. */
export function unlockPunchAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  ensureBackgroundMusic();
  for (const station of Object.keys(PUNCH_SFX) as PunchSfxStation[]) {
    const pool = ensurePool(getSrc(station));
    warmClip(pool[0], station);
  }
}

export function preloadPunchSfx(station: PunchSfxStation): void {
  ensurePool(getSrc(station));
}

/** Play station punch sound (overlapping hits allowed). */
export function playPunchSfx(station: PunchSfxStation, volume = 0.85): void {
  const src = getSrc(station);
  const pool = ensurePool(src);
  const cursor = poolCursor.get(src) ?? 0;
  poolCursor.set(src, (cursor + 1) % pool.length);
  const hit = pool[cursor];
  hit.pause();
  hit.volume = volume;
  hit.currentTime = PUNCH_START_OFFSET[station];
  void hit.play().catch(() => {});
}
