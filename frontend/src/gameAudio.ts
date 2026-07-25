import { assetUrl } from './assetUrl';

export type PunchSfxStation = 'heavy-bag' | 'speedball' | 'bobo-doll' | 'ring';

const BACKGROUND_MUSIC_SRC = assetUrl('/sounds/Boxing gym.mp3');
const BACKGROUND_MUSIC_VOLUME = 0.18;
const BACKGROUND_MUSIC_PLAY_VOLUME = BACKGROUND_MUSIC_VOLUME * 0.5;

const PUNCH_SFX: Record<PunchSfxStation, string> = {
  'heavy-bag': assetUrl('/sounds/universfield-punch-03-352040.mp3'),
  speedball: assetUrl('/sounds/universfield-power-punch-192118.mp3'),
  'bobo-doll': assetUrl('/sounds/floraphonic-rubber-chicken-squeak-toy-1-181416.mp3'),
  ring: assetUrl('/sounds/beetpro-ouch-sound-effect-30-11844.mp3'),
};

/** Skip encoder/file silence so impact aligns with the punch. */
const PUNCH_START_OFFSET: Record<PunchSfxStation, number> = {
  'heavy-bag': 0.29,
  speedball: 0.11,
  'bobo-doll': 0.03,
  ring: 0.08,
};

let audioCtx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const bufferLoads = new Map<string, Promise<AudioBuffer>>();

let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let musicPlaying = false;
let inPlayMode = false;

function currentMusicVolume(): number {
  return inPlayMode ? BACKGROUND_MUSIC_PLAY_VOLUME : BACKGROUND_MUSIC_VOLUME;
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = buffers.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = bufferLoads.get(src);
  if (pending) return pending;

  const promise = fetch(src)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load audio: ${src}`);
      return res.arrayBuffer();
    })
    .then((data) => getAudioContext().decodeAudioData(data))
    .then((buffer) => {
      buffers.set(src, buffer);
      bufferLoads.delete(src);
      return buffer;
    })
    .catch((err) => {
      bufferLoads.delete(src);
      throw err;
    });

  bufferLoads.set(src, promise);
  return promise;
}

function updateMusicGain(): void {
  if (musicGain) musicGain.gain.value = currentMusicVolume();
}

function stopBackgroundMusic(): void {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch {
      /* already stopped */
    }
    musicSource.disconnect();
    musicSource = null;
  }
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
  musicPlaying = false;
}

async function ensureBackgroundPlaying(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  if (musicPlaying && musicSource && musicGain) {
    updateMusicGain();
    return;
  }

  const buffer = await loadBuffer(BACKGROUND_MUSIC_SRC);
  if (musicPlaying) return;

  stopBackgroundMusic();
  musicGain = ctx.createGain();
  musicGain.gain.value = currentMusicVolume();
  musicSource = ctx.createBufferSource();
  musicSource.buffer = buffer;
  musicSource.loop = true;
  musicSource.connect(musicGain);
  musicGain.connect(ctx.destination);
  musicSource.start(0);
  musicPlaying = true;
}

/** Duck ambience while glove play is active. */
export function setBackgroundMusicPlayMode(active: boolean): void {
  inPlayMode = active;
  updateMusicGain();
}

/** Resume audio after autoplay blocks or tab backgrounding. */
export function unlockGameAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  void ensureBackgroundPlaying().catch(() => {
    musicPlaying = false;
  });
  for (const src of Object.values(PUNCH_SFX)) {
    void loadBuffer(src).catch(() => {});
  }
}

export function preloadPunchSfx(station: PunchSfxStation): void {
  void loadBuffer(PUNCH_SFX[station]).catch(() => {});
}

/** Play station punch sound (overlapping hits allowed). */
export function playPunchSfx(station: PunchSfxStation, volume = 0.85): void {
  const src = PUNCH_SFX[station];
  const offset = PUNCH_START_OFFSET[station];
  const ctx = getAudioContext();

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const playFromBuffer = (buffer: AudioBuffer) => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0, offset);
  };

  const cached = buffers.get(src);
  if (cached) {
    playFromBuffer(cached);
    return;
  }

  void loadBuffer(src)
    .then(playFromBuffer)
    .catch(() => {});
}

/**
 * Synthesize a classic three-ring boxing bell (metallic ding with harmonics).
 * No external sample required — plays immediately when damage hits 100%.
 */
export function playBoxingBellSfx(volume = 0.75): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const ringAt = (delaySec: number) => {
    const t0 = ctx.currentTime + delaySec;
    // Fundamental + bright partials of a small gong / desk bell
    const partials: Array<[number, number]> = [
      [880, 0.55],
      [1320, 0.32],
      [1760, 0.22],
      [2640, 0.14],
      [3520, 0.08],
    ];
    for (const [freq, amp] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      // Slight pitch drop as metal settles
      osc.frequency.exponentialRampToValueAtTime(freq * 0.97, t0 + 0.9);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(amp, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + 1.2);
    }
  };

  // Three rings — classic end-of-round cadence
  ringAt(0);
  ringAt(0.52);
  ringAt(1.04);
}

/** @deprecated Use unlockGameAudio */
export function unlockPunchAudio(): void {
  unlockGameAudio();
}

/** @deprecated Use unlockGameAudio */
export function startBackgroundMusic(): void {
  unlockGameAudio();
}

/** @deprecated Use unlockGameAudio */
export function ensureBackgroundMusic(): void {
  unlockGameAudio();
}
